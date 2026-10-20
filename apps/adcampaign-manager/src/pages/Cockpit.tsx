import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getDashboard,
  getEmplacements,
  getReservations,
  GetDashboardOutputType,
  GetEmplacementsOutputType,
} from 'zitejs/api';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import { Skeleton } from '@project/components/ui/skeleton';
import {
  CalendarCheck, Crosshair, ExternalLink, Loader2, MapPin, Megaphone,
  Printer, RotateCw, TrendingUp, AlertTriangle,
} from 'lucide-react';
import { creerScene, type Panneau, type SceneHandle } from '@/components/cockpit/scene';
import { useSession } from '@/lib/session';

type Emplacement = GetEmplacementsOutputType['emplacements'][0];

const DISPOS = ['Disponible', 'Réservé', 'Occupé', 'En maintenance'] as const;

const COULEUR_DISPO: Record<string, string> = {
  Disponible: 'bg-emerald-500',
  Réservé: 'bg-amber-500',
  Occupé: 'bg-red-500',
  'En maintenance': 'bg-slate-400',
};

const TEXTE_DISPO: Record<string, string> = {
  Disponible: 'text-emerald-400',
  Réservé: 'text-amber-400',
  Occupé: 'text-red-400',
  'En maintenance': 'text-slate-300',
};

