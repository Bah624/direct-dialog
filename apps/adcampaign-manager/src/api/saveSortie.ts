import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Record a stock outflow and decrement stock quantity',
  inputSchema: z.object({
    articleId: z.string(),
    quantiteSortie: z.number().positive(),
    motif: z.string().optional(),
    dateSortie: z.string().optional(),
    responsable: z.string().optional(),
    notes: z.string().optional(),
  }),
  outputSchema: z.object({ id: z.string(), success: z.boolean(), newQuantite: z.number() }),
  execute: async ({ input }) => {
    // 1. Get current stock quantity
    const article = await zite.stock.findOne({ id: input.articleId });
    if (!article) throw new Error('Article introuvable');

    const currentQty = article.quantiteEnStock ?? 0;
    const newQuantite = Math.max(0, currentQty - input.quantiteSortie);

    // 2. Create the sortie record
    const sortie = await zite.sortiesDeStock.create({
      record: {
        article: [input.articleId],
        quantiteSortie: input.quantiteSortie,
        motif: input.motif,
        dateSortie: input.dateSortie,
        responsable: input.responsable,
        notes: input.notes,
      },
    });

    // 3. Update stock quantity and status
    const statutStock =
      newQuantite === 0
        ? 'Rupture de stock'
        : article.seuilDAlerte && newQuantite <= article.seuilDAlerte
        ? 'Stock faible'
        : 'En stock';

    await zite.stock.update({
      id: input.articleId,
      record: { quantiteEnStock: newQuantite, statutStock },
    });

    return { id: sortie.id, success: true, newQuantite };
  },
});
