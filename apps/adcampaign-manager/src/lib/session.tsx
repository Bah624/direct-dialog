// Session applicative : profil actif, droits, réglages société.
//
// L'application est mono-utilisateur : le profil actif est un réglage côté
// serveur, choisi dans la barre latérale. Toutes les pages s'appuient sur ce
// contexte pour filtrer les menus et les actions.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getParametres, setProfilActif, GetParametresOutputType } from 'zitejs/api';

type Session = {
  pret: boolean;
  data: GetParametresOutputType | null;
  profilActif: GetParametresOutputType['profilActif'];
  /** Vérifie un droit ; tant que les réglages ne sont pas chargés, on laisse passer. */
  permis: (module: string, action?: 'voir' | 'gerer') => boolean;
  rafraichir: () => Promise<void>;
  changerProfil: (utilisateurId: string) => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<GetParametresOutputType | null>(null);
  const [pret, setPret] = useState(false);

  const rafraichir = useCallback(async () => {
    try {
      const resultat = await getParametres({});
      setData(resultat);
    } catch (erreur) {
      console.error('Chargement des paramètres impossible', erreur);
    } finally {
      setPret(true);
    }
  }, []);

  useEffect(() => {
    rafraichir();
  }, [rafraichir]);

  const changerProfil = useCallback(
    async (utilisateurId: string) => {
      await setProfilActif({ utilisateurId });
      await rafraichir();
    },
    [rafraichir],
  );

  const valeur = useMemo<Session>(() => {
    const profil = data?.profilActif?.profil;

    const permis = (module: string, action: 'voir' | 'gerer' = 'voir') => {
      if (!data) return true;
      if (!profil) return true;
      // Le profil administrateur garde toujours l'accès complet.
      if (profil === 'Administrateur') return true;
      const acces = data.permissions?.[profil]?.[module];
      if (!acces) return false;
      return action === 'gerer' ? Boolean(acces.gerer) : Boolean(acces.voir);
    };

    return {
      pret,
      data,
      profilActif: data?.profilActif ?? null,
      permis,
      rafraichir,
      changerProfil,
    };
  }, [data, pret, rafraichir, changerProfil]);

  return <SessionContext.Provider value={valeur}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const contexte = useContext(SessionContext);
  if (!contexte) throw new Error('useSession doit être utilisé dans un SessionProvider');
  return contexte;
}
