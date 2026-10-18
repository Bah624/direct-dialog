import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Create or update a reservation',
  inputSchema: z.object({
    id: z.string().optional(),
    referenceReservation: z.string(),
    campagneId: z.string().optional(),
    emplacementId: z.string().optional(),
    dateDebut: z.string().optional(),
    dateFin: z.string().optional(),
    statut: z.string().optional(),
    montant: z.number().optional(),
  }),
  outputSchema: z.object({ id: z.string(), success: z.boolean() }),
  execute: async ({ input }) => {
    const { id, campagneId, emplacementId, ...rest } = input;
    const record = {
      ...rest,
      campagne: campagneId ? [campagneId] : undefined,
      emplacement: emplacementId ? [emplacementId] : undefined,
    };
    if (id) {
      const res = await zite.reservations.update({ id, record });
      return { id: res.id, success: true };
    } else {
      const res = await zite.reservations.create({ record });
      return { id: res.id, success: true };
    }
  },
});
