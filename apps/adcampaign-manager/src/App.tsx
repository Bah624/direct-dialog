import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import { SessionProvider } from '@/lib/session';

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
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
      </SessionProvider>
    </BrowserRouter>
  );
}
