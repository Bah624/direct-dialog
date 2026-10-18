import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Create or update an invoice',
  inputSchema: z.object({
    id: z.string().optional(),
    numeroFacture: z.string(),
    clientId: z.string().optional(),
    campagneId: z.string().optional(),
    dateEmission: z.string().optional(),
    dateEcheance: z.string().optional(),
    montantHt: z.number().optional(),
    tva: z.number().optional(),
    montantTtc: z.number().optional(),
    statutPaiement: z.string().optional(),
    notes: z.string().optional(),
    piecesJointes: z.array(z.object({ url: z.string() })).optional(),
  }),
  outputSchema: z.object({ id: z.string(), success: z.boolean() }),
  execute: async ({ input }) => {
    const { id, clientId, campagneId, ...rest } = input;
    const record = {
      ...rest,
      client: clientId ? [clientId] : undefined,
      campagne: campagneId ? [campagneId] : undefined,
    };
    if (id) {
      const res = await zite.factures.update({ id, record });
      return { id: res.id, success: true };
    } else {
      const res = await zite.factures.create({ record });
      return { id: res.id, success: true };
    }
  },
});
