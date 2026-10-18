import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { settings } from '../../../../server/src/settings';

export default createEndpoint({
  description: 'Choisir le profil utilisateur actif',
  inputSchema: z.object({ utilisateurId: z.string() }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input }) => {
    const utilisateur = await zite.utilisateurs.findOne({ id: input.utilisateurId });
    if (!utilisateur) {
      throw new ZiteError({
        code: 'BAD_REQUEST',
        message: 'Utilisateur inconnu.',
        userFacingMessage: 'Ce profil n’existe pas.',
      });
    }
    if (utilisateur.statut === 'Inactif') {
      throw new ZiteError({
        code: 'BAD_REQUEST',
        message: 'Ce profil est désactivé.',
        userFacingMessage: 'Choisissez un profil actif.',
      });
    }

    await settings.set('profilActifId', utilisateur.id);
    await zite.utilisateurs.update({
      id: utilisateur.id,
      record: { derniereConnexion: new Date().toISOString().slice(0, 10) },
    });

    return { success: true };
  },
});
