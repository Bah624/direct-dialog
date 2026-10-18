import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';

export default createEndpoint({
  description: 'Supprimer un utilisateur',
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input }) => {
    const { records } = await zite.utilisateurs.findAll({ limit: 500 });
    const cible = records.find((u) => u.id === input.id);
    if (!cible) return { success: true };

    if (cible.profil === 'Administrateur') {
      const admins = records.filter((u) => u.profil === 'Administrateur' && u.statut !== 'Inactif');
      if (admins.length <= 1) {
        throw new ZiteError({
          code: 'BAD_REQUEST',
          message: 'Le dernier administrateur ne peut pas être supprimé.',
          userFacingMessage: 'Conservez au moins un administrateur.',
        });
      }
    }

    await zite.utilisateurs.delete({ id: input.id });

    // Si le profil actif a été supprimé, on bascule sur un administrateur.
    const { records: restants } = await zite.utilisateurs.findAll({ limit: 500 });
    const actif = await zite.parametres.findOne({ filters: { cle: 'profilActifId' } });
    const actifId = actif?.valeur ? JSON.parse(actif.valeur) : null;
    if (!actifId || !restants.some((u) => u.id === actifId)) {
      const admin = restants.find((u) => u.profil === 'Administrateur') ?? restants[0];
      if (admin) {
        const valeur = JSON.stringify(admin.id);
        if (actif) await zite.parametres.update({ id: actif.id, record: { cle: 'profilActifId', valeur } });
        else await zite.parametres.create({ record: { cle: 'profilActifId', valeur } });
      }
    }

    return { success: true };
  },
});
