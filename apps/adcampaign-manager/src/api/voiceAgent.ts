import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';
import OpenAI, { toFile } from 'openai';

const client = new OpenAI({ apiKey: process.env.ZITE_OPENAI_ACCESS_TOKEN });

async function buildDatabaseContext(): Promise<string> {
  const [
    { records: clients },
    { records: campagnes },
    { records: emplacements },
    { records: reservations },
    { records: impressions },
    { records: factures },
    { records: stock },
  ] = await Promise.all([
    zite.clients.findAll({ limit: 50 }),
    zite.campagnes.findAll({ limit: 50 }),
    zite.emplacements.findAll({ limit: 50 }),
    zite.reservations.findAll({ limit: 50 }),
    zite.impressions.findAll({ limit: 50 }),
    zite.factures.findAll({ limit: 50 }),
    zite.stock.findAll({ limit: 50 }),
  ]);

  const fmt = (n?: number) => n != null ? n.toLocaleString('fr-FR') : '–';

  const clientsText = clients.map(c =>
    `  - ${c.nomClient} (${c.statut ?? 'N/A'}) | Secteur: ${c.secteurDactivite ?? 'N/A'} | Tel: ${c.telephone ?? 'N/A'}`
  ).join('\n');

  const campagnesText = campagnes.map(c =>
    `  - ${c.nomCampagne} | Statut: ${c.statut ?? 'N/A'} | Budget: ${fmt(c.budgetTotal)} GNF | Du ${c.dateDebut ?? '?'} au ${c.dateFin ?? '?'} | Commercial: ${c.commercialResponsable ?? 'N/A'}`
  ).join('\n');

  const emplacementsText = emplacements.map(e =>
    `  - ${e.referenceEmplacement} | ${e.localisation ?? 'N/A'}, ${e.ville ?? 'N/A'} | Type: ${e.type ?? 'N/A'} | Dispo: ${e.disponibilite ?? 'N/A'} | Prix/sem: ${fmt(e.prixParSemaine)} GNF`
  ).join('\n');

  const reservationsText = reservations.map(r =>
    `  - ${r.referenceReservation} | Statut: ${r.statut ?? 'N/A'} | Du ${r.dateDebut ?? '?'} au ${r.dateFin ?? '?'} | Montant: ${fmt(r.montant)} GNF`
  ).join('\n');

  const impressionsText = impressions.map(i =>
    `  - ${i.referenceImpression} | Type: ${i.typeDeTravaux ?? 'N/A'} | Statut: ${i.statut ?? 'N/A'} | Format: ${i.formatImpression ?? 'N/A'} | Qté: ${i.quantite ?? 0} | Machiniste: ${i.machinisteAssigne ?? 'N/A'}`
  ).join('\n');

  const facturesText = factures.map(f =>
    `  - ${f.numeroFacture} | Statut: ${f.statutPaiement ?? 'N/A'} | HT: ${fmt(f.montantHt)} GNF | TTC: ${fmt(f.montantTtc)} GNF | Émis: ${f.dateEmission ?? 'N/A'} | Échéance: ${f.dateEcheance ?? 'N/A'}`
  ).join('\n');

  const stockText = stock.map(s =>
    `  - ${s.referenceArticle} | ${s.nomArticle ?? 'N/A'} | Catégorie: ${s.categorie ?? 'N/A'} | Qté: ${s.quantiteEnStock ?? 0} ${s.unite ?? ''} | Statut: ${s.statutStock ?? 'N/A'}`
  ).join('\n');

  return `
=== BASE DE DONNÉES DIRECT DIALOG (données en temps réel) ===

CLIENTS (${clients.length}) :
${clientsText || '  Aucun client'}

CAMPAGNES (${campagnes.length}) :
${campagnesText || '  Aucune campagne'}

EMPLACEMENTS (${emplacements.length}) :
${emplacementsText || '  Aucun emplacement'}

RÉSERVATIONS (${reservations.length}) :
${reservationsText || '  Aucune réservation'}

TRAVAUX / IMPRESSIONS (${impressions.length}) :
${impressionsText || '  Aucun travail'}

FACTURES (${factures.length}) :
${facturesText || '  Aucune facture'}

STOCK (${stock.length} articles) :
${stockText || '  Aucun article en stock'}
`;
}

export default createEndpoint({
  description: 'Transcribe audio, get AI response with DB context, return TTS audio, save conversation',
  inputSchema: z.object({
    audioBase64: z.string(),
    mimeType: z.string(),
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })).optional(),
    conversationId: z.string().optional(),
  }),
  outputSchema: z.object({
    transcript: z.string(),
    responseText: z.string(),
    audioBase64: z.string(),
    mimeType: z.string(),
    conversationId: z.string(),
  }),
  execute: async ({ input, context }) => {
    // 1. Transcribe audio with Whisper
    const audioBuffer = Buffer.from(input.audioBase64, 'base64');
    const ext = input.mimeType.includes('mp4') ? 'mp4'
      : input.mimeType.includes('ogg') ? 'ogg'
      : input.mimeType.includes('mpeg') ? 'mp3'
      : 'webm';

    const audioFile = await toFile(audioBuffer, `recording.${ext}`, { type: input.mimeType });
    const transcription = await client.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
      language: 'fr',
    });
    const transcript = transcription.text;

    // 2. Build DB context
    const dbContext = await buildDatabaseContext();

    const SYSTEM_PROMPT = `Tu es l'assistant vocal de DIRECT DIALOG, une régie publicitaire en Guinée.
Tu as accès en temps réel à toute la base de données de l'entreprise ci-dessous.
Tu peux répondre à des questions précises sur les clients, campagnes, emplacements, réservations, travaux, factures et stock.
Tu réponds toujours en français, de façon claire, concise et professionnelle.
Garde tes réponses courtes et naturelles pour une conversation vocale (2-4 phrases maximum).
Si on te demande des statistiques, analyse les données fournies et réponds précisément.

${dbContext}`;

    // 3. Get GPT response
    const history = input.messages ?? [];
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
        { role: 'user', content: transcript },
      ],
    });
    const responseText = completion.choices[0].message.content ?? '';

    // 4. Convert response to speech with TTS
    const ttsResponse = await client.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: responseText,
      response_format: 'mp3',
    });
    const ttsBuffer = Buffer.from(await ttsResponse.arrayBuffer());
    const audioBase64Out = ttsBuffer.toString('base64');

    // 5. Save/update conversation
    const allMessages = [
      ...(input.messages ?? []),
      { role: 'user', content: transcript },
      { role: 'assistant', content: responseText },
    ];

    let conversationId = input.conversationId;
    const sessionTitle = `Session ${new Date().toLocaleDateString('fr-FR')} – ${transcript.slice(0, 40)}`;

    if (conversationId) {
      await zite.conversationsAgent.update({
        id: conversationId,
        record: {
          messagesJson: JSON.stringify(allMessages),
          nombreDeMessages: allMessages.length,
          dernierMessageUtilisateur: transcript.slice(0, 255),
        },
      });
    } else {
      const newConv = await zite.conversationsAgent.create({
        record: {
          titreSession: sessionTitle,
          emailUtilisateur: context.user.email,
          messagesJson: JSON.stringify(allMessages),
          nombreDeMessages: allMessages.length,
          dernierMessageUtilisateur: transcript.slice(0, 255),
        },
      });
      conversationId = newConv.id;
    }

    return {
      transcript,
      responseText,
      audioBase64: audioBase64Out,
      mimeType: 'audio/mpeg',
      conversationId: conversationId!,
    };
  },
});
