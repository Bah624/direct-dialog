import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { hasherMotDePasse, validerMotDePasse, verifierMotDePasse } from '../../../../server/src/auth';
import { utilisateurActif } from '../../../../server/src/access';

export default createEndpoint({
  description: 'Changer son propre mot de passe',
  inputSchema: z.object({
    ancien: z.string(),
    nouveau: z.string(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input }) => {
    const connecte = utilisateurActif();
    if (!connecte) {
      throw new ZiteError({ code: 'UNAUTHORIZED', message: 'Non authentifié.' });
    }

    const utilisateur = await zite.utilisateurs.findOne({ id: connecte.id });
    if (!utilisateur) {
      throw new ZiteError({ code: 'UNAUTHORIZED', message: 'Compte introuvable.' });
    }
    if (!verifierMotDePasse(input.ancien, utilisateur.motDePasseHash)) {
      throw new ZiteError({
        code: 'BAD_REQUEST',
        message: 'Mot de passe actuel incorrect.',
        userFacingMessage: 'Le mot de passe actuel est incorrect.',
      });
    }

    const erreur = validerMotDePasse(input.nouveau);
    if (erreur) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: erreur, userFacingMessage: erreur });
    }
    if (input.ancien === input.nouveau) {
      throw new ZiteError({
        code: 'BAD_REQUEST',
        message: 'Le nouveau mot de passe doit être différent de l’ancien.',
        userFacingMessage: 'Choisissez un mot de passe différent.',
      });
    }

    await zite.utilisateurs.update({
      id: utilisateur.id,
      record: {
        motDePasseHash: hasherMotDePasse(input.nouveau),
        doitChangerMotDePasse: false,
      },
    });

    return { success: true };
  },
});