function webglDisponible(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function CockpitPage() {
  const { data } = useSession();
  const devise = data?.societe?.devise ?? 'GNF';

  const conteneur = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);

  const [emplacements, setEmplacements] = useState<Emplacement[]>([]);
  const [dashboard, setDashboard] = useState<GetDashboardOutputType | null>(null);
  const [reservationsEnAttente, setReservationsEnAttente] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [indisponible, setIndisponible] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  const [rotation, setRotation] = useState(true);
  const [filtre, setFiltre] = useState<string | null>(null);
  const [heure, setHeure] = useState(new Date());

  // --- Chargement des données ---------------------------------------------
  useEffect(() => {
    let annule = false;
    (async () => {
      const [reponseEmplacements, reponseDashboard, reponseReservations] = await Promise.allSettled([
        getEmplacements({}),
        getDashboard({}),
        getReservations({}),
      ]);
      if (annule) return;

      if (reponseEmplacements.status === 'fulfilled') {
        setEmplacements(reponseEmplacements.value.emplacements as Emplacement[]);
      } else {
        setIndisponible(true);
      }
      if (reponseDashboard.status === 'fulfilled') setDashboard(reponseDashboard.value);
      if (reponseReservations.status === 'fulfilled') {
        const enAttente = reponseReservations.value.reservations.filter(
          (r) => r.statut === 'En attente',
        ).length;
        setReservationsEnAttente(enAttente);
      }
      setChargement(false);
    })();
    return () => {
      annule = true;
    };
  }, []);

  // --- Horloge --------------------------------------------------------------
  useEffect(() => {
    const timer = setInterval(() => setHeure(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const panneaux = useMemo<Panneau[]>(
    () =>
      emplacements.map((e) => ({
        id: e.id,
        reference: e.referenceEmplacement ?? '—',
        localisation: e.localisation,
        ville: e.ville,
        type: e.type,
        format: e.format,
        prixParSemaine: e.prixParSemaine,
        disponibilite: e.disponibilite,
      })),
    [emplacements],
  );

  // --- Scène 3D -------------------------------------------------------------
  useEffect(() => {
    if (!conteneur.current || panneaux.length === 0) return;
    if (!webglDisponible()) {
      setIndisponible(true);
      return;
    }
    const handle = creerScene(conteneur.current, panneaux, {
      rotation: true,
      onSelect: (id) => setSelection(id),
    });
    sceneRef.current = handle;
    return () => {
      handle.dispose();
      sceneRef.current = null;
    };
  }, [panneaux]);

  useEffect(() => {
    sceneRef.current?.setRotation(rotation);
  }, [rotation]);

  useEffect(() => {
    sceneRef.current?.setFiltre(filtre);
  }, [filtre]);

  const selectionne = emplacements.find((e) => e.id === selection) ?? null;

  const choisir = (id: string | null) => {
    setSelection(id);
    sceneRef.current?.focus(id);
    if (id) setRotation(false);
  };

  const stats = [
    {
      libelle: "Chiffre d'affaires",
      valeur: `${(dashboard?.chiffreAffaires ?? 0).toLocaleString('fr-FR')} ${devise}`,
      icone: TrendingUp,
      teinte: 'text-emerald-400',
    },
    {
      libelle: 'Campagnes en cours',
      valeur: String(dashboard?.campagnesEnCours ?? 0),
      icone: Megaphone,
      teinte: 'text-sky-400',
    },
    {
      libelle: 'Réservations en attente',
      valeur: String(reservationsEnAttente),
      icone: CalendarCheck,
      teinte: 'text-amber-400',
    },
    {
      libelle: 'Travaux planifiés',
      valeur: String(dashboard?.impressionsPlanifiees ?? 0),
      icone: Printer,
      teinte: 'text-violet-400',
    },
  ];

  const compte = (dispo: string) => emplacements.filter((e) => e.disponibilite === dispo).length;

  return (
    <div className="relative -m-4 md:-m-6 h-[calc(100vh-3.5rem)] overflow-hidden bg-[#050b18] text-white">
      {/* Scène */}
      <div ref={conteneur} className="absolute inset-0" />

      {/* Dégradés de lisibilité */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(5,11,24,0.85)_100%)]" />

      {chargement && (
        <div className="absolute inset-0 grid place-items-center bg-[#050b18]">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            Chargement du cockpit…
          </div>
        </div>
      )}

      {indisponible && !chargement && (
        <div className="absolute inset-0 grid place-items-center p-6">
          <div className="max-w-md text-center space-y-3 rounded-xl border border-white/10 bg-slate-900/80 p-6">
            <AlertTriangle className="w-9 h-9 mx-auto text-amber-400" />
            <p className="font-semibold">Cockpit 3D indisponible</p>
            <p className="text-sm text-slate-400">
              Votre navigateur ne prend pas en charge WebGL, ou votre profil n’a pas accès aux
              emplacements. La gestion classique reste disponible.
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link to="/emplacements">Ouvrir les emplacements</Link>
            </Button>
          </div>
        </div>
      )}

      {/* En-tête */}
      <div className="absolute top-4 left-4 md:top-6 md:left-6 flex items-start gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-sky-400/80">Direct Dialog</p>
          <h1 className="text-xl md:text-2xl font-semibold leading-tight">Cockpit 3D</h1>
          <p className="text-xs text-slate-400">
            Réseau d’affichage en temps réel · {emplacements.length} emplacement(s)
          </p>
        </div>
      </div>

      <div className="absolute top-4 right-4 md:top-6 md:right-6 flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 backdrop-blur">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs tabular-nums text-slate-300">
            {heure.toLocaleTimeString('fr-FR')}
          </span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={() => setRotation((v) => !v)}
          title={rotation ? 'Arrêter la rotation' : 'Reprendre la rotation'}
        >
          <RotateCw className={`w-4 h-4 ${rotation ? 'text-sky-400' : ''}`} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={() => choisir(null)}
          title="Recentrer la vue"
        >
          <Crosshair className="w-4 h-4" />
        </Button>
      </div>

      {/* KPI */}
      <div className="absolute left-4 md:left-6 top-28 md:top-32 hidden lg:flex flex-col gap-3 w-56">
        {stats.map(({ libelle, valeur, icone: Icone, teinte }) => (
          <div
            key={libelle}
            className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 backdrop-blur-md"
          >
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
              <Icone className={`w-3.5 h-3.5 ${teinte}`} />
              {libelle}
            </div>
            <p className="mt-1 text-lg font-semibold tabular-nums">{valeur}</p>
          </div>
        ))}
      </div>

      {/* Liste des emplacements */}
      <div className="absolute right-4 md:right-6 top-28 md:top-32 w-72 md:w-80 hidden md:flex flex-col gap-3">
        <div className="rounded-xl border border-white/10 bg-slate-900/70 backdrop-blur-md overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <p className="text-sm font-medium">Emplacements</p>
            <span className="text-[11px] text-slate-400">{emplacements.length}</span>
          </div>

          <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-white/10">
            <button
              onClick={() => setFiltre(null)}
              className={`text-[11px] rounded-full px-2 py-1 transition ${
                !filtre ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              Tous
            </button>
            {DISPOS.map((d) => (
              <button
                key={d}
                onClick={() => setFiltre(filtre === d ? null : d)}
                className={`text-[11px] rounded-full px-2 py-1 transition ${
                  filtre === d ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="max-h-64 overflow-y-auto">
            {emplacements
              .filter((e) => !filtre || e.disponibilite === filtre)
              .map((e) => (
                <button
                  key={e.id}
                  onClick={() => choisir(e.id)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition hover:bg-white/5 ${
                    selection === e.id ? 'bg-white/10' : ''
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      COULEUR_DISPO[e.disponibilite ?? ''] ?? 'bg-sky-400'
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium truncate">
                      {e.referenceEmplacement}
                    </span>
                    <span className="block text-[11px] text-slate-400 truncate">
                      {e.ville} · {e.type}
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {(e.prixParSemaine ?? 0).toLocaleString('fr-FR')}
                  </span>
                </button>
              ))}
            {emplacements.length === 0 && (
              <p className="px-4 py-6 text-xs text-slate-400 text-center">
                Aucun emplacement enregistré.
              </p>
            )}
          </div>
        </div>

        {selectionne && (
          <div className="rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{selectionne.referenceEmplacement}</p>
                <p className="text-[11px] text-slate-400">
                  {selectionne.localisation} · {selectionne.ville}
                </p>
              </div>
              <Badge
                variant="outline"
                className={`border-white/10 ${TEXTE_DISPO[selectionne.disponibilite ?? ''] ?? 'text-sky-400'}`}
              >
                {selectionne.disponibilite}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <Info libelle="Type" valeur={selectionne.type ?? '—'} />
              <Info libelle="Format" valeur={selectionne.format ?? '—'} />
              <Info
                libelle="Prix / semaine"
                valeur={`${(selectionne.prixParSemaine ?? 0).toLocaleString('fr-FR')} ${devise}`}
              />
              <Info libelle="Ville" valeur={selectionne.ville ?? '—'} />
            </div>

            <Button asChild size="sm" className="w-full gap-2">
              <Link to="/emplacements">
                Ouvrir la fiche <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Légende */}
      <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6 flex items-center gap-4 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 backdrop-blur text-[11px] text-slate-300">
        {DISPOS.map((d) => (
          <span key={d} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${COULEUR_DISPO[d]}`} />
            {d} <span className="text-slate-500">({compte(d)})</span>
          </span>
        ))}
      </div>

      {/* Aide navigation */}
      <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 hidden sm:flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 backdrop-blur text-[11px] text-slate-400">
        <MapPin className="w-3.5 h-3.5" />
        Glisser pour pivoter · molette pour zoomer · cliquer un panneau
      </div>

      {chargement && (
        <div className="absolute left-4 md:left-6 top-28 w-56 hidden lg:block">
          <Skeleton className="h-16 w-full bg-white/5" />
        </div>
      )}
    </div>
  );
}

function Info({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="rounded-md bg-white/5 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{libelle}</p>
      <p className="text-slate-200 truncate">{valeur}</p>
    </div>
  );
}
