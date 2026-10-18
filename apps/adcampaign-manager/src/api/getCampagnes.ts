import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Get all campaigns with client info',
  inputSchema: z.object({ search: z.string().optional(), statut: z.string().optional() }),
  outputSchema: z.object({
    campagnes: z.array(z.object({
      id: z.string(),
      nomCampagne: z.string().optional(),
      clientId: z.string().optional(),
      clientNom: z.string().optional(),
      dateDebut: z.string().optional(),
      dateFin: z.string().optional(),
      statut: z.string().optional(),
      budgetTotal: z.number().optional(),
      validationCreation: z.string().optional(),
      commercialResponsable: z.string().optional(),
      description: z.string().optional(),
    })),
    clients: z.array(z.object({ id: z.string(), nomClient: z.string().optional() })),
  }),
  execute: async ({ input }) => {
    const [campRes, clientRes] = await Promise.all([
      zite.campagnes.findAll({ limit: 500 }),
      zite.clients.findAll({ limit: 500, fields: ['id', 'nomClient'] }),
    ]);
    const clientMap = new Map(clientRes.records.map(c => [c.id, c.nomClient]));
    let campagnes = campRes.records;
    if (input.statut) campagnes = campagnes.filter(c => c.statut === input.statut);
    if (input.search) {
      const q = input.search.toLowerCase();
      campagnes = campagnes.filter(c => c.nomCampagne?.toLowerCase().includes(q));
    }
    return {
      campagnes: campagnes.map(c => {
        const clientId = Array.isArray(c.client) ? c.client[0] : c.client;
        return {
          id: c.id,
          nomCampagne: c.nomCampagne,
          clientId,
          clientNom: clientId ? clientMap.get(clientId) : undefined,
          dateDebut: c.dateDebut,
          dateFin: c.dateFin,
          statut: c.statut,
          budgetTotal: c.budgetTotal,
          validationCreation: c.validationCreation,
          commercialResponsable: c.commercialResponsable,
          description: c.description,
        };
      }),
      clients: clientRes.records.map(c => ({ id: c.id, nomClient: c.nomClient })),
    };
  },
});
