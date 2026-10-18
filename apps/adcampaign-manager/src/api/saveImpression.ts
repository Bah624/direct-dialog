import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Create or update an impression',
  inputSchema: z.object({
    id: z.string().optional(),
    referenceImpression: z.string(),
    campagneId: z.string().optional(),
    datePlanifiee: z.string().optional(),
    dateRealisation: z.string().optional(),
    statut: z.string().optional(),
    formatImpression: z.string().optional(),
    quantite: z.number().optional(),
    machinisteAssigne: z.string().optional(),
    chefAtelier: z.string().optional(),
    notes: z.string().optional(),
    typeDeTravaux: z.string().optional(),
    batFichierUrls: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({ id: z.string(), success: z.boolean() }),
  execute: async ({ input }) => {
    const { id, campagneId, batFichierUrls, ...rest } = input;
    const record: Record<string, any> = {
      ...rest,
      campagne: campagneId ? [campagneId] : undefined,
      batFichier: batFichierUrls?.length ? batFichierUrls.map(url => ({ url })) : undefined,
    };
    if (id) {
      const res = await zite.impressions.update({ id, record });
      return { id: res.id, success: true };
    } else {
      const res = await zite.impressions.create({ record });
      return { id: res.id, success: true };
    }
  },
});
