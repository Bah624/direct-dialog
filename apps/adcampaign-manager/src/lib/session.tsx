// Session applicative : utilisateur connecté, droits, réglages société.
//
// L'utilisateur est authentifié par le serveur (cookie de session). Tant que la
// session est absente ou expirée, l'application affiche l'écran de connexion.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getParametres, GetParametresOutputType } from 'zitejs/api';

type Session = {
  pret: boolean;
  data: GetParametresOutputType | null;
  utilisateur: GetParametresOutputType['utilisateur'];
  /** Vérifie un droit ; tant que les réglages ne sont pas chargés, on laisse passer. */
  permis: (module: string, action?: 'voir' | 'gerer') => boolean;
  rafraichir: () => Promise<void>;
  connecter: (email: string, motDePasse: string) => Promise<void>;
  deconnecter: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<GetParametresOutputType | null>(null);
  const [pret, setPret] = useState(false);

  const rafraichir = useCallback(async () => {
    try {
      const resultat = await getParametres({});
      setData(resultat);
    } catch {
      // 401 : session absente ou expirée.
      setData(null);
    } finally {
      setPret(true);
    }
  }, []);

  useEffect(() => {
    rafraichir();
  }, [rafraichir]);

  const connecter = useCallback(
    async (email: string, motDePasse: string) => {
      const reponse = await fetch('/api/auth/connexion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, motDePasse }),
      });
      const corps = await reponse.json().catch(() => ({}));
      if (!reponse.ok) {
        throw new Error(corps?.message ?? 'Connexion impossible.');
      }
      await rafraichir();
    },
    [rafraichir],
  );

  const deconnecter = useCallback(async () => {
    try {
      await fetch('/api/auth/deconnexion', { method: 'POST' });
    } finally {
      setData(null);
    }
  }, []);

  const valeur = useMemo<Session>(() => {
    const profil = data?.utilisateur?.profil;

    const permis = (module: string, action: 'voir' | 'gerer' = 'voir') => {
      if (!data) return true;
      if (!profil) return true;
      if (profil === 'Administrateur') return true;
      const acces = data.permissions?.[profil]?.[module];
      if (!acces) return false;
      return action === 'gerer' ? Boolean(acces.gerer) : Boolean(acces.voir);
    };

    return {
      pret,
      data,
      utilisateur: data?.utilisateur ?? null,
      permis,
      rafraichir,
      connecter,
      deconnecter,
    };
  }, [data, pret, rafraichir, connecter, deconnecter]);

  return <SessionContext.Provider value={valeur}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const contexte = useContext(SessionContext);
  if (!contexte) throw new Error('useSession doit être utilisé dans un SessionProvider');
  return contexte;
}
