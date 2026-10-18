import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';

export default createEndpoint({
  description: 'Liste des utilisateurs de l’application',
  inputSchema: z.object({ search: z.string().optional() }),
  outputSchema: z.object({
    utilisateurs: z.array(
      z.object({
        id: z.string(),
        nomComplet: z.string().optional(),
        email: z.string().optional(),
        telephone: z.string().optional(),
        profil: z.string().optional(),
        statut: z.string().optional(),
        notes: z.string().optional(),
        derniereConnexion: z.string().optional(),
        dateCreation: z.string().optional(),
      }),
    ),
  }),
  execute: async ({ input }) => {
    const { records } = await zite.utilisateurs.findAll({ limit: 500 });
    let utilisateurs = records;

    if (input.search) {
      const q = input.search.toLowerCase();
      utilisateurs = utilisateurs.filter(
        (u) =>
          u.nomComplet?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.profil?.toLowerCase().includes(q),
      );
    }

    return {
      utilisateurs: utilisateurs
        .slice()
        .sort((a, b) => (a.nomComplet ?? '').localeCompare(b.nomComplet ?? ''))
        .map((u) => ({
          id: u.id,
          nomComplet: u.nomComplet,
          email: u.email,
          telephone: u.telephone,
          profil: u.profil,
          statut: u.statut,
          notes: u.notes,
          derniereConnexion: u.derniereConnexion,
          dateCreation: u.dateCreation,
        })),
    };
  },
});
