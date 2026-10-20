import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getCollaborateurs,
  getDashboard,
  getEmplacements,
  getImpressions,
  getReservations,
  getStock,
  getUtilisateurs,
  GetCollaborateursOutputType,
  GetDashboardOutputType,
  GetEmplacementsOutputType,
  GetImpressionsOutputType,
  GetStockOutputType,
  GetUtilisateursOutputType,
} from 'zitejs/api';
import { Badge } from '@project/components/ui/badge';
import { Button } from '@project/components/ui/button';
import StatusBadge from '@/components/StatusBadge';
import {
  Building2, CalendarCheck, Crosshair, ExternalLink, Factory, Loader2, MapPin,
  Megaphone, Network, PackageX, Printer, RotateCw, TrendingUp, AlertTriangle, LayoutPanelLeft,
} from 'lucide-react';
import { creerScene, type Panneau, type SceneHandle } from '@/components/cockpit/scene';
import { creerAtelier, ZONES_ATELIER, type AtelierHandle, type ZoneAtelier } from '@/components/cockpit/atelier';
import { creerSiege, type Salle, type SiegeHandle, type StatutSalle } from '@/components/cockpit/siege';
import { useSession } from '@/lib/session';
import { initiales } from '@/lib/permissions';
import { cn } from '@project/components/lib/utils';

type Emplacement = GetEmplacementsOutputType['emplacements'][0];
type Impression = GetImpressionsOutputType['impressions'][0];
type Article = GetStockOutputType['items'][0];
type Utilisateur = GetUtilisateursOutputType['utilisateurs'][0];
type Collaborateur = GetCollaborateursOutputType['collaborateurs'][0];

type Vue = 'siege' | 'reseau' | 'atelier';

type Pole = {
  id: string;
  nom: string;
  profils: string[];
  module: string;
  operations: number;
  detail: string;
  statut: StatutSalle;
  responsables: Utilisateur[];
};

type Departement = {
  id: string;
  nom: string;
  profils: string[];
  type: 'bureau' | 'atelier';
  module: string;
  operations: number;
  detail: string;
  statut: StatutSalle;
  responsables: Utilisateur[];
  poles?: Pole[];
};

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

const COULEUR_ZONE: Record<string, string> = {
  active: 'bg-orange-500',
  attente: 'bg-amber-400',
  alerte: 'bg-red-500',
  libre: 'bg-sky-400',
};

