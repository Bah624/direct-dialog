import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ArrowUpRight, CalendarCheck, Clock, FileText, Megaphone, MapPin, Plus,
  Printer, RefreshCw, Users, Wallet,
} from 'lucide-react';
import { getDashboard, GetDashboardOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Skeleton } from '@project/components/ui/skeleton';
import StatusBadge from '@/components/StatusBadge';
import { useSession } from '@/lib/session';
import { initiales } from '@/lib/permissions';
import { cn } from '@project/components/lib/utils';

type Donnees = GetDashboardOutputType;

const ICONES_ECHEANCE: Record<string, typeof FileText> = {
  Facture: FileText,
  Réservation: CalendarCheck,
  Travaux: Printer,
  Campagne: Megaphone,
};

const COULEUR_STATUT: Record<string, string> = {
  Brouillon: 'bg-slate-400',
  'En attente': 'bg-yellow-400',
  Validée: 'bg-blue-500',
  'En cours': 'bg-emerald-500',
  Terminée: 'bg-violet-500',
  Annulée: 'bg-red-500',
};

const TEINTE_ECHEANCE: Record<string, string> = {
  'en retard': 'bg-red-50 text-red-700 border-red-100',
  'cette semaine': 'bg-amber-50 text-amber-700 border-amber-100',
  'à venir': 'bg-slate-50 text-slate-600 border-slate-200',
  'En attente': 'bg-amber-50 text-amber-700 border-amber-100',
  Planifiée: 'bg-blue-50 text-blue-700 border-blue-100',
  'À valider': 'bg-violet-50 text-violet-700 border-violet-100',
};

