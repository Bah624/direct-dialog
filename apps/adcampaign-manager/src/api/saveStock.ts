import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Create or update a stock item',
  inputSchema: z.object({
    id: z.string().optional(),
    referenceArticle: z.string(),
    nomArticle: z.string().optional(),
    categorie: z.string().optional(),
    unite: z.string().optional(),
    quantiteEnStock: z.number().optional(),
    seuilDAlerte: z.number().optional(),
    prixUnitaire: z.number().optional(),
    fournisseur: z.string().optional(),
    dernierApprovisionnement: z.string().optional(),
    statutStock: z.string().optional(),
    notes: z.string().optional(),
  }),
  outputSchema: z.object({ id: z.string(), success: z.boolean() }),
  execute: async ({ input }) => {
    const { id, dernierApprovisionnement, ...rest } = input;
    // Strip time portion from date field — database expects YYYY-MM-DD only
    const record = {
      ...rest,
      dernierApprovisionnement: dernierApprovisionnement
        ? dernierApprovisionnement.split('T')[0]
        : undefined,
    };
    if (id) {
      const res = await zite.stock.update({ id, record });
      return { id: res.id, success: true };
    } else {
      const res = await zite.stock.create({ record });
      return { id: res.id, success: true };
    }
  },
});
