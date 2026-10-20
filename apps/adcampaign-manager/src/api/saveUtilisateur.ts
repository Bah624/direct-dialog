import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { PROFILS } from '../../../../server/src/permissions';
import { hasherMotDePasse, validerMotDePasse } from '../../../../server/src/auth';

const utilisateurInput = z.object({
  id: z.string().optional(),
  nomComplet: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Adresse e-mail invalide'),
  telephone: z.string().optional(),
  profil: z.string().min(1, 'Le profil est requis'),
  statut: z.string().default('Actif'),
  notes: z.string().optional(),
  /** Obligatoire à la création ; facultatif en modification (réinitialisation). */
  motDePasse: z.string().optional(),
});

export default createEndpoint({
  description: 'Créer ou modifier un utilisateur',
  inputSchema: utilisateurInput,
  outputSchema: z.object({ id: z.string(), success: z.boolean() }),
  execute: async ({ input }) => {
    if (!PROFILS.includes(input.profil as any)) {
      throw new ZiteError({
        code: 'BAD_REQUEST',
        message: `Profil inconnu : ${input.profil}`,
        userFacingMessage: 'Choisissez un profil valide.',
      });
    }

    const { records } = await zite.utilisateurs.findAll({ limit: 500 });
    const email = input.email.trim().toLowerCase();
    const doublon = records.find(
      (u) => u.id !== input.id && (u.email ?? '').trim().toLowerCase() === email,
    );
    if (doublon) {
      throw new ZiteError({
        code: 'BAD_REQUEST',
        message: 'Cette adresse e-mail est déjà utilisée.',
        userFacingMessage: 'Un utilisateur possède déjà cette adresse e-mail.',
      });
    }

    // On ne doit jamais perdre le dernier administrateur actif.
    const adminsActifs = records.filter((u) => u.profil === 'Administrateur' && u.statut !== 'Inactif');
    const cible = input.id ? records.find((u) => u.id === input.id) : undefined;
    const concerneAdmin = cible?.profil === 'Administrateur';
    const devientNonAdmin = input.profil !== 'Administrateur' || input.statut === 'Inactif';
    if (concerneAdmin && devientNonAdmin && adminsActifs.length <= 1) {
      throw new ZiteError({
        code: 'BAD_REQUEST',
        message: 'Le dernier administrateur actif ne peut pas être rétrogradé ou désactivé.',
        userFacingMessage: 'Conservez au moins un administrateur actif.',
      });
    }

    const record: Record<string, any> = {
      nomComplet: input.nomComplet.trim(),
      email,
      telephone: input.telephone ?? '',
      profil: input.profil,
      statut: input.statut,
      notes: input.notes ?? '',
    };

    if (input.motDePasse) {
      const erreur = validerMotDePasse(input.motDePasse);
      if (erreur) {
        throw new ZiteError({ code: 'BAD_REQUEST', message: erreur, userFacingMessage: erreur });
      }
      record.motDePasseHash = hasherMotDePasse(input.motDePasse);
      record.doitChangerMotDePasse = true;
    } else if (!input.id) {
      throw new ZiteError({
        code: 'BAD_REQUEST',
        message: 'Un mot de passe est requis à la création.',
        userFacingMessage: 'Définissez un mot de passe initial.',
      });
    }

    if (input.id) {
      const res = await zite.utilisateurs.update({ id: input.id, record });
      return { id: res.id, success: true };
    }

    const cree = await zite.utilisateurs.create({ record });
    return { id: cree.id, success: true };
  },
});
