import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Get all invoices',
  inputSchema: z.object({ statut: z.string().optional() }),
  outputSchema: z.object({
    factures: z.array(z.object({
      id: z.string(),
      numeroFacture: z.string().optional(),
      clientId: z.string().optional(),
      clientNom: z.string().optional(),
      campagneId: z.string().optional(),
      campagneNom: z.string().optional(),
      dateEmission: z.string().optional(),
      dateEcheance: z.string().optional(),
      montantHt: z.number().optional(),
      tva: z.number().optional(),
      montantTtc: z.number().optional(),
      statutPaiement: z.string().optional(),
      notes: z.string().optional(),
      piecesJointes: z.array(z.object({ url: z.string() })).optional(),
    })),
    clients: z.array(z.object({ id: z.string(), nomClient: z.string().optional() })),
    campagnes: z.array(z.object({ id: z.string(), nomCampagne: z.string().optional() })),
  }),
  execute: async ({ input }) => {
    const [facRes, clientRes, campRes] = await Promise.all([
      zite.factures.findAll({ limit: 500 }),
      zite.clients.findAll({ limit: 500, fields: ['id', 'nomClient'] }),
      zite.campagnes.findAll({ limit: 500, fields: ['id', 'nomCampagne'] }),
    ]);
    const clientMap = new Map(clientRes.records.map(c => [c.id, c.nomClient]));
    const campMap = new Map(campRes.records.map(c => [c.id, c.nomCampagne]));
    let factures = facRes.records;
    if (input.statut) factures = factures.filter(f => f.statutPaiement === input.statut);
    return {
      factures: factures.map(f => {
        const clientId = Array.isArray(f.client) ? f.client[0] : f.client;
        const campagneId = Array.isArray(f.campagne) ? f.campagne[0] : f.campagne;
        return {
          id: f.id,
          numeroFacture: f.numeroFacture,
          clientId,
          clientNom: clientId ? clientMap.get(clientId) : undefined,
          campagneId,
          campagneNom: campagneId ? campMap.get(campagneId) : undefined,
          dateEmission: f.dateEmission,
          dateEcheance: f.dateEcheance,
          montantHt: f.montantHt,
          tva: f.tva,
          montantTtc: f.montantTtc,
          statutPaiement: f.statutPaiement,
          notes: f.notes,
          piecesJointes: f.piecesJointes ?? [],
        };
      }),
      clients: clientRes.records.map(c => ({ id: c.id, nomClient: c.nomClient })),
      campagnes: campRes.records.map(c => ({ id: c.id, nomCampagne: c.nomCampagne })),
    };
  },
});