const ZONES_TRAVAUX: Record<string, string[]> = {
  imprimerie: ['Impression'],
  soudure: ['Soudure', 'Installation panneau', 'Maintenance / Réparation'],
  decoration: ['Décapoter (retrait vinyle)', 'Pose de vinyle', 'Retouche & finition', 'Affichage', 'Branding'],
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
  const sceneRef = useRef<SceneHandle | AtelierHandle | SiegeHandle | null>(null);

  const [vue, setVue] = useState<Vue>('siege');
  const [emplacements, setEmplacements] = useState<Emplacement[]>([]);
  const [impressions, setImpressions] = useState<Impression[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [collaborateurs, setCollaborateurs] = useState<Collaborateur[]>([]);
  const [dashboard, setDashboard] = useState<GetDashboardOutputType | null>(null);
  const [reservationsEnAttente, setReservationsEnAttente] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [indisponible, setIndisponible] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  const [rotation, setRotation] = useState(true);
  const [filtre, setFiltre] = useState<string | null>(null);
  const [afficherPanneaux, setAfficherPanneaux] = useState(false);
  const [heure, setHeure] = useState(new Date());

  // --- Chargement -----------------------------------------------------------
  useEffect(() => {
    let annule = false;
    (async () => {
      const [emp, dash, resa, trav, stock, users, collabs] = await Promise.allSettled([
        getEmplacements({}),
        getDashboard({}),
        getReservations({}),
        getImpressions({}),
        getStock({}),
        getUtilisateurs({}),
        getCollaborateurs({}),
      ]);
      if (annule) return;

      if (emp.status === 'fulfilled') {
        setEmplacements(((emp.value as any).emplacements ?? []) as Emplacement[]);
      } else {
        setIndisponible(true);
      }
      if (dash.status === 'fulfilled') setDashboard(dash.value);
      if (resa.status === 'fulfilled') {
        setReservationsEnAttente(
          resa.value.reservations.filter((r) => r.statut === 'En attente').length,
        );
      }
      if (trav.status === 'fulfilled') {
        setImpressions(((trav.value as any).impressions ?? []) as Impression[]);
      }
      if (stock.status === 'fulfilled') {
        const donnees = stock.value as any;
        setArticles((donnees.items ?? donnees.stock ?? []) as Article[]);
      }
      if (users.status === 'fulfilled') {
        setUtilisateurs(((users.value as any).utilisateurs ?? []) as Utilisateur[]);
      }
      if (collabs.status === 'fulfilled') {
        setCollaborateurs(((collabs.value as any).collaborateurs ?? []) as Collaborateur[]);
      }
      setChargement(false);
    })();
    return () => {
      annule = true;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setHeure(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Données réseau --------------------------------------------------------
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

  // --- Données atelier -------------------------------------------------------
  const articlesEnAlerte = useMemo(
    () =>
      articles.filter(
        (a) => Number(a.quantiteEnStock ?? 0) <= Number(a.seuilDAlerte ?? 0),
      ),
    [articles],
  );

  const operationsParZone = useMemo<Record<string, Impression[]>>(
    () => ({
      operations: [],
      imprimerie: impressions.filter(
        (i) =>
          !(ZONES_TRAVAUX.soudure ?? []).includes(i.typeDeTravaux ?? '') &&
          !(ZONES_TRAVAUX.decoration ?? []).includes(i.typeDeTravaux ?? ''),
      ),
      soudure: impressions.filter((i) =>
        (ZONES_TRAVAUX.soudure ?? []).includes(i.typeDeTravaux ?? ''),
      ),
      decoration: impressions.filter((i) =>
        (ZONES_TRAVAUX.decoration ?? []).includes(i.typeDeTravaux ?? ''),
      ),
    }),
    [impressions],
  );

  const zones = useMemo<ZoneAtelier[]>(() => {
    const statutDe = (liste: Impression[]): ZoneAtelier['statut'] => {
      if (liste.some((i) => i.statut === 'En cours')) return 'active';
      if (liste.some((i) => i.statut === 'Planifiée')) return 'attente';
      return 'libre';
    };

    return ZONES_ATELIER.map((z) => {
      if (z.id === 'operations') {
        return {
          ...z,
          operations: reservationsEnAttente,
          statut: reservationsEnAttente > 0 ? 'attente' : 'libre',
        };
      }
      const liste = operationsParZone[z.id] ?? [];
      return { ...z, operations: liste.length, statut: statutDe(liste) };
    });
  }, [operationsParZone, reservationsEnAttente]);

  // --- Données siège ---------------------------------------------------------
  const departements = useMemo<Departement[]>(() => {
    const echeances = dashboard?.echeances ?? [];
    const nb = (type: string) => echeances.filter((e) => e.type === type).length;

    const facturesRetard = dashboard?.facturesEnRetard ?? 0;
    const campagnesAValider = nb('Campagne');
    const travauxPlanifies = dashboard?.impressionsPlanifiees ?? 0;
    const travauxEnCours = impressions.filter((i) => i.statut === 'En cours').length;
    const travauxImpression = impressions.filter(
      (i) =>
        !(ZONES_TRAVAUX.soudure ?? []).includes(i.typeDeTravaux ?? '') &&
        !(ZONES_TRAVAUX.decoration ?? []).includes(i.typeDeTravaux ?? ''),
    ).length;
    const travauxSoudure = impressions.filter((i) =>
      (ZONES_TRAVAUX.soudure ?? []).includes(i.typeDeTravaux ?? ''),
    ).length;
    const travauxDecoration = impressions.filter((i) =>
      (ZONES_TRAVAUX.decoration ?? []).includes(i.typeDeTravaux ?? ''),
    ).length;
    const alertesStock = articlesEnAlerte.length;

    const responsablesPour = (profils: string[]) =>
      utilisateurs.filter((u) => profils.includes(u.profil ?? ''));

    const construire = (
      id: string,
      nom: string,
      profils: string[],
      module: string,
      operations: number,
      detail: string,
      statut: StatutSalle,
    ): Departement => ({
      id,
      nom,
      profils,
      type: 'bureau',
      module,
      operations,
      detail,
      statut,
      responsables: responsablesPour(profils),
    });

    const pole = (
      id: string,
      nom: string,
      profils: string[],
      module: string,
      operations: number,
      detail: string,
      statut: StatutSalle,
    ): Pole => ({
      id,
      nom,
      profils,
      module,
      operations,
      detail,
      statut,
      responsables: responsablesPour(profils),
    });

    const poles: Pole[] = [
      pole(
        'operations',
        'Opérations',
        ['Responsable des opérations', 'Assistante de gestion'],
        '/reservations',
        reservationsEnAttente,
        `${reservationsEnAttente} réservation(s) à confirmer`,
        reservationsEnAttente > 0 ? 'attente' : 'libre',
      ),
      pole(
        'imprimerie',
        'Imprimerie',
        ["Chef d'atelier", 'Machiniste', 'Responsable technique'],
        '/impressions',
        travauxImpression,
        `${travauxImpression} impression(s) · ${travauxEnCours} en cours`,
        travauxEnCours > 0 ? 'active' : travauxImpression > 0 ? 'attente' : 'libre',
      ),
      pole(
        'soudure',
        'Soudure',
        ['Soudeur'],
        '/impressions',
        travauxSoudure,
        `${travauxSoudure} travaux de soudure / pose`,
        travauxSoudure > 0 ? 'active' : 'libre',
      ),
      pole(
        'decoration',
        'Décoration',
        ['Décorateur', 'Graphiste'],
        '/impressions',
        travauxDecoration,
        `${travauxDecoration} travaux de décoration`,
        travauxDecoration > 0 ? 'active' : 'libre',
      ),
    ];

    const bureaux: Departement[] = [
      construire(
        'direction',
        'Direction générale',
        ['Directeur général', 'Administrateur'],
        '/',
        campagnesAValider + facturesRetard,
        `${campagnesAValider} validation(s) · ${facturesRetard} retard(s)`,
        campagnesAValider > 0 ? 'attente' : facturesRetard > 0 ? 'alerte' : 'libre',
      ),
      construire(
        'secretariat',
        'Secrétariat',
        ['Secrétaire', 'Assistante de direction'],
        '/campagnes',
        echeances.length,
        `${echeances.length} dossier(s) à suivre`,
        echeances.length > 0 ? 'attente' : 'libre',
      ),
      construire(
        'finance',
        'Finances',
        ['Responsable des finances', 'Comptable'],
        '/factures',
        facturesRetard,
        `${facturesRetard} facture(s) en retard`,
        facturesRetard > 0 ? 'alerte' : 'libre',
      ),
      construire(
        'rh',
        'Ressources humaines',
        ['RH'],
        '/collaborateurs',
        collaborateurs.length,
        `${collaborateurs.length} collaborateur(s)`,
        'libre',
      ),
    ];

    const totalAtelier = poles.reduce((total, p) => total + p.operations, 0);
    const responsablesAtelier = [
      ...new Map(poles.flatMap((p) => p.responsables).map((r) => [r.id, r])).values(),
    ];
    const statutAtelier: StatutSalle = poles.some((p) => p.statut === 'alerte')
      ? 'alerte'
      : poles.some((p) => p.statut === 'active')
        ? 'active'
        : poles.some((p) => p.statut === 'attente')
          ? 'attente'
          : 'libre';

    return [
      ...bureaux,
      {
        id: 'atelier',
        nom: 'Atelier',
        profils: [...new Set(poles.flatMap((p) => p.profils))],
        type: 'atelier',
        module: '/impressions',
        operations: totalAtelier,
        detail: `${poles.length} pôles · ${totalAtelier} opération(s)`,
        statut: statutAtelier,
        responsables: responsablesAtelier,
        poles,
      },
    ];
  }, [dashboard, impressions, reservationsEnAttente, articlesEnAlerte, utilisateurs, collaborateurs]);

  const salles = useMemo<Salle[]>(
    () =>
      departements.map((d) => ({
        id: d.id,
        nom: d.nom,
        operations: d.operations,
        responsables: d.responsables.length,
        statut: d.statut,
        type: d.type,
        poles: d.poles?.map((p) => ({
          id: p.id as any,
          nom: p.nom,
          operations: p.operations,
          responsables: p.responsables.length,
          statut: p.statut,
        })),
      })),
    [departements],
  );

  // --- Scène 3D -------------------------------------------------------------
  useEffect(() => {
    if (!conteneur.current) return;
    if (!webglDisponible()) {
      setIndisponible(true);
      return;
    }

    const handle =
      vue === 'siege'
        ? creerSiege(conteneur.current, salles, {
            rotation: true,
            onSelect: surSelection,
          })
        : vue === 'reseau'
          ? creerScene(conteneur.current, panneaux, {
              rotation: true,
              onSelect: surSelection,
            })
          : creerAtelier(conteneur.current, zones, {
              rotation: true,
              onSelect: surSelection,
            });

    sceneRef.current = handle;
    return () => {
      handle.dispose();
      sceneRef.current = null;
    };
  }, [vue, salles, panneaux, zones]);

  useEffect(() => {
    sceneRef.current?.setRotation(rotation);
  }, [rotation]);

  useEffect(() => {
    if (vue === 'reseau' && 'setFiltre' in (sceneRef.current ?? {})) {
      (sceneRef.current as SceneHandle).setFiltre(filtre);
    }
  }, [filtre, vue]);

  useEffect(() => {
    setSelection(null);
    setFiltre(null);
  }, [vue]);

  const surSelection = (id: string | null) => {
    setSelection(id);
    if (id) setAfficherPanneaux(true);
  };

  const choisir = (id: string | null) => {
    setSelection(id);
    sceneRef.current?.focus(id);
    if (id) setRotation(false);
  };

  const emplacementSelectionne = emplacements.find((e) => e.id === selection) ?? null;
  const zoneSelectionnee = vue === 'atelier' ? zones.find((z) => z.id === selection) ?? null : null;
  const departementSelectionne = vue === 'siege' ? departements.find((d) => d.id === selection) ?? null : null;
  const tousLesPoles = departements.flatMap((d) => d.poles ?? []);
  const poleSelectionne = vue === 'siege' ? tousLesPoles.find((p) => p.id === selection) ?? null : null;
  const operationsSelectionnees = selection ? operationsParZone[selection] ?? [] : [];

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

  const sousTitre =
    vue === 'siege'
      ? `Siège · ${departements.length} espaces · ${utilisateurs.length} responsable(s)`
      : vue === 'reseau'
        ? `Réseau d'affichage · ${emplacements.length} panneau(x)`
        : `Atelier de production · ${impressions.length} opération(s)`;

  const compte = (dispo: string) => emplacements.filter((e) => e.disponibilite === dispo).length;

  return (
    <div className="cockpit relative -m-4 md:-m-6 h-[calc(100vh-3.5rem)] overflow-hidden bg-[#050b18] text-white">
      <div ref={conteneur} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_38%,rgba(5,11,24,0.85)_100%)]" />

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
            <p className="font-semibold">Vue 3D indisponible</p>
            <p className="text-sm text-slate-400">
              Votre navigateur ne prend pas en charge WebGL, ou votre profil n’a pas accès aux
              données. La gestion classique reste disponible.
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link to="/emplacements">Ouvrir les panneaux</Link>
            </Button>
          </div>
        </div>
      )}

      {/* En-tête */}
      <div className="absolute top-4 left-4 md:top-6 md:left-6 flex items-start gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-sky-400/80">Direct Dialog</p>
          <h1 className="text-xl md:text-2xl font-semibold leading-tight">Cockpit 3D</h1>
          <p className="text-xs text-slate-400">{sousTitre}</p>
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
          className={cn('text-slate-300 hover:bg-white/10 hover:text-white', afficherPanneaux && 'text-sky-400')}
          onClick={() => setAfficherPanneaux((v) => !v)}
          title={afficherPanneaux ? 'Masquer les panneaux' : 'Afficher les panneaux'}
        >
          <LayoutPanelLeft className="w-4 h-4" />
        </Button>
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
      {afficherPanneaux && (
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

      )}

      {/* Panneau latéral */}
      {afficherPanneaux && (
      <div className="absolute right-4 md:right-6 top-28 md:top-32 w-72 md:w-80 hidden md:flex flex-col gap-3">
        <div className="rounded-xl border border-white/10 bg-slate-900/70 backdrop-blur-md overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <p className="text-sm font-medium">
              {vue === 'siege'
                ? 'Espaces'
                : vue === 'reseau'
                  ? 'Panneaux'
                  : 'Pôles de l’atelier'}
            </p>
            <span className="text-[11px] text-slate-400">
              {vue === 'siege' ? departements.length : vue === 'reseau' ? emplacements.length : zones.length}
            </span>
          </div>

          {vue === 'reseau' && (
            <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-white/10">
              <button
                onClick={() => setFiltre(null)}
                className={cn(
                  'text-[11px] rounded-full px-2 py-1 transition',
                  !filtre ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10',
                )}
              >
                Tous
              </button>
              {DISPOS.map((d) => (
                <button
                  key={d}
                  onClick={() => setFiltre(filtre === d ? null : d)}
                  className={cn(
                    'text-[11px] rounded-full px-2 py-1 transition',
                    filtre === d ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10',
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          <div className="max-h-[24rem] overflow-y-auto">
            {vue === 'siege' &&
              departements.map((d) => (
                <button
                  key={d.id}
                  onClick={() => choisir(d.id)}
                  className={cn(
                    'w-full text-left px-4 py-2 flex items-center gap-3 transition hover:bg-white/5',
                    selection === d.id && 'bg-white/10',
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full flex-shrink-0', COULEUR_ZONE[d.statut])} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium truncate">{d.nom}</span>
                    <span className="block text-[11px] text-slate-400 truncate">
                      {d.responsables.length} responsable(s)
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-400 tabular-nums">{d.operations}</span>
                </button>
              ))}

            {vue === 'reseau' &&
              emplacements
                .filter((e) => !filtre || e.disponibilite === filtre)
                .map((e) => (
                  <button
                    key={e.id}
                    onClick={() => choisir(e.id)}
                    className={cn(
                      'w-full text-left px-4 py-2.5 flex items-center gap-3 transition hover:bg-white/5',
                      selection === e.id && 'bg-white/10',
                    )}
                  >
                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', COULEUR_DISPO[e.disponibilite ?? ''] ?? 'bg-sky-400')} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium truncate">{e.referenceEmplacement}</span>
                      <span className="block text-[11px] text-slate-400 truncate">
                        {e.ville} · {e.type}
                      </span>
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {(e.prixParSemaine ?? 0).toLocaleString('fr-FR')}
                    </span>
                  </button>
                ))}

            {vue === 'atelier' &&
              zones.map((z) => (
                <button
                  key={z.id}
                  onClick={() => choisir(z.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 flex items-center gap-3 transition hover:bg-white/5',
                    selection === z.id && 'bg-white/10',
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full flex-shrink-0', COULEUR_ZONE[z.statut])} />
                  <span className="min-w-0 flex-1 text-xs font-medium truncate">{z.nom}</span>
                  <span className="text-[11px] text-slate-400 tabular-nums">{z.operations}</span>
                </button>
              ))}
          </div>
        </div>

        {/* Détail siège */}
        {(poleSelectionne || departementSelectionne) && (
          <div className="rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  {poleSelectionne?.nom ?? departementSelectionne?.nom}
                </p>
                <p className="text-[11px] text-slate-400">
                  {poleSelectionne?.detail ?? departementSelectionne?.detail}
                </p>
              </div>
              <span
                className={cn(
                  'mt-1 w-2.5 h-2.5 rounded-full',
                  COULEUR_ZONE[poleSelectionne?.statut ?? departementSelectionne?.statut ?? 'libre'],
                )}
              />
            </div>

            {!poleSelectionne && (departementSelectionne?.poles?.length ?? 0) > 0 ? (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">
                  Pôles de l’atelier
                </p>
                <ul className="space-y-1">
                  {departementSelectionne!.poles!.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => choisir(p.id)}
                        className="w-full flex items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-white/5"
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full', COULEUR_ZONE[p.statut])} />
                        <span className="min-w-0 flex-1 text-[11px] truncate">{p.nom}</span>
                        <span className="text-[10px] text-slate-400 tabular-nums">
                          {p.operations} op. · {p.responsables.length} resp.
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Responsables</p>
                {(poleSelectionne?.responsables ?? departementSelectionne?.responsables ?? []).length > 0 ? (
                  <ul className="space-y-1.5 max-h-44 overflow-y-auto">
                    {(poleSelectionne?.responsables ?? departementSelectionne?.responsables ?? []).map((r) => (
                      <li key={r.id} className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-semibold">
                          {initiales(r.nomComplet ?? '')}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-medium truncate">{r.nomComplet}</span>
                          <span className="block text-[10px] text-slate-400 truncate">{r.profil}</span>
                        </span>
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            r.statut === 'Inactif' ? 'bg-slate-500' : 'bg-emerald-400',
                          )}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-slate-400">Aucun responsable enregistré.</p>
                )}
              </div>
            )}

            <Button asChild size="sm" className="w-full gap-2">
              <Link to={poleSelectionne?.module ?? departementSelectionne?.module ?? '/'}>
                Ouvrir le module <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        )}

        {/* Détail réseau */}
        {vue === 'reseau' && emplacementSelectionne && (
          <div className="rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{emplacementSelectionne.referenceEmplacement}</p>
                <p className="text-[11px] text-slate-400">
                  {emplacementSelectionne.localisation} · {emplacementSelectionne.ville}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn('border-white/10', TEXTE_DISPO[emplacementSelectionne.disponibilite ?? ''] ?? 'text-sky-400')}
              >
                {emplacementSelectionne.disponibilite}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <Info libelle="Type" valeur={emplacementSelectionne.type ?? '—'} />
              <Info libelle="Format" valeur={emplacementSelectionne.format ?? '—'} />
              <Info
                libelle="Prix / semaine"
                valeur={`${(emplacementSelectionne.prixParSemaine ?? 0).toLocaleString('fr-FR')} ${devise}`}
              />
              <Info libelle="Ville" valeur={emplacementSelectionne.ville ?? '—'} />
            </div>

            <Button asChild size="sm" className="w-full gap-2">
              <Link to="/emplacements">
                Ouvrir la fiche <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        )}

        {/* Détail atelier */}
        {vue === 'atelier' && zoneSelectionnee && (
          <div className="rounded-xl border border-white/10 bg-slate-900/80 backdrop-blur-md p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{zoneSelectionnee.nom}</p>
                <p className="text-[11px] text-slate-400">
                  {zoneSelectionnee.operations} opération(s) affectée(s)
                </p>
              </div>
              <span className={cn('mt-1 w-2.5 h-2.5 rounded-full', COULEUR_ZONE[zoneSelectionnee.statut])} />
            </div>

            {zoneSelectionnee.id === 'operations' ? (
              <p className="text-[11px] text-slate-400">
                {zoneSelectionnee.operations} réservation(s) à confirmer côté opérations.
              </p>
            ) : operationsSelectionnees.length > 0 ? (
              <ul className="space-y-2 max-h-44 overflow-y-auto">
                {operationsSelectionnees.slice(0, 6).map((operation) => (
                  <li key={operation.id} className="rounded-md bg-white/5 px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium truncate">
                        {operation.referenceImpression ?? 'Travaux'}
                      </span>
                      <StatusBadge status={operation.statut} />
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {operation.typeDeTravaux ?? '—'}
                      {operation.machinisteAssigne ? ` · ${operation.machinisteAssigne}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-slate-400">Aucune opération sur ce pôle.</p>
            )}

            <Button asChild size="sm" variant="secondary" className="w-full gap-2">
              <Link to="/impressions">
                Ouvrir les travaux <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        )}
      </div>

      )}

      {/* Légende */}
      <div className="absolute bottom-20 md:bottom-24 left-4 md:left-6 flex items-center gap-4 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 backdrop-blur text-[11px] text-slate-300">
        {vue === 'reseau' ? (
          DISPOS.map((d) => (
            <span key={d} className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full', COULEUR_DISPO[d])} />
              {d} <span className="text-slate-500">({compte(d)})</span>
            </span>
          ))
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500" /> En cours
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> En attente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Alerte
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400" /> Calme
            </span>
          </>
        )}
      </div>

      {/* Sélecteur de vue */}
      <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900/80 p-1 backdrop-blur-md">
        {([
          { cle: 'siege', libelle: 'Siège', icone: Building2 },
          { cle: 'reseau', libelle: 'Réseau', icone: Network },
          { cle: 'atelier', libelle: 'Atelier', icone: Factory },
        ] as const).map(({ cle, libelle, icone: Icone }) => (
          <button
            key={cle}
            onClick={() => setVue(cle)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition',
              vue === cle ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5',
            )}
          >
            <Icone className="w-4 h-4" /> {libelle}
          </button>
        ))}
      </div>

      {/* Aide navigation */}
      <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 hidden sm:flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 backdrop-blur text-[11px] text-slate-400">
        {vue === 'siege' ? (
          <>
            <Building2 className="w-3.5 h-3.5" />
            Cliquer un bureau pour voir ses responsables
          </>
        ) : vue === 'reseau' ? (
          <>
            <MapPin className="w-3.5 h-3.5" />
            Glisser pour pivoter · cliquer un panneau
          </>
        ) : (
          <>
            <PackageX className="w-3.5 h-3.5" />
            Cliquer un poste pour voir les opérations
          </>
        )}
      </div>
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
