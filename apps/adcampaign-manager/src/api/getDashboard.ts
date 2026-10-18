import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Get dashboard statistics',
  inputSchema: z.object({}),
  outputSchema: z.object({
    totalCampagnes: z.number(),
    campagnesEnCours: z.number(),
    totalClients: z.number(),
    chiffreAffaires: z.number(),
    facturesEnRetard: z.number(),
    impressionsPlanifiees: z.number(),
    reservationsEnAttente: z.number(),
    campagnesRecentes: z.array(z.object({
      id: z.string(),
      nomCampagne: z.string().optional(),
      statut: z.string().optional(),
      budgetTotal: z.number().optional(),
      dateDebut: z.string().optional(),
      dateFin: z.string().optional(),
    })),
    facturesRecentes: z.array(z.object({
      id: z.string(),
      numeroFacture: z.string().optional(),
      montantTtc: z.number().optional(),
      statutPaiement: z.string().optional(),
      dateEcheance: z.string().optional(),
    })),
  }),
  execute: async () => {
    const [campagnesRes, clientsRes, facturesRes, impressionsRes, reservationsRes] = await Promise.all([
      zite.campagnes.findAll({ limit: 100 }),
      zite.clients.findAll({ limit: 500 }),
      zite.factures.findAll({ limit: 100 }),
      zite.impressions.findAll({ filters: { statut: 'Planifiée' }, limit: 100 }),
      zite.reservations.findAll({ filters: { statut: 'En attente' }, limit: 100 }),
    ]);

    const campagnesEnCours = campagnesRes.records.filter(c => c.statut === 'En cours').length;
    const chiffreAffaires = facturesRes.records
      .filter(f => f.statutPaiement === 'Payée')
      .reduce((sum, f) => sum + (f.montantTtc || 0), 0);
    const facturesEnRetard = facturesRes.records.filter(f => f.statutPaiement === 'En retard').length;

    const campagnesRecentes = campagnesRes.records.slice(0, 5).map(c => ({
      id: c.id,
      nomCampagne: c.nomCampagne,
      statut: c.statut,
      budgetTotal: c.budgetTotal,
      dateDebut: c.dateDebut,
      dateFin: c.dateFin,
    }));

    const facturesRecentes = facturesRes.records.slice(0, 5).map(f => ({
      id: f.id,
      numeroFacture: f.numeroFacture,
      montantTtc: f.montantTtc,
      statutPaiement: f.statutPaiement,
      dateEcheance: f.dateEcheance,
    }));

    return {
      totalCampagnes: campagnesRes.records.length,
      campagnesEnCours,
      totalClients: clientsRes.records.length,
      chiffreAffaires,
      facturesEnRetard,
      impressionsPlanifiees: impressionsRes.records.length,
      reservationsEnAttente: reservationsRes.records.length,
      campagnesRecentes,
      facturesRecentes,
    };
  },
});
