import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Record a stock inflow and increment stock quantity',
  inputSchema: z.object({
    articleId: z.string(),
    quantiteEntree: z.number().positive(),
    fournisseur: z.string().optional(),
    motif: z.string().optional(),
    dateEntree: z.string().optional(),
    responsable: z.string().optional(),
    notes: z.string().optional(),
  }),
  outputSchema: z.object({ id: z.string(), success: z.boolean(), newQuantite: z.number() }),
  execute: async ({ input }) => {
    const article = await zite.stock.findOne({ id: input.articleId });
    if (!article) throw new Error('Article introuvable');

    const quantite = article.quantiteEnStock ?? 0;
    const newQuantite = quantite + input.quantiteEntree;

    const entree = await zite.entreesDeStock.create({
      record: {
        article: [input.articleId],
        quantiteEntree: input.quantiteEntree,
        fournisseur: input.fournisseur,
        motif: input.motif,
        dateEntree: input.dateEntree ?? new Date().toISOString().slice(0, 10),
        responsable: input.responsable,
        notes: input.notes,
      },
    });

    const statutStock =
      newQuantite === 0
        ? 'Rupture de stock'
        : article.seuilDAlerte && newQuantite <= article.seuilDAlerte
          ? 'Stock faible'
          : 'En stock';

    await zite.stock.update({
      id: input.articleId,
      record: {
        quantiteEnStock: newQuantite,
        statutStock,
        dernierApprovisionnement: input.dateEntree ?? new Date().toISOString().slice(0, 10),
      },
    });

    return { id: entree.id, success: true, newQuantite };
  },
});
