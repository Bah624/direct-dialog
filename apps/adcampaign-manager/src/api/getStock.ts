import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Get all stock items',
  inputSchema: z.object({
    categorie: z.string().optional(),
    statut: z.string().optional(),
  }),
  outputSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      referenceArticle: z.string().optional(),
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
    })),
  }),
  execute: async ({ input }) => {
    const res = await zite.stock.findAll({ limit: 500 });
    let items = res.records;
    if (input.categorie) items = items.filter(i => i.categorie === input.categorie);
    if (input.statut) items = items.filter(i => i.statutStock === input.statut);
    return {
      items: items.map(i => ({
        id: i.id,
        referenceArticle: i.referenceArticle,
        nomArticle: i.nomArticle,
        categorie: i.categorie,
        unite: i.unite,
        quantiteEnStock: i.quantiteEnStock,
        seuilDAlerte: i.seuilDAlerte,
        prixUnitaire: i.prixUnitaire,
        fournisseur: i.fournisseur,
        dernierApprovisionnement: i.dernierApprovisionnement,
        statutStock: i.statutStock,
        notes: i.notes,
      })),
    };
  },
});
