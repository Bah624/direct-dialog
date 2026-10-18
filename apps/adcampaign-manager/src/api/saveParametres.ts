import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { settings } from '../../../../server/src/settings';
import { MODULES, PROFILS } from '../../../../server/src/permissions';

const societeSchema = z
  .object({
    nom: z.string().min(1).optional(),
    slogan: z.string().optional(),
    adresse: z.string().optional(),
    telephone: z.string().optional(),
    email: z.string().optional(),
    logoUrl: z.string().optional(),
    devise: z.string().min(1).optional(),
    tauxTva: z.number().min(0).max(100).optional(),
  })
  .optional();

const accessSchema = z.object({ voir: z.boolean(), gerer: z.boolean() });

export default createEndpoint({
  description: 'Enregistrer les réglages (société, droits)',
  inputSchema: z.object({
    societe: societeSchema,
    permissions: z.record(z.string(), z.record(z.string(), accessSchema)).optional(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input }) => {
    if (input.societe) {
      const actuelle = await settings.societe();
      await settings.set('societe', { ...actuelle, ...input.societe });
    }

    if (input.permissions) {
      // On ne conserve que les profils connus et les modules connus.
      const propre: Record<string, Record<string, { voir: boolean; gerer: boolean }>> = {};
      for (const profil of PROFILS) {
        const source = (input.permissions as any)[profil];
        if (!source) continue;
        propre[profil] = {};
        for (const module of MODULES) {
          const acces = source[module];
          propre[profil][module] = {
            voir: Boolean(acces?.voir),
            // « gérer » implique de pouvoir consulter.
            gerer: Boolean(acces?.gerer),
          };
          if (propre[profil][module].gerer) propre[profil][module].voir = true;
        }
      }
      if (Object.keys(propre).length === 0) {
        throw new ZiteError({
          code: 'BAD_REQUEST',
          message: 'Aucun droit valide fourni.',
          userFacingMessage: 'Les droits transmis sont invalides.',
        });
      }
      await settings.set('permissions', propre);
    }

    return { success: true };
  },
});