function dateCourte(valeur?: string) {
  if (!valeur) return '—';
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function progression(debut?: string, fin?: string): number | null {
  if (!debut || !fin) return null;
  const a = new Date(debut).getTime();
  const b = new Date(fin).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  return Math.max(0, Math.min(100, Math.round(((Date.now() - a) / (b - a)) * 100)));
}

export default function Dashboard() {
  const { data: session, permis } = useSession();
  const devise = session?.societe?.devise ?? 'GNF';
  const voitFinances = permis('factures', 'voir');

  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [chargement, setChargement] = useState(true);
  const [actualisation, setActualisation] = useState(false);

  const charger = async (silencieux = false) => {
    if (silencieux) setActualisation(true);
    else setChargement(true);
    try {
      const reponse = await getDashboard({});
      setDonnees(reponse);
    } catch (erreur) {
      console.error('Tableau de bord indisponible', erreur);
    } finally {
      setChargement(false);
      setActualisation(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const montant = (valeur?: number) => `${(valeur ?? 0).toLocaleString('fr-FR')} ${devise}`;

  const compact = (valeur?: number) => {
    const n = valeur ?? 0;
    if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace('.', ',')} Md`;
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)} k`;
    return String(n);
  };

  const kpis = useMemo(() => {
    if (!donnees) return [];
    return [
      ...(voitFinances
        ? [
            {
              cle: 'paye',
              libelle: 'Encaissé',
              valeur: montant(donnees.caPaye),
              detail: `${donnees.tauxRecouvrement} % du total facturé`,
              icone: Wallet,
              teinte: 'text-emerald-600',
              fond: 'bg-emerald-50',
            },
            {
              cle: 'attente',
              libelle: 'En attente de règlement',
              valeur: montant(donnees.caEnAttente),
              detail:
                donnees.facturesEnRetard > 0
                  ? `${donnees.facturesEnRetard} facture(s) en retard`
                  : 'Aucun retard',
              icone: Clock,
              teinte: donnees.facturesEnRetard > 0 ? 'text-amber-600' : 'text-slate-500',
              fond: donnees.facturesEnRetard > 0 ? 'bg-amber-50' : 'bg-slate-100',
            },
          ]
        : []),
      {
        cle: 'campagnes',
        libelle: 'Campagnes en cours',
        valeur: String(donnees.campagnesEnCours),
        detail: `${donnees.totalCampagnes} au total`,
        icone: Megaphone,
        teinte: 'text-sky-600',
        fond: 'bg-sky-50',
      },
      {
        cle: 'reservations',
        libelle: 'Réservations à confirmer',
        valeur: String(donnees.reservationsEnAttente),
        detail: 'en attente de validation',
        icone: CalendarCheck,
        teinte: 'text-violet-600',
        fond: 'bg-violet-50',
      },
      {
        cle: 'emplacements',
        libelle: 'Panneaux disponibles',
        valeur: `${donnees.emplacements.disponibles}/${donnees.emplacements.total}`,
        detail: `${donnees.emplacements.occupes} occupé(s) · ${donnees.emplacements.reserves} réservé(s)`,
        icone: MapPin,
        teinte: 'text-orange-600',
        fond: 'bg-orange-50',
      },
    ];
  }, [donnees, devise, voitFinances]);

  if (chargement) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (!donnees) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Impossible de charger les indicateurs.
        </CardContent>
      </Card>
    );
  }

  const maxTopClient = Math.max(1, ...donnees.topClients.map((c) => c.montant));

  return (
    <div className="space-y-5 max-w-[1500px]">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">
            Vue d’ensemble de l’activité ·{' '}
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => charger(true)}
            disabled={actualisation}
            className="gap-2"
          >
            <RefreshCw className={cn('w-4 h-4', actualisation && 'animate-spin')} />
            Actualiser
          </Button>
          <Button asChild size="sm" className="gap-2">
            <Link to="/campagnes">
              <Plus className="w-4 h-4" /> Nouvelle campagne
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map(({ cle, libelle, valeur, detail, icone: Icone, teinte, fond }) => (
          <Card key={cle} className="border-border/70 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {libelle}
                </p>
                <span className={cn('rounded-lg p-1.5', fond)}>
                  <Icone className={cn('w-4 h-4', teinte)} />
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums leading-tight">{valeur}</p>
              <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Évolution */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Évolution de l’encaissement</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Six derniers mois d’activité</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary" /> Encaissé
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-300" /> En attente
              </span>
            </div>
          </CardHeader>
          <CardContent className="h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={donnees.evolutionCa} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradPaye" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradAttente" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="libelle" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={54}
                  tickFormatter={(v) => compact(Number(v))}
                />
                <Tooltip
                  formatter={(valeur: any, nom: any) => [
                    `${Number(valeur).toLocaleString('fr-FR')} ${devise}`,
                    nom === 'paye' ? 'Encaissé' : 'En attente',
                  ]}
                  labelStyle={{ fontSize: 12 }}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Area type="monotone" dataKey="enAttente" stroke="#94a3b8" strokeWidth={2} fill="url(#gradAttente)" />
                <Area type="monotone" dataKey="paye" stroke="#f97316" strokeWidth={2} fill="url(#gradPaye)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Relances */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Relances & échéances</CardTitle>
            <span className="text-xs text-muted-foreground">{donnees.echeances.length}</span>
          </CardHeader>
          <CardContent className="p-0">
            {donnees.echeances.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                Rien à relancer pour le moment.
              </p>
            ) : (
              <ul className="divide-y max-h-[16rem] overflow-y-auto">
                {donnees.echeances.map((e) => {
                  const Icone = ICONES_ECHEANCE[e.type] ?? FileText;
                  const teinte = TEINTE_ECHEANCE[e.statut ?? ''] ?? TEINTE_ECHEANCE['à venir'];
                  return (
                    <li key={`${e.type}-${e.id}`}>
                      <Link
                        to={e.lien}
                        className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/50 transition"
                      >
                        <span className="mt-0.5 rounded-md bg-muted p-1.5">
                          <Icone className="w-3.5 h-3.5 text-muted-foreground" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate">{e.libelle}</span>
                            {e.montant ? (
                              <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                                {compact(e.montant)}
                              </span>
                            ) : null}
                          </span>
                          <span className="flex items-center justify-between gap-2 mt-0.5">
                            <span className="text-[11px] text-muted-foreground truncate">{e.detail}</span>
                            <span
                              className={cn(
                                'text-[10px] rounded-full border px-1.5 py-0.5 whitespace-nowrap',
                                teinte,
                              )}
                            >
                              {dateCourte(e.date)}
                            </span>
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Pipeline */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Campagnes récentes</CardTitle>
            <Link to="/campagnes" className="text-xs text-primary flex items-center gap-1 hover:underline">
              Tout voir <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-2.5">Campagne</th>
                    <th className="text-left font-medium px-4 py-2.5">Statut</th>
                    <th className="text-left font-medium px-4 py-2.5">Période</th>
                    <th className="text-right font-medium px-4 py-2.5">Budget</th>
                    <th className="text-left font-medium px-4 py-2.5 w-32">Avancement</th>
                  </tr>
                </thead>
                <tbody>
                  {donnees.campagnesRecentes.map((c) => {
                    const avancement = progression(c.dateDebut, c.dateFin);
                    return (
                      <tr key={c.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-2.5">
                          <p className="font-medium truncate max-w-[220px]">{c.nomCampagne}</p>
                          <p className="text-[11px] text-muted-foreground">{c.clientNom ?? '—'}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={c.statut} />
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {dateCourte(c.dateDebut)} → {dateCourte(c.dateFin)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                          {montant(c.budgetTotal)}
                        </td>
                        <td className="px-4 py-2.5">
                          {avancement === null ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${avancement}%` }}
                                />
                              </div>
                              <span className="text-[11px] text-muted-foreground tabular-nums w-8 text-right">
                                {avancement}%
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {donnees.campagnesRecentes.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        Aucune campagne pour le moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Top clients */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>
              {donnees.topClients.length > 0 ? 'Meilleurs clients' : 'Répartition des campagnes'}
            </CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-0">
            {donnees.topClients.length > 0 ? (
              <ul className="divide-y">
                {donnees.topClients.map((client, index) => (
                  <li key={client.id} className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-3">{index + 1}</span>
                      <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                        {initiales(client.nom)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium truncate">{client.nom}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {client.factures} facture(s)
                        </span>
                      </span>
                      <span className="text-xs font-medium tabular-nums">{compact(client.montant)}</span>
                    </div>
                    <div className="mt-1.5 ml-14 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${Math.round((client.montant / maxTopClient) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="divide-y">
                {donnees.repartitionCampagnes.map(({ statut, nombre, budget }) => (
                  <li key={statut} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm">
                        <span className={cn('w-2 h-2 rounded-full', COULEUR_STATUT[statut] ?? 'bg-slate-300')} />
                        {statut}
                      </span>
                      <span className="text-sm font-medium tabular-nums">{nombre}</span>
                    </div>
                    <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60"
                        style={{
                          width: `${Math.round((nombre / Math.max(1, ...donnees.repartitionCampagnes.map((r) => r.nombre))) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{montant(budget)}</p>
                  </li>
                ))}
                {donnees.repartitionCampagnes.length === 0 && (
                  <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Aucune campagne enregistrée.
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dernières factures */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Dernières factures</CardTitle>
          <Link to="/factures" className="text-xs text-primary flex items-center gap-1 hover:underline">
            Tout voir <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Numéro</th>
                  <th className="text-left font-medium px-4 py-2.5">Statut</th>
                  <th className="text-left font-medium px-4 py-2.5">Échéance</th>
                  <th className="text-right font-medium px-4 py-2.5">Montant TTC</th>
                </tr>
              </thead>
              <tbody>
                {donnees.facturesRecentes.map((f) => (
                  <tr key={f.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{f.numeroFacture ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={f.statutPaiement} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {dateCourte(f.dateEcheance)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{montant(f.montantTtc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
