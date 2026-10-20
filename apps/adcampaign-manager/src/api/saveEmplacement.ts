import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Create or update a location',
  inputSchema: z.object({
    id: z.string().optional(),
    referenceEmplacement: z.string(),
    localisation: z.string().optional(),
    ville: z.string().optional(),
    type: z.string().optional(),
    format: z.string().optional(),
    prixParSemaine: z.number().optional(),
    disponibilite: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }),
  outputSchema: z.object({ id: z.string(), success: z.boolean() }),
  execute: async ({ input }) => {
    const { id, ...record } = input;
    if (id) {
      const res = await zite.emplacements.update({ id, record });
      return { id: res.id, success: true };
    } else {
      const res = await zite.emplacements.create({ record });
      return { id: res.id, success: true };
    }
  },
});
