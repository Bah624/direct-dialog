import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Megaphone, Users, MapPin, Printer, CalendarCheck, FileText, ChevronRight, Menu, X, Mic, Package, BarChart2, UserPlus, Settings, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@project/components/lib/utils';
import { toast } from 'sonner';
import { Toaster } from '@project/components/ui/sonner';
import { useSession } from '@/lib/session';
import { moduleForPath, initiales } from '@/lib/permissions';

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  module: string;
  /** Visible si l'un de ces modules est autorisé (par défaut : `module`). */
  modulesVisibles?: string[];
};

const navItems: NavItem[] = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, module: 'dashboard' },
  { to: '/campagnes', label: 'Campagnes', icon: Megaphone, module: 'campagnes' },
  { to: '/clients', label: 'Clients', icon: Users, module: 'clients' },
  { to: '/emplacements', label: 'Emplacements', icon: MapPin, module: 'emplacements' },
  { to: '/reservations', label: 'Réservations', icon: CalendarCheck, module: 'reservations' },
  { to: '/impressions', label: 'Travaux', icon: Printer, module: 'impressions' },
  { to: '/factures', label: 'Facturation', icon: FileText, module: 'factures' },
  { to: '/stock', label: 'Gestion des Stocks', icon: Package, module: 'stock' },
  { to: '/collaborateurs', label: 'Collaborateurs', icon: UserPlus, module: 'collaborateurs' },
  { to: '/rapports', label: 'Rapports', icon: BarChart2, module: 'rapports' },
  { to: '/agent', label: 'Agent IA Vocal', icon: Mic, module: 'agent' },
  {
    to: '/parametres',
    label: 'Paramètres',
    icon: Settings,
    module: 'parametres',
    modulesVisibles: ['parametres', 'utilisateurs'],
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { data, profilActif, permis, changerProfil } = useSession();

  const visible = (item: NavItem) =>
    (item.modulesVisibles ?? [item.module]).some((m) => permis(m, 'voir'));

  const items = navItems.filter(visible);
  const currentPage = navItems.find((n) => n.to === location.pathname)?.label ?? 'Régie Publicitaire';

  const moduleCourant = moduleForPath(location.pathname);
  const accesPage =
    !moduleCourant ||
    permis(moduleCourant, 'voir') ||
    (moduleCourant === 'parametres' && permis('utilisateurs', 'voir'));

  const utilisateursActifs = (data?.utilisateurs ?? []).filter((u) => u.statut !== 'Inactif');

  const changer = async (id: string) => {
    try {
      await changerProfil(id);
      toast.success('Profil changé');
    } catch (erreur: any) {
      toast.error(erreur?.message ?? 'Changement de profil impossible');
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={cn('fixed md:relative z-30 h-full w-60 bg-slate-900 text-white flex flex-col transition-transform duration-300', mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0')}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Megaphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">{data?.societe?.nom ?? 'DIRECT DIALOG'}</p>
            <p className="text-primary text-xs font-semibold">{data?.societe?.slogan ?? 'Publicitaire'}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                  isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                )
              }
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
            </NavLink>
          ))}
        </nav>

        {/* Profil actif */}
        <div className="px-3 py-3 border-t border-slate-700 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 px-1">Profil actif</p>
          <div className="flex items-center gap-2 px-1">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {initiales(profilActif?.nomComplet)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{profilActif?.nomComplet ?? 'Aucun profil'}</p>
              <p className="text-[11px] text-slate-400 truncate">{profilActif?.profil ?? '—'}</p>
            </div>
          </div>
          {utilisateursActifs.length > 1 && (
            <select
              value={profilActif?.id ?? ''}
              onChange={(e) => changer(e.target.value)}
              className="w-full rounded-md bg-slate-800 border border-slate-700 text-xs px-2 py-1.5 text-slate-200"
              aria-label="Changer de profil"
            >
              {utilisateursActifs.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nomComplet} — {u.profil}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-700 text-xs text-slate-500">
          v1.1 · Régie Publicitaire
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 flex-shrink-0">
          <button className="md:hidden p-2 rounded-lg hover:bg-muted" onClick={() => setMobileOpen((v) => !v)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <h1 className="font-semibold text-foreground text-base">{currentPage}</h1>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">{profilActif?.profil ?? ''}</span>
            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
              {initiales(profilActif?.nomComplet)}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {accesPage ? (
            children
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="max-w-md text-center space-y-3">
                <ShieldAlert className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="font-semibold">Accès non autorisé</p>
                <p className="text-sm text-muted-foreground">
                  Le profil « {profilActif?.profil ?? 'inconnu'} » n’a pas accès à ce module.
                  Changez de profil dans la barre latérale ou contactez un administrateur.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      <Toaster />
    </div>
  );
}
