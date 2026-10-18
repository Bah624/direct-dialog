import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Fetch all data for printing reports',
  inputSchema: z.object({}),
  outputSchema: z.object({
    clients: z.array(z.any()),
    campagnes: z.array(z.any()),
    emplacements: z.array(z.any()),
    reservations: z.array(z.any()),
    impressions: z.array(z.any()),
    factures: z.array(z.any()),
    stock: z.array(z.any()),
    sorties: z.array(z.any()),
    generatedAt: z.string(),
  }),
  execute: async () => {
    const [
      { records: clients },
      { records: campagnes },
      { records: emplacements },
      { records: reservations },
      { records: impressions },
      { records: factures },
      { records: stock },
      { records: sorties },
    ] = await Promise.all([
      zite.clients.findAll({ limit: 500 }),
      zite.campagnes.findAll({ limit: 500 }),
      zite.emplacements.findAll({ limit: 500 }),
      zite.reservations.findAll({ limit: 500 }),
      zite.impressions.findAll({ limit: 500 }),
      zite.factures.findAll({ limit: 500 }),
      zite.stock.findAll({ limit: 500 }),
      zite.sortiesDeStock.findAll({ limit: 500 }),
    ]);

    return {
      clients,
      campagnes,
      emplacements,
      reservations,
      impressions,
      factures,
      stock,
      sorties,
      generatedAt: new Date().toISOString(),
    };
  },
});
