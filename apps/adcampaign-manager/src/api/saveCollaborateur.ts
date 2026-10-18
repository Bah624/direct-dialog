import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Create or update a collaborateur',
  inputSchema: z.object({
    id: z.string().optional(),
    nomComplet: z.string(),
    email: z.string(),
    poste: z.string().optional(),
    notificationsActives: z.boolean().optional(),
  }),
  outputSchema: z.object({ id: z.string(), success: z.boolean() }),
  execute: async ({ input }) => {
    const { id, ...rest } = input;
    if (id) {
      const res = await zite.collaborateurs.update({ id, record: rest });
      return { id: res.id, success: true };
    } else {
      const res = await zite.collaborateurs.create({ record: rest });
      return { id: res.id, success: true };
    }
  },
});
