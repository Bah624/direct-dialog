import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Campagnes from '@/pages/Campagnes';
import Clients from '@/pages/Clients';
import EmplacementsPage from '@/pages/Emplacements';
import ReservationsPage from '@/pages/Reservations';
import ImpressionsPage from '@/pages/Impressions';
import FacturesPage from '@/pages/Factures';
import AgentPage from '@/pages/Agent';
import StockPage from '@/pages/Stock';
import ReportsPage from '@/pages/Reports';
import CollaborateursPage from '@/pages/Collaborateurs';
import ParametresPage from '@/pages/Parametres';
import Connexion from '@/pages/Connexion';
import { SessionProvider, useSession } from '@/lib/session';

function Application() {
  const { pret, utilisateur } = useSession();

  if (!pret) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!utilisateur) return <Connexion />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/campagnes" element={<Campagnes />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/emplacements" element={<EmplacementsPage />} />
        <Route path="/reservations" element={<ReservationsPage />} />
        <Route path="/impressions" element={<ImpressionsPage />} />
        <Route path="/factures" element={<FacturesPage />} />
        <Route path="/stock" element={<StockPage />} />
        <Route path="/collaborateurs" element={<CollaborateursPage />} />
        <Route path="/rapports" element={<ReportsPage />} />
        <Route path="/agent" element={<AgentPage />} />
        <Route path="/parametres" element={<ParametresPage />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Application />
      </SessionProvider>
    </BrowserRouter>
  );
}
