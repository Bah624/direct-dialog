import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Megaphone, Users, MapPin, Printer, CalendarCheck, FileText, ChevronRight, Menu, X, Mic, Package, BarChart2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@project/components/lib/utils';
const navItems = [{
  to: '/',
  label: 'Tableau de bord',
  icon: LayoutDashboard
}, {
  to: '/campagnes',
  label: 'Campagnes',
  icon: Megaphone
}, {
  to: '/clients',
  label: 'Clients',
  icon: Users
}, {
  to: '/emplacements',
  label: 'Emplacements',
  icon: MapPin
}, {
  to: '/reservations',
  label: 'Réservations',
  icon: CalendarCheck
}, {
  to: '/impressions',
  label: 'Travaux',
  icon: Printer
}, {
  to: '/factures',
  label: 'Facturation',
  icon: FileText
}, {
  to: '/stock',
  label: 'Gestion des Stocks',
  icon: Package
}, {
  to: '/collaborateurs',
  label: 'Collaborateurs',
  icon: UserPlus
}, {
  to: '/rapports',
  label: 'Rapports',
  icon: BarChart2
}, {
  to: '/agent',
  label: 'Agent IA Vocal',
  icon: Mic
}];
export default function Layout({
  children
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const currentPage = navItems.find(n => n.to === location.pathname)?.label ?? 'Régie Publicitaire';
  return <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={cn("fixed md:relative z-30 h-full w-60 bg-slate-900 text-white flex flex-col transition-transform duration-300", mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0")}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Megaphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className='font-bold text-sm leading-tight'>DIRECT DIALOG</p>
            <p className="text-primary text-xs font-semibold">Publicitaire</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({
          to,
          label,
          icon: Icon
        }) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobileOpen(false)} className={({
          isActive
        }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group", isActive ? "bg-primary text-white shadow-lg shadow-primary/30" : "text-slate-400 hover:bg-slate-800 hover:text-white")}>
              <Icon className="w-4.5 h-4.5 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
            </NavLink>)}
        </nav>

        <div className="px-5 py-4 border-t border-slate-700 text-xs text-slate-500">
          v1.0 · Régie Publicitaire
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 flex-shrink-0">
          <button className="md:hidden p-2 rounded-lg hover:bg-muted" onClick={() => setMobileOpen(v => !v)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <h1 className="font-semibold text-foreground text-base">{currentPage}</h1>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>;
}