import { useEffect, useState } from 'react';
import { getDashboard, GetDashboardOutputType } from 'zitejs/api';
import { Card, CardContent, CardHeader, CardTitle } from '@project/components/ui/card';
import { Skeleton } from '@project/components/ui/skeleton';
import { Megaphone, Users, TrendingUp, AlertCircle, Printer, CalendarCheck } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';

type Stats = GetDashboardOutputType;

const fmtCurrency = (n?: number) =>
  n != null ? n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) : '—';

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—';

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard({}).then(s => { setStats(s); setLoading(false); });
  }, []);

  const kpis = [
    { label: 'Campagnes en cours', value: stats?.campagnesEnCours, total: stats?.totalCampagnes, icon: Megaphone, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Clients actifs', value: stats?.totalClients, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Chiffre d\'affaires', value: fmtCurrency(stats?.chiffreAffaires), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Factures en retard', value: stats?.facturesEnRetard, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Impressions planifiées', value: stats?.impressionsPlanifiees, icon: Printer, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Réservations en attente', value: stats?.reservationsEnAttente, icon: CalendarCheck, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  const chartData = [
    { name: 'Campagnes', total: stats?.totalCampagnes ?? 0, enCours: stats?.campagnesEnCours ?? 0 },
    { name: 'Impressions', total: stats?.impressionsPlanifiees ?? 0 },
    { name: 'Réservations', total: stats?.reservationsEnAttente ?? 0 },
    { name: 'Retards', total: stats?.facturesEnRetard ?? 0 },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {kpis.map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground mb-1 truncate">{kpi.label}</p>
                  {loading ? (
                    <Skeleton className="h-7 w-16" />
                  ) : (
                    <p className="text-2xl font-bold text-foreground">{kpi.value ?? 0}</p>
                  )}
                  {kpi.total != null && !loading && (
                    <p className="text-xs text-muted-foreground mt-0.5">sur {kpi.total} total</p>
                  )}
                </div>
                <div className={`p-2.5 rounded-xl ${kpi.bg} flex-shrink-0`}>
                  <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts + Tables */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vue d'ensemble</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-48 w-full" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Total" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Campaigns */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Campagnes récentes</CardTitle>
            <Link to="/campagnes" className="text-xs text-primary hover:underline">Voir tout</Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="space-y-2">
                {stats?.campagnesRecentes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune campagne</p>
                )}
                {stats?.campagnesRecentes.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.nomCampagne ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(c.dateDebut)} → {fmtDate(c.dateFin)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <StatusBadge status={c.statut} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Factures récentes</CardTitle>
          <Link to="/factures" className="text-xs text-primary hover:underline">Voir tout</Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <div className="divide-y divide-border">
              {stats?.facturesRecentes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune facture</p>
              )}
              {stats?.facturesRecentes.map(f => (
                <div key={f.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{f.numeroFacture ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">Échéance : {fmtDate(f.dateEcheance)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm">{fmtCurrency(f.montantTtc)}</span>
                    <StatusBadge status={f.statutPaiement} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
