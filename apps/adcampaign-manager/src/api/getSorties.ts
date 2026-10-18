import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Get all stock outflows with article info',
  inputSchema: z.object({ articleId: z.string().optional() }),
  outputSchema: z.object({
    sorties: z.array(z.object({
      id: z.string(),
      referenceSortie: z.any().optional(),
      articleId: z.string().optional(),
      articleNom: z.string().optional(),
      articleRef: z.string().optional(),
      unite: z.string().optional(),
      quantiteSortie: z.number().optional(),
      motif: z.string().optional(),
      dateSortie: z.string().optional(),
      responsable: z.string().optional(),
      notes: z.string().optional(),
      dateEnregistrement: z.string().optional(),
    })),
  }),
  execute: async ({ input }) => {
    const [sortiesRes, stockRes] = await Promise.all([
      zite.sortiesDeStock.findAll({ limit: 500 }),
      zite.stock.findAll({ limit: 500, fields: ['id', 'nomArticle', 'referenceArticle', 'unite'] }),
    ]);

    const articleMap = new Map(stockRes.records.map(s => [s.id, s]));

    let sorties = sortiesRes.records;
    if (input.articleId) {
      sorties = sorties.filter(s => {
        const id = Array.isArray(s.article) ? s.article[0] : s.article;
        return id === input.articleId;
      });
    }

    // Sort by date descending
    sorties.sort((a, b) => {
      const da = a.dateEnregistrement ?? a.dateSortie ?? '';
      const db = b.dateEnregistrement ?? b.dateSortie ?? '';
      return db.localeCompare(da);
    });

    return {
      sorties: sorties.map(s => {
        const articleId = Array.isArray(s.article) ? s.article[0] : s.article;
        const art = articleId ? articleMap.get(articleId) : undefined;
        return {
          id: s.id,
          referenceSortie: s.referenceSortie,
          articleId,
          articleNom: art?.nomArticle,
          articleRef: art?.referenceArticle,
          unite: art?.unite,
          quantiteSortie: s.quantiteSortie,
          motif: s.motif,
          dateSortie: s.dateSortie,
          responsable: s.responsable,
          notes: s.notes,
          dateEnregistrement: s.dateEnregistrement,
        };
      }),
    };
  },
});
