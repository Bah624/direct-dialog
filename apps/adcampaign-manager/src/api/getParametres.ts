import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';
import { settings } from '../../../../server/src/settings';
import { MODULES, PROFILS } from '../../../../server/src/permissions';
import { utilisateurActif } from '../../../../server/src/access';

const societeSchema = z.object({
  nom: z.string(),
  slogan: z.string(),
  adresse: z.string(),
  telephone: z.string(),
  email: z.string(),
  logoUrl: z.string(),
  devise: z.string(),
  tauxTva: z.number(),
});

const utilisateurLeger = z.object({
  id: z.string(),
  nomComplet: z.string().optional(),
  email: z.string().optional(),
  profil: z.string().optional(),
  statut: z.string().optional(),
});

export default createEndpoint({
  description: 'Réglages, droits et profil actif de l’application',
  inputSchema: z.object({}).optional(),
  outputSchema: z.object({
    societe: societeSchema,
    permissions: z.record(z.string(), z.record(z.string(), z.object({ voir: z.boolean(), gerer: z.boolean() }))),
    profils: z.array(z.string()),
    modules: z.array(z.string()),
    profilActif: utilisateurLeger.nullable(),
    utilisateurs: z.array(utilisateurLeger),
    statistiques: z.record(z.string(), z.number()),
  }),
  execute: async () => {
    const [societe, permissions, profil, { records: utilisateurs }] = await Promise.all([
      settings.societe(),
      settings.permissions(),
      utilisateurActif(),
      zite.utilisateurs.findAll({ limit: 500 }),
    ]);

    const compter = async (table: any) => {
      try {
        const { records } = await table.findAll({ limit: 2000, fields: ['id'] });
        return records.length;
      } catch {
        return 0;
      }
    };

    const [clients, campagnes, emplacements, reservations, impressions, factures, stock, collaborateurs] =
      await Promise.all([
        compter(zite.clients),
        compter(zite.campagnes),
        compter(zite.emplacements),
        compter(zite.reservations),
        compter(zite.impressions),
        compter(zite.factures),
        compter(zite.stock),
        compter(zite.collaborateurs),
      ]);

    return {
      societe,
      permissions: permissions as any,
      profils: [...PROFILS],
      modules: [...MODULES],
      profilActif: profil
        ? {
            id: profil.id,
            nomComplet: profil.nomComplet,
            email: profil.email,
            profil: profil.profil,
            statut: profil.statut,
          }
        : null,
      utilisateurs: utilisateurs.map((u) => ({
        id: u.id,
        nomComplet: u.nomComplet,
        email: u.email,
        profil: u.profil,
        statut: u.statut,
      })),
      statistiques: {
        clients,
        campagnes,
        emplacements,
        reservations,
        impressions,
        factures,
        stock,
        collaborateurs,
        utilisateurs: utilisateurs.length,
      },
    };
  },
});
