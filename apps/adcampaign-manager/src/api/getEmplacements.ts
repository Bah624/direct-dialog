import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Get all locations',
  inputSchema: z.object({ search: z.string().optional(), disponibilite: z.string().optional() }),
  outputSchema: z.object({
    emplacements: z.array(z.object({
      id: z.string(),
      referenceEmplacement: z.string().optional(),
      localisation: z.string().optional(),
      ville: z.string().optional(),
      type: z.string().optional(),
      format: z.string().optional(),
      prixParSemaine: z.number().optional(),
      disponibilite: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    })),
  }),
  execute: async ({ input }) => {
    const result = await zite.emplacements.findAll({ limit: 500 });
    let emplacements = result.records;
    if (input.disponibilite) emplacements = emplacements.filter(e => e.disponibilite === input.disponibilite);
    if (input.search) {
      const q = input.search.toLowerCase();
      emplacements = emplacements.filter(e =>
        e.referenceEmplacement?.toLowerCase().includes(q) ||
        e.localisation?.toLowerCase().includes(q) ||
        e.ville?.toLowerCase().includes(q)
      );
    }
    return {
      emplacements: emplacements.map(e => ({
        id: e.id,
        referenceEmplacement: e.referenceEmplacement,
        localisation: e.localisation,
        ville: e.ville,
        type: e.type,
        format: e.format,
        prixParSemaine: e.prixParSemaine,
        disponibilite: e.disponibilite,
        latitude: e.latitude,
        longitude: e.longitude,
      })),
    };
  },
});
