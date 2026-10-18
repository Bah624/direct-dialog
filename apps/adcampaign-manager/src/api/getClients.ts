import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Get all clients',
  inputSchema: z.object({ search: z.string().optional() }),
  outputSchema: z.object({
    clients: z.array(z.object({
      id: z.string(),
      nomClient: z.string().optional(),
      email: z.string().optional(),
      telephone: z.string().optional(),
      adresse: z.string().optional(),
      secteurDactivite: z.string().optional(),
      statut: z.string().optional(),
      dateCreation: z.string().optional(),
    })),
  }),
  execute: async ({ input }) => {
    const result = await zite.clients.findAll({ limit: 500 });
    let clients = result.records;
    if (input.search) {
      const q = input.search.toLowerCase();
      clients = clients.filter(c =>
        c.nomClient?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.secteurDactivite?.toLowerCase().includes(q)
      );
    }
    return { clients: clients.map(c => ({ id: c.id, nomClient: c.nomClient, email: c.email, telephone: c.telephone, adresse: c.adresse, secteurDactivite: c.secteurDactivite, statut: c.statut, dateCreation: c.dateCreation })) };
  },
});
