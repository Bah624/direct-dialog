import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Megaphone, Users, MapPin, Printer, CalendarCheck, FileText, ChevronRight, Menu, X, Mic, Package, BarChart2, UserPlus, Settings, ShieldAlert, LogOut } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@project/components/lib/utils';
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
  const { data, utilisateur, permis, deconnecter } = useSession();

  const visible = (item: NavItem) =>
    (item.modulesVisibles ?? [item.module]).some((m) => permis(m, 'voir'));

  const items = navItems.filter(visible);
  const currentPage = navItems.find((n) => n.to === location.pathname)?.label ?? 'Régie Publicitaire';

  const moduleCourant = moduleForPath(location.pathname);
  const accesPage =
    !moduleCourant ||
    permis(moduleCourant, 'voir') ||
    (moduleCourant === 'parametres' && permis('utilisateurs', 'voir'));

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

        {/* Compte connecté */}
        <div className="px-3 py-3 border-t border-slate-700 space-y-2">
          <div className="flex items-center gap-2 px-1">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {initiales(utilisateur?.nomComplet)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{utilisateur?.nomComplet ?? '—'}</p>
              <p className="text-[11px] text-slate-400 truncate">{utilisateur?.profil ?? '—'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => deconnecter()}
            className="w-full flex items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Se déconnecter
          </button>
        </div>

        <div className="px-5 py-3 border-t border-slate-700 text-xs text-slate-500">
          v1.2 · Régie Publicitaire
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
            <span className="hidden sm:inline">{utilisateur?.profil ?? ''}</span>
            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
              {initiales(utilisateur?.nomComplet)}
            </div>
          </div>
        </header>

        {utilisateur?.doitChangerMotDePasse && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>
              Mot de passe initial : pensez à le changer dans{' '}
              <NavLink to="/parametres" className="font-semibold underline">Paramètres → Mon compte</NavLink>.
            </span>
          </div>
        )}

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
                  Le profil « {utilisateur?.profil ?? 'inconnu'} » n’a pas accès à ce module.
                  Contactez un administrateur ou reconnectez-vous avec un autre compte.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
