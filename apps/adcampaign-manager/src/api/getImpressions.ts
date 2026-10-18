import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Get all impressions',
  inputSchema: z.object({ statut: z.string().optional() }),
  outputSchema: z.object({
    impressions: z.array(z.object({
      id: z.string(),
      referenceImpression: z.string().optional(),
      campagneId: z.string().optional(),
      campagneNom: z.string().optional(),
      datePlanifiee: z.string().optional(),
      dateRealisation: z.string().optional(),
      statut: z.string().optional(),
      formatImpression: z.string().optional(),
      quantite: z.number().optional(),
      machinisteAssigne: z.string().optional(),
      chefAtelier: z.string().optional(),
      notes: z.string().optional(),
      typeDeTravaux: z.string().optional(),
      batFichier: z.array(z.object({ url: z.string() })).optional(),
    })),
    campagnes: z.array(z.object({ id: z.string(), nomCampagne: z.string().optional() })),
  }),
  execute: async ({ input }) => {
    const [impRes, campRes] = await Promise.all([
      zite.impressions.findAll({ limit: 500 }),
      zite.campagnes.findAll({ limit: 500, fields: ['id', 'nomCampagne'] }),
    ]);
    const campMap = new Map(campRes.records.map(c => [c.id, c.nomCampagne]));
    let impressions = impRes.records;
    if (input.statut) impressions = impressions.filter(i => i.statut === input.statut);
    return {
      impressions: impressions.map(i => {
        const campagneId = Array.isArray(i.campagne) ? i.campagne[0] : i.campagne;
        return {
          id: i.id,
          referenceImpression: i.referenceImpression,
          campagneId,
          campagneNom: campagneId ? campMap.get(campagneId) : undefined,
          datePlanifiee: i.datePlanifiee,
          dateRealisation: i.dateRealisation,
          statut: i.statut,
          formatImpression: i.formatImpression,
          quantite: i.quantite,
          machinisteAssigne: i.machinisteAssigne,
          chefAtelier: i.chefAtelier,
          notes: i.notes,
          typeDeTravaux: i.typeDeTravaux,
          batFichier: i.batFichier,
        };
      }),
      campagnes: campRes.records.map(c => ({ id: c.id, nomCampagne: c.nomCampagne })),
    };
  },
});
