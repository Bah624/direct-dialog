import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

const clientSchema = z.object({
  id: z.string().optional(),
  nomClient: z.string(),
  email: z.string().optional(),
  telephone: z.string().optional(),
  adresse: z.string().optional(),
  secteurDactivite: z.string().optional(),
  statut: z.string().optional(),
});

export default createEndpoint({
  description: 'Create or update a client',
  inputSchema: clientSchema,
  outputSchema: z.object({ id: z.string(), success: z.boolean() }),
  execute: async ({ input }) => {
    const { id, ...fields } = input;
    if (id) {
      const res = await zite.clients.update({ id, record: fields });
      return { id: res.id, success: true };
    } else {
      const res = await zite.clients.create({ record: fields });
      return { id: res.id, success: true };
    }
  },
});
