import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Get all reservations',
  inputSchema: z.object({ statut: z.string().optional() }),
  outputSchema: z.object({
    reservations: z.array(z.object({
      id: z.string(),
      referenceReservation: z.string().optional(),
      campagneId: z.string().optional(),
      campagneNom: z.string().optional(),
      emplacementId: z.string().optional(),
      emplacementRef: z.string().optional(),
      emplacementVille: z.string().optional(),
      dateDebut: z.string().optional(),
      dateFin: z.string().optional(),
      statut: z.string().optional(),
      montant: z.number().optional(),
    })),
    campagnes: z.array(z.object({ id: z.string(), nomCampagne: z.string().optional() })),
    emplacements: z.array(z.object({ id: z.string(), referenceEmplacement: z.string().optional(), ville: z.string().optional() })),
  }),
  execute: async ({ input }) => {
    const [resRes, campRes, empRes] = await Promise.all([
      zite.reservations.findAll({ limit: 500 }),
      zite.campagnes.findAll({ limit: 500, fields: ['id', 'nomCampagne'] }),
      zite.emplacements.findAll({ limit: 500, fields: ['id', 'referenceEmplacement', 'ville'] }),
    ]);
    const campMap = new Map(campRes.records.map(c => [c.id, c.nomCampagne]));
    const empMap = new Map(empRes.records.map(e => [e.id, e]));
    let reservations = resRes.records;
    if (input.statut) reservations = reservations.filter(r => r.statut === input.statut);
    return {
      reservations: reservations.map(r => {
        const campagneId = Array.isArray(r.campagne) ? r.campagne[0] : r.campagne;
        const emplacementId = Array.isArray(r.emplacement) ? r.emplacement[0] : r.emplacement;
        const emp = emplacementId ? empMap.get(emplacementId) : undefined;
        return {
          id: r.id,
          referenceReservation: r.referenceReservation,
          campagneId,
          campagneNom: campagneId ? campMap.get(campagneId) : undefined,
          emplacementId,
          emplacementRef: emp?.referenceEmplacement,
          emplacementVille: emp?.ville,
          dateDebut: r.dateDebut,
          dateFin: r.dateFin,
          statut: r.statut,
          montant: r.montant,
        };
      }),
      campagnes: campRes.records.map(c => ({ id: c.id, nomCampagne: c.nomCampagne })),
      emplacements: empRes.records.map(e => ({ id: e.id, referenceEmplacement: e.referenceEmplacement, ville: e.ville })),
    };
  },
});
