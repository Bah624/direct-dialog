import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'List stock inflows with article names',
  inputSchema: z.object({ articleId: z.string().optional(), limite: z.number().optional() }),
  outputSchema: z.object({
    entrees: z.array(
      z.object({
        id: z.string(),
        referenceEntree: z.union([z.string(), z.number()]).optional(),
        articleId: z.string().optional(),
        articleNom: z.string().optional(),
        quantiteEntree: z.number().optional(),
        fournisseur: z.string().optional(),
        motif: z.string().optional(),
        dateEntree: z.string().optional(),
        responsable: z.string().optional(),
        notes: z.string().optional(),
      }),
    ),
  }),
  execute: async ({ input }) => {
    const [{ records }, stock] = await Promise.all([
      zite.entreesDeStock.findAll({ limit: input.limite ?? 500 }),
      zite.stock.findAll({ limit: 500 }),
    ]);
    const articles = new Map(stock.records.map((a) => [a.id, a]));

    let entrees = records;
    if (input.articleId) {
      entrees = entrees.filter((e) => {
        const lien = Array.isArray(e.article) ? e.article[0] : e.article;
        return lien === input.articleId;
      });
    }

    return {
      entrees: entrees
        .slice()
        .sort((a, b) => String(b.dateEntree ?? '').localeCompare(String(a.dateEntree ?? '')))
        .map((e) => {
          const lien = Array.isArray(e.article) ? e.article[0] : e.article;
          return {
            id: e.id,
            referenceEntree: e.referenceEntree,
            articleId: lien,
            articleNom: lien ? articles.get(lien)?.nomArticle ?? articles.get(lien)?.referenceArticle : undefined,
            quantiteEntree: e.quantiteEntree,
            fournisseur: e.fournisseur,
            motif: e.motif,
            dateEntree: e.dateEntree,
            responsable: e.responsable,
            notes: e.notes,
          };
        }),
    };
  },
});
