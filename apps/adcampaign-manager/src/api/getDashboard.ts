import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';
import { settings } from '../../../../server/src/settings';
import { can } from '../../../../server/src/permissions';
import { utilisateurCourant } from '../../../../server/src/requete';

const evolutionSchema = z.object({
  mois: z.string(),
  libelle: z.string(),
  paye: z.number(),
  enAttente: z.number(),
});

const echeanceSchema = z.object({
  id: z.string(),
  type: z.string(),
  libelle: z.string(),
  detail: z.string().optional(),
  date: z.string().optional(),
  montant: z.number().optional(),
  statut: z.string().optional(),
  lien: z.string(),
});

export default createEndpoint({
  description: 'Indicateurs, pipeline, encaissements et échéances du tableau de bord',
  inputSchema: z.object({}).optional(),
  outputSchema: z.object({
    totalCampagnes: z.number(),
    campagnesEnCours: z.number(),
    totalClients: z.number(),
    chiffreAffaires: z.number(),
    facturesEnRetard: z.number(),
    impressionsPlanifiees: z.number(),
    reservationsEnAttente: z.number(),
    caPaye: z.number(),
    caEnAttente: z.number(),
    tauxRecouvrement: z.number(),
    evolutionCa: z.array(evolutionSchema),
    topClients: z.array(
      z.object({
        id: z.string(),
        nom: z.string(),
        montant: z.number(),
        factures: z.number(),
      }),
    ),
    echeances: z.array(echeanceSchema),
    repartitionCampagnes: z.array(
      z.object({
        statut: z.string(),
        nombre: z.number(),
        budget: z.number(),
      }),
    ),
    emplacements: z.object({
      total: z.number(),
      disponibles: z.number(),
      reserves: z.number(),
      occupes: z.number(),
    }),
    campagnesRecentes: z.array(
      z.object({
        id: z.string(),
        nomCampagne: z.string().optional(),
        statut: z.string().optional(),
        budgetTotal: z.number().optional(),
        dateDebut: z.string().optional(),
        dateFin: z.string().optional(),
        clientNom: z.string().optional(),
      }),
    ),
    facturesRecentes: z.array(
      z.object({
        id: z.string(),
        numeroFacture: z.string().optional(),
        montantTtc: z.number().optional(),
        statutPaiement: z.string().optional(),
        dateEcheance: z.string().optional(),
      }),
    ),
  }),
  execute: async () => {
    const [
      { records: factures },
      { records: campagnes },
      { records: clients },
      { records: reservations },
      { records: impressions },
      { records: emplacements },
    ] = await Promise.all([
      zite.factures.findAll({ limit: 2000 }),
      zite.campagnes.findAll({ limit: 2000 }),
      zite.clients.findAll({ limit: 2000 }),
      zite.reservations.findAll({ limit: 2000 }),
      zite.impressions.findAll({ limit: 2000 }),
      zite.emplacements.findAll({ limit: 2000 }),
    ]);

    // Les montants ne sont visibles que par les profils ayant accès à la facturation.
    const utilisateur = utilisateurCourant();
    const permissions = await settings.permissions();
    const voitFinances = utilisateur
      ? can(permissions, utilisateur.profil, 'factures', 'voir')
      : false;

    const nombre = (valeur: any) => (typeof valeur === 'number' ? valeur : Number(valeur) || 0);
    const nomClient = new Map(clients.map((c) => [c.id, c.nomClient ?? '—']));
    const idClient = (valeur: any) =>
      (Array.isArray(valeur) ? valeur[0] : valeur) as string | undefined;

    const paye = factures.filter((f) => f.statutPaiement === 'Payée');
    const attente = factures.filter((f) =>
      ['Envoyée', 'En retard', 'Partiellement payée'].includes(f.statutPaiement ?? ''),
    );

    const caPaye = paye.reduce((total, f) => total + nombre(f.montantTtc), 0);
    const caEnAttente = attente.reduce((total, f) => total + nombre(f.montantTtc), 0);
    const chiffreAffaires = caPaye + caEnAttente;
    const tauxRecouvrement = chiffreAffaires > 0 ? Math.round((caPaye / chiffreAffaires) * 100) : 0;

    // --- Évolution sur 6 mois -------------------------------------------------
    const maintenant = new Date();
    // Si l'activité est plus ancienne que le mois courant, on ancre la courbe sur
    // le dernier mois ayant des factures (sinon le graphique resterait vide).
    let ancre = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
    const dernierMoisActif = factures
      .map((f) => (f.dateEmission ?? '').slice(0, 7))
      .filter(Boolean)
      .sort()
      .at(-1);
    if (dernierMoisActif) {
      const [anneeActive, moisActif] = dernierMoisActif.split('-').map(Number);
      const decalage =
        (maintenant.getFullYear() - anneeActive) * 12 + (maintenant.getMonth() + 1 - moisActif);
      if (decalage >= 2) ancre = new Date(anneeActive, moisActif - 1, 1);
    }

    const evolutionCa = Array.from({ length: 6 }).map((_, index) => {
      const date = new Date(ancre.getFullYear(), ancre.getMonth() - (5 - index), 1);
      const cle = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const duMois = factures.filter((f) => (f.dateEmission ?? '').startsWith(cle));
      const montantPaye = duMois
        .filter((f) => f.statutPaiement === 'Payée')
        .reduce((total, f) => total + nombre(f.montantTtc), 0);
      const montantAttente = duMois
        .filter((f) => f.statutPaiement !== 'Payée')
        .reduce((total, f) => total + nombre(f.montantTtc), 0);
      return {
        mois: cle,
        libelle: date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
        paye: montantPaye,
        enAttente: montantAttente,
      };
    });

    // --- Top clients ----------------------------------------------------------
    const parClient = new Map<string, { montant: number; factures: number }>();
    for (const facture of factures) {
      const id = idClient(facture.client);
      if (!id) continue;
      const cumul = parClient.get(id) ?? { montant: 0, factures: 0 };
      cumul.montant += nombre(facture.montantTtc);
      cumul.factures += 1;
      parClient.set(id, cumul);
    }
    const topClients = [...parClient.entries()]
      .map(([id, cumul]) => ({
        id,
        nom: nomClient.get(id) ?? 'Client',
        montant: cumul.montant,
        factures: cumul.factures,
      }))
      .sort((a, b) => b.montant - a.montant)
      .slice(0, 5);

    // --- Échéances et relances ------------------------------------------------
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const dansUneSemaine = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const echeances: any[] = [];

    for (const facture of factures) {
      const statut = facture.statutPaiement ?? '';
      if (statut === 'Payée' || statut === 'Brouillon') continue;
      const echeance = facture.dateEcheance ?? '';
      if (statut === 'En retard' || (echeance && echeance <= dansUneSemaine)) {
        echeances.push({
          id: facture.id,
          type: 'Facture',
          libelle: facture.numeroFacture ?? 'Facture',
          detail: nomClient.get(idClient(facture.client) ?? '') ?? undefined,
          date: echeance || undefined,
          montant: nombre(facture.montantTtc),
          statut,
          lien: '/factures',
        });
      }
    }

    for (const reservation of reservations.filter((r) => r.statut === 'En attente')) {
      echeances.push({
        id: reservation.id,
        type: 'Réservation',
        libelle: reservation.referenceReservation ?? 'Réservation',
        detail: `Du ${reservation.dateDebut ?? '?'} au ${reservation.dateFin ?? '?'}`,
        date: reservation.dateDebut ?? undefined,
        montant: nombre(reservation.montant),
        statut: 'En attente',
        lien: '/reservations',
      });
    }

    for (const impression of impressions.filter((i) => i.statut === 'Planifiée')) {
      echeances.push({
        id: impression.id,
        type: 'Travaux',
        libelle: impression.referenceImpression ?? 'Travaux',
        detail: impression.typeDeTravaux ?? undefined,
        date: impression.datePlanifiee ?? undefined,
        statut: 'Planifiée',
        lien: '/impressions',
      });
    }

    for (const campagne of campagnes.filter((c) => c.validationCreation === 'En attente')) {
      echeances.push({
        id: campagne.id,
        type: 'Campagne',
        libelle: campagne.nomCampagne ?? 'Campagne',
        detail: 'Validation de création en attente',
        date: campagne.dateDebut ?? undefined,
        montant: nombre(campagne.budgetTotal),
        statut: 'À valider',
        lien: '/campagnes',
      });
    }

    const parStatut = new Map<string, { nombre: number; budget: number }>();
    for (const campagne of campagnes) {
      const statut = campagne.statut ?? 'Non renseigné';
      const cumul = parStatut.get(statut) ?? { nombre: 0, budget: 0 };
      cumul.nombre += 1;
      cumul.budget += nombre(campagne.budgetTotal);
      parStatut.set(statut, cumul);
    }
    const repartitionCampagnes = [...parStatut.entries()]
      .map(([statut, cumul]) => ({ statut, ...cumul }))
      .sort((a, b) => b.nombre - a.nombre);

    echeances.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
    const echeancesTriees = echeances.slice(0, 8);

    const statutEcheance = (date?: string) =>
      date && date < aujourdhui
        ? 'en retard'
        : date && date <= dansUneSemaine
          ? 'cette semaine'
          : 'à venir';

    const campagnesRecentes = campagnes
      .slice()
      .sort((a, b) => (b.dateCreation ?? '').localeCompare(a.dateCreation ?? ''))
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        nomCampagne: c.nomCampagne,
        statut: c.statut,
        budgetTotal: nombre(c.budgetTotal) || undefined,
        dateDebut: c.dateDebut,
        dateFin: c.dateFin,
        clientNom: nomClient.get(idClient(c.client) ?? '') ?? undefined,
      }));

    const facturesRecentes = factures
      .slice()
      .sort((a, b) => (b.dateEmission ?? '').localeCompare(a.dateEmission ?? ''))
      .slice(0, 5)
      .map((f) => ({
        id: f.id,
        numeroFacture: f.numeroFacture,
        montantTtc: nombre(f.montantTtc),
        statutPaiement: f.statutPaiement,
        dateEcheance: f.dateEcheance,
      }));

    return {
      totalCampagnes: campagnes.length,
      campagnesEnCours: campagnes.filter((c) => c.statut === 'En cours').length,
      totalClients: clients.length,
      chiffreAffaires: voitFinances ? chiffreAffaires : 0,
      facturesEnRetard: voitFinances
        ? factures.filter((f) => f.statutPaiement === 'En retard').length
        : 0,
      impressionsPlanifiees: impressions.filter((i) => i.statut === 'Planifiée').length,
      reservationsEnAttente: reservations.filter((r) => r.statut === 'En attente').length,
      caPaye: voitFinances ? caPaye : 0,
      caEnAttente: voitFinances ? caEnAttente : 0,
      tauxRecouvrement: voitFinances ? tauxRecouvrement : 0,
      evolutionCa: voitFinances
        ? evolutionCa
        : evolutionCa.map((e) => ({ ...e, paye: 0, enAttente: 0 })),
      topClients: voitFinances ? topClients : [],
      repartitionCampagnes,
      echeances: echeancesTriees.map((e) => ({
        ...e,
        statut: e.type === 'Facture' ? statutEcheance(e.date) : e.statut,
      })),
      emplacements: {
        total: emplacements.length,
        disponibles: emplacements.filter((e) => e.disponibilite === 'Disponible').length,
        reserves: emplacements.filter((e) => e.disponibilite === 'Réservé').length,
        occupes: emplacements.filter((e) => e.disponibilite === 'Occupé').length,
      },
      campagnesRecentes,
      facturesRecentes,
    };
  },
});
