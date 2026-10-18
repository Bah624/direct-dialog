import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Get all collaborateurs',
  inputSchema: z.object({}),
  outputSchema: z.object({
    collaborateurs: z.array(z.object({
      id: z.string(),
      nomComplet: z.string().optional(),
      email: z.string().optional(),
      poste: z.string().optional(),
      notificationsActives: z.boolean().optional(),
      dateAjout: z.string().optional(),
    })),
  }),
  execute: async () => {
    const { records } = await zite.collaborateurs.findAll({ limit: 200 });
    return {
      collaborateurs: records.map(c => ({
        id: c.id,
        nomComplet: c.nomComplet,
        email: c.email,
        poste: c.poste,
        notificationsActives: c.notificationsActives,
        dateAjout: c.dateAjout,
      })),
    };
  },
});
