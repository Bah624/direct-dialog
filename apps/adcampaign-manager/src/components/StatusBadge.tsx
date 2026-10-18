import { cn } from '@project/components/lib/utils';

const statusColors: Record<string, string> = {
  // Campagnes
  'Brouillon': 'bg-slate-100 text-slate-600',
  'En attente': 'bg-yellow-100 text-yellow-700',
  'Validée': 'bg-blue-100 text-blue-700',
  'En cours': 'bg-green-100 text-green-700',
  'Terminée': 'bg-purple-100 text-purple-700',
  'Annulée': 'bg-red-100 text-red-700',
  // Clients
  'Actif': 'bg-green-100 text-green-700',
  'Inactif': 'bg-slate-100 text-slate-600',
  'Prospect': 'bg-blue-100 text-blue-700',
  // Emplacements
  'Disponible': 'bg-green-100 text-green-700',
  'Réservé': 'bg-orange-100 text-orange-700',
  'Occupé': 'bg-red-100 text-red-700',
  'En maintenance': 'bg-slate-100 text-slate-600',
  // Validation
  'Refusée': 'bg-red-100 text-red-700',
  'En révision': 'bg-orange-100 text-orange-700',
  // Impressions
  'Planifiée': 'bg-blue-100 text-blue-700',
  // Réservations
  'Confirmée': 'bg-green-100 text-green-700',
  // Factures
  'Envoyée': 'bg-blue-100 text-blue-700',
  'Payée': 'bg-green-100 text-green-700',
  'En retard': 'bg-red-100 text-red-700',
  'Partiellement payée': 'bg-orange-100 text-orange-700',
};

export default function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      statusColors[status] ?? 'bg-slate-100 text-slate-600'
    )}>
      {status}
    </span>
  );
}
