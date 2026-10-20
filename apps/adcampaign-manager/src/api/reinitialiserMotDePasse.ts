import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { detruireSessionsDe, hasherMotDePasse, validerMotDePasse } from '../../../../server/src/auth';

export default createEndpoint({
  description: 'Réinitialiser le mot de passe d’un utilisateur (administrateur)',
  inputSchema: z.object({
    utilisateurId: z.string(),
    motDePasse: z.string(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input }) => {
    const utilisateur = await zite.utilisateurs.findOne({ id: input.utilisateurId });
    if (!utilisateur) {
      throw new ZiteError({
        code: 'BAD_REQUEST',
        message: 'Utilisateur inconnu.',
        userFacingMessage: 'Cet utilisateur n’existe pas.',
      });
    }

    const erreur = validerMotDePasse(input.motDePasse);
    if (erreur) {
      throw new ZiteError({ code: 'BAD_REQUEST', message: erreur, userFacingMessage: erreur });
    }

    await zite.utilisateurs.update({
      id: utilisateur.id,
      record: {
        motDePasseHash: hasherMotDePasse(input.motDePasse),
        doitChangerMotDePasse: true,
      },
    });

    // On coupe les sessions ouvertes : le nouveau mot de passe doit être utilisé.
    await detruireSessionsDe(utilisateur.id);

    return { success: true };
  },
});
