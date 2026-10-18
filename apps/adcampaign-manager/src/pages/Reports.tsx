import { useState, useEffect, useMemo } from 'react';
import { getReports, GetReportsOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { Skeleton } from '@project/components/ui/skeleton';
import { Badge } from '@project/components/ui/badge';
import {
  Printer, RefreshCw, Users, Megaphone, MapPin, CalendarCheck,
  FileText, Package, Layers, TrendingDown, Filter, X, ArrowUpDown,
  ArrowUp, ArrowDown, ChevronDown, ChevronUp,
} from 'lucide-react';

type ReportData = GetReportsOutputType;
type SortDir = 'asc' | 'desc' | null;

const fmt = (n?: number | null) =>
  n != null ? n.toLocaleString('fr-GN') + ' GNF' : '–';

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '–';

// ── Sortable table ──────────────────────────────────────────────────────────
type SortableTableProps = {
  headers: string[];
  rows: (string | number | null | undefined)[][];
  footer?: React.ReactNode;
};

function SortableTable({ headers, rows, footer }: SortableTableProps) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const handleSort = (idx: number) => {
    if (sortCol !== idx) { setSortCol(idx); setSortDir('asc'); return; }
    if (sortDir === 'asc') setSortDir('desc');
    else { setSortCol(null); setSortDir(null); }
  };

  const sorted = useMemo(() => {
    if (sortCol === null || sortDir === null) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortCol] ?? '';
      const bv = b[sortCol] ?? '';
      const cmp = String(av).localeCompare(String(bv), 'fr', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortCol, sortDir]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse print-table">
        <thead>
          <tr className="bg-muted/60">
            {headers.map((h, i) => (
              <th
                key={h}
                onClick={() => handleSort(i)}
                className="text-left px-3 py-2 border border-border font-semibold text-foreground cursor-pointer select-none hover:bg-muted transition-colors no-print-sort"
              >
                <span className="flex items-center gap-1">
                  {h}
                  <span className="no-print">
                    {sortCol === i ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/20'}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 border border-border text-foreground">{cell ?? '–'}</td>
              ))}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan={headers.length} className="px-3 py-6 text-center text-muted-foreground border border-border">Aucune donnée pour ces filtres</td></tr>
          )}
        </tbody>
      </table>
      {footer}
    </div>
  );
}

// ── Filter bar ───────────────────────────────────────────────────────────────
type FilterField = {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date';
  options?: string[];
};

type FilterValues = Record<string, string>;

function FilterBar({
  fields,
  values,
  onChange,
  activeCount,
}: {
  fields: FilterField[];
  values: FilterValues;
  onChange: (k: string, v: string) => void;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="no-print mb-4 rounded-xl border border-border bg-card shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors rounded-xl"
      >
        <span className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          Filtres & Tri
          {activeCount > 0 && (
            <Badge variant="default" className="text-xs px-1.5 py-0">{activeCount} actif{activeCount > 1 ? 's' : ''}</Badge>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
            {fields.map(f => (
              <div key={f.key} className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
                {f.type === 'select' ? (
                  <Select value={values[f.key] || '_all'} onValueChange={v => onChange(f.key, v === '_all' ? '' : v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Tous" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">Tous</SelectItem>
                      {f.options?.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : f.type === 'date' ? (
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={values[f.key] || ''}
                    onChange={e => onChange(f.key, e.target.value)}
                  />
                ) : (
                  <Input
                    className="h-8 text-xs"
                    placeholder={`Filtrer ${f.label.toLowerCase()}…`}
                    value={values[f.key] || ''}
                    onChange={e => onChange(f.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 text-xs text-muted-foreground"
              onClick={() => fields.forEach(f => onChange(f.key, ''))}
            >
              <X className="w-3 h-3 mr-1" /> Effacer tous les filtres
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Print header ─────────────────────────────────────────────────────────────
function PrintHeader({ title, subtitle, count, generatedAt }: { title: string; subtitle?: string; count: number; generatedAt: string }) {
  return (
    <div className="print-header mb-5 hidden-screen print-only">
      <div className="flex items-start justify-between border-b-2 border-foreground pb-3">
        <div>
          <h1 className="text-2xl font-bold">DIRECT DIALOG</h1>
          <p className="text-sm text-muted-foreground">Régie Publicitaire</p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          <p className="text-sm text-muted-foreground">{count} enregistrement(s) · Généré le {fmtDate(generatedAt)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Screen section header ─────────────────────────────────────────────────────
function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="no-print flex items-center gap-3 mb-4">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <Badge variant="secondary">{count} résultat{count !== 1 ? 's' : ''}</Badge>
    </div>
  );
}

// ── Hook: filter state ────────────────────────────────────────────────────────
function useFilters(fields: FilterField[]) {
  const init = Object.fromEntries(fields.map(f => [f.key, '']));
  const [values, setValues] = useState<FilterValues>(init);
  const set = (k: string, v: string) => setValues(prev => ({ ...prev, [k]: v }));
  const activeCount = Object.values(values).filter(Boolean).length;
  return { values, set, activeCount };
}

// helper: text includes filter (case-insensitive)
const inc = (val: unknown, q: string) =>
  !q || String(val ?? '').toLowerCase().includes(q.toLowerCase());

// helper: date >= filter
const dateGte = (val: unknown, q: string) =>
  !q || (!!val && String(val) >= q);

// helper: date <= filter
const dateLte = (val: unknown, q: string) =>
  !q || (!!val && String(val) <= q);

// ═══════════════════════════════════════════════════════════════════════════
// TAB COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function ClientsReport({ data }: { data: ReportData }) {
  const fields: FilterField[] = [
    { key: 'nom', label: 'Nom client', type: 'text' },
    { key: 'statut', label: 'Statut', type: 'select', options: ['Actif', 'Inactif', 'Prospect'] },
    { key: 'secteur', label: 'Secteur', type: 'text' },
  ];
  const { values, set, activeCount } = useFilters(fields);

  const rows = useMemo(() => data.clients.filter(c =>
    inc(c.nomClient, values.nom) &&
    inc(c.statut, values.statut) &&
    inc(c.secteurDactivite, values.secteur)
  ).map(c => [c.nomClient, c.email, c.telephone, c.secteurDactivite, c.statut, fmtDate(c.dateCreation)]), [data, values]);

  return (
    <>
      <FilterBar fields={fields} values={values} onChange={set} activeCount={activeCount} />
      <SectionHeader title="Rapport Clients" count={rows.length} />
      <PrintHeader title="Rapport Clients" count={rows.length} generatedAt={data.generatedAt} />
      <SortableTable headers={['Nom Client', 'Email', 'Téléphone', 'Secteur', 'Statut', 'Date Création']} rows={rows} />
    </>
  );
}

function CampagnesReport({ data }: { data: ReportData }) {
  const fields: FilterField[] = [
    { key: 'nom', label: 'Nom campagne', type: 'text' },
    { key: 'statut', label: 'Statut', type: 'select', options: ['Brouillon', 'En attente', 'Validée', 'En cours', 'Terminée', 'Annulée'] },
    { key: 'commercial', label: 'Commercial', type: 'text' },
    { key: 'dateDebut', label: 'Date début ≥', type: 'date' },
    { key: 'dateFin', label: 'Date fin ≤', type: 'date' },
    { key: 'validation', label: 'Validation', type: 'select', options: ['En attente', 'Validée', 'Refusée', 'En révision'] },
  ];
  const { values, set, activeCount } = useFilters(fields);

  const rows = useMemo(() => data.campagnes.filter(c =>
    inc(c.nomCampagne, values.nom) &&
    inc(c.statut, values.statut) &&
    inc(c.commercialResponsable, values.commercial) &&
    dateGte(c.dateDebut, values.dateDebut) &&
    dateLte(c.dateFin, values.dateFin) &&
    inc(c.validationCreation, values.validation)
  ).map(c => [c.nomCampagne, c.statut, fmt(c.budgetTotal), fmtDate(c.dateDebut), fmtDate(c.dateFin), c.commercialResponsable, c.validationCreation]), [data, values]);

  return (
    <>
      <FilterBar fields={fields} values={values} onChange={set} activeCount={activeCount} />
      <SectionHeader title="Rapport Campagnes" count={rows.length} />
      <PrintHeader title="Rapport Campagnes" count={rows.length} generatedAt={data.generatedAt} />
      <SortableTable headers={['Nom Campagne', 'Statut', 'Budget Total', 'Date Début', 'Date Fin', 'Commercial', 'Validation']} rows={rows} />
    </>
  );
}

function EmplacementsReport({ data }: { data: ReportData }) {
  const villes = useMemo(() => [...new Set(data.emplacements.map(e => e.ville).filter(Boolean))].sort() as string[], [data]);
  const fields: FilterField[] = [
    { key: 'ref', label: 'Référence', type: 'text' },
    { key: 'ville', label: 'Ville', type: 'select', options: villes },
    { key: 'type', label: 'Type', type: 'select', options: ['Panneau', 'Affichage Urbain', 'Billboard', 'Abribus'] },
    { key: 'dispo', label: 'Disponibilité', type: 'select', options: ['Disponible', 'Réservé', 'Occupé', 'En maintenance'] },
    { key: 'format', label: 'Format', type: 'text' },
  ];
  const { values, set, activeCount } = useFilters(fields);

  const rows = useMemo(() => data.emplacements.filter(e =>
    inc(e.referenceEmplacement, values.ref) &&
    inc(e.ville, values.ville) &&
    inc(e.type, values.type) &&
    inc(e.disponibilite, values.dispo) &&
    inc(e.format, values.format)
  ).map(e => [e.referenceEmplacement, e.localisation, e.ville, e.type, e.format, fmt(e.prixParSemaine), e.disponibilite]), [data, values]);

  return (
    <>
      <FilterBar fields={fields} values={values} onChange={set} activeCount={activeCount} />
      <SectionHeader title="Rapport Emplacements" count={rows.length} />
      <PrintHeader title="Rapport Emplacements" count={rows.length} generatedAt={data.generatedAt} />
      <SortableTable headers={['Référence', 'Localisation', 'Ville', 'Type', 'Format', 'Prix/Semaine', 'Disponibilité']} rows={rows} />
    </>
  );
}

function ReservationsReport({ data }: { data: ReportData }) {
  const fields: FilterField[] = [
    { key: 'ref', label: 'Référence', type: 'text' },
    { key: 'statut', label: 'Statut', type: 'select', options: ['Confirmée', 'En attente', 'Annulée'] },
    { key: 'dateDebut', label: 'Date début ≥', type: 'date' },
    { key: 'dateFin', label: 'Date fin ≤', type: 'date' },
  ];
  const { values, set, activeCount } = useFilters(fields);

  const rows = useMemo(() => data.reservations.filter(r =>
    inc(r.referenceReservation, values.ref) &&
    inc(r.statut, values.statut) &&
    dateGte(r.dateDebut, values.dateDebut) &&
    dateLte(r.dateFin, values.dateFin)
  ).map(r => [r.referenceReservation, r.statut, fmtDate(r.dateDebut), fmtDate(r.dateFin), fmt(r.montant), fmtDate(r.dateReservation)]), [data, values]);

  const total = useMemo(() => data.reservations
    .filter(r => inc(r.statut, values.statut) && dateGte(r.dateDebut, values.dateDebut) && dateLte(r.dateFin, values.dateFin))
    .reduce((s, r) => s + (r.montant ?? 0), 0), [data, values]);

  return (
    <>
      <FilterBar fields={fields} values={values} onChange={set} activeCount={activeCount} />
      <SectionHeader title="Rapport Réservations" count={rows.length} />
      <PrintHeader title="Rapport Réservations" count={rows.length} generatedAt={data.generatedAt} />
      <SortableTable
        headers={['Référence', 'Statut', 'Date Début', 'Date Fin', 'Montant', 'Date Réservation']}
        rows={rows}
        footer={<div className="mt-3 p-3 bg-muted/50 rounded text-sm font-semibold text-right border border-border">Total montants : {fmt(total)}</div>}
      />
    </>
  );
}

function ImpressionsReport({ data }: { data: ReportData }) {
  const machinistes = useMemo(() => [...new Set(data.impressions.map(i => i.machinisteAssigne).filter(Boolean))].sort() as string[], [data]);
  const chefs = useMemo(() => [...new Set(data.impressions.map(i => i.chefAtelier).filter(Boolean))].sort() as string[], [data]);
  const formats = useMemo(() => [...new Set(data.impressions.map(i => i.formatImpression).filter(Boolean))].sort() as string[], [data]);

  const fields: FilterField[] = [
    { key: 'ref', label: 'Référence', type: 'text' },
    { key: 'type', label: 'Type de travaux', type: 'select', options: ['Impression', 'Affichage', 'Branding', 'Soudure', 'Décapoter (retrait vinyle)', 'Pose de vinyle', 'Installation panneau', 'Maintenance / Réparation', 'Retouche & finition', 'Autre'] },
    { key: 'statut', label: 'Statut', type: 'select', options: ['Planifiée', 'En cours', 'Terminée', 'Annulée'] },
    { key: 'format', label: 'Format', type: 'select', options: formats },
    { key: 'machiniste', label: 'Machiniste', type: 'select', options: machinistes },
    { key: 'chef', label: 'Chef Atelier', type: 'select', options: chefs },
    { key: 'datePlanifieeFrom', label: 'Date planifiée ≥', type: 'date' },
    { key: 'datePlanifeeTo', label: 'Date planifiée ≤', type: 'date' },
    { key: 'dateRealisationFrom', label: 'Date réalisation ≥', type: 'date' },
    { key: 'dateRealisationTo', label: 'Date réalisation ≤', type: 'date' },
  ];
  const { values, set, activeCount } = useFilters(fields);

  const rows = useMemo(() => data.impressions.filter(i =>
    inc(i.referenceImpression, values.ref) &&
    inc(i.typeDeTravaux, values.type) &&
    inc(i.statut, values.statut) &&
    inc(i.formatImpression, values.format) &&
    inc(i.machinisteAssigne, values.machiniste) &&
    inc(i.chefAtelier, values.chef) &&
    dateGte(i.datePlanifiee, values.datePlanifieeFrom) &&
    dateLte(i.datePlanifiee, values.datePlanifeeTo) &&
    dateGte(i.dateRealisation, values.dateRealisationFrom) &&
    dateLte(i.dateRealisation, values.dateRealisationTo)
  ).map(i => [i.referenceImpression, i.typeDeTravaux, i.statut, i.formatImpression, i.quantite, i.machinisteAssigne, i.chefAtelier, fmtDate(i.datePlanifiee), fmtDate(i.dateRealisation)]), [data, values]);

  const totalQte = useMemo(() => rows.reduce((s, r) => s + (Number(r[4]) || 0), 0), [rows]);

  return (
    <>
      <FilterBar fields={fields} values={values} onChange={set} activeCount={activeCount} />
      <SectionHeader title="Rapport Travaux / Impressions" count={rows.length} />
      <PrintHeader title="Rapport Travaux / Impressions" count={rows.length} generatedAt={data.generatedAt}
        subtitle={values.type ? `Type : ${values.type}` : undefined} />
      <SortableTable
        headers={['Référence', 'Type de Travaux', 'Statut', 'Format', 'Quantité', 'Machiniste', 'Chef Atelier', 'Date Planifiée', 'Date Réalisation']}
        rows={rows}
        footer={<div className="mt-3 p-3 bg-muted/50 rounded text-sm font-semibold text-right border border-border">Quantité totale : {totalQte}</div>}
      />
    </>
  );
}

function FacturesReport({ data }: { data: ReportData }) {
  const fields: FilterField[] = [
    { key: 'numero', label: 'N° Facture', type: 'text' },
    { key: 'statut', label: 'Statut paiement', type: 'select', options: ['Brouillon', 'Envoyée', 'Payée', 'En retard', 'Partiellement payée'] },
    { key: 'emissionFrom', label: 'Date émission ≥', type: 'date' },
    { key: 'emissionTo', label: 'Date émission ≤', type: 'date' },
    { key: 'echeanceFrom', label: 'Date échéance ≥', type: 'date' },
    { key: 'echeanceTo', label: 'Date échéance ≤', type: 'date' },
  ];
  const { values, set, activeCount } = useFilters(fields);

  const filtered = useMemo(() => data.factures.filter(f =>
    inc(f.numeroFacture, values.numero) &&
    inc(f.statutPaiement, values.statut) &&
    dateGte(f.dateEmission, values.emissionFrom) &&
    dateLte(f.dateEmission, values.emissionTo) &&
    dateGte(f.dateEcheance, values.echeanceFrom) &&
    dateLte(f.dateEcheance, values.echeanceTo)
  ), [data, values]);

  const rows = useMemo(() => filtered.map(f => [f.numeroFacture, f.statutPaiement, fmt(f.montantHt), fmt(f.tva), fmt(f.montantTtc), fmtDate(f.dateEmission), fmtDate(f.dateEcheance)]), [filtered]);
  const totalTtc = useMemo(() => filtered.reduce((s, f) => s + (f.montantTtc ?? 0), 0), [filtered]);
  const totalHt = useMemo(() => filtered.reduce((s, f) => s + (f.montantHt ?? 0), 0), [filtered]);

  return (
    <>
      <FilterBar fields={fields} values={values} onChange={set} activeCount={activeCount} />
      <SectionHeader title="Rapport Factures" count={rows.length} />
      <PrintHeader title="Rapport Factures" count={rows.length} generatedAt={data.generatedAt}
        subtitle={values.statut ? `Statut : ${values.statut}` : undefined} />
      <SortableTable
        headers={['N° Facture', 'Statut Paiement', 'Montant HT', 'TVA', 'Montant TTC', 'Date Émission', 'Date Échéance']}
        rows={rows}
        footer={
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="p-3 bg-muted/50 rounded text-sm border border-border text-right">Total HT : <span className="font-semibold">{fmt(totalHt)}</span></div>
            <div className="p-3 bg-primary/10 rounded text-sm border border-primary/30 text-right">Total TTC : <span className="font-bold text-primary">{fmt(totalTtc)}</span></div>
          </div>
        }
      />
    </>
  );
}

function StockReport({ data }: { data: ReportData }) {
  const fournisseurs = useMemo(() => [...new Set(data.stock.map(s => s.fournisseur).filter(Boolean))].sort() as string[], [data]);
  const fields: FilterField[] = [
    { key: 'ref', label: 'Référence', type: 'text' },
    { key: 'nom', label: 'Nom article', type: 'text' },
    { key: 'categorie', label: 'Catégorie', type: 'select', options: ['Vinyle', 'Encre', 'Papier grand format', 'Solvant & produits chimiques', 'Outillage', 'Profilé & structure', 'Visserie & fixation', 'Autre'] },
    { key: 'statut', label: 'Statut stock', type: 'select', options: ['En stock', 'Stock faible', 'Rupture de stock', 'Commandé'] },
    { key: 'fournisseur', label: 'Fournisseur', type: 'select', options: fournisseurs },
  ];
  const { values, set, activeCount } = useFilters(fields);

  const rows = useMemo(() => data.stock.filter(s =>
    inc(s.referenceArticle, values.ref) &&
    inc(s.nomArticle, values.nom) &&
    inc(s.categorie, values.categorie) &&
    inc(s.statutStock, values.statut) &&
    inc(s.fournisseur, values.fournisseur)
  ).map(s => [s.referenceArticle, s.nomArticle, s.categorie, s.quantiteEnStock, s.unite, s.seuilDAlerte, fmt(s.prixUnitaire), s.statutStock, s.fournisseur]), [data, values]);

  return (
    <>
      <FilterBar fields={fields} values={values} onChange={set} activeCount={activeCount} />
      <SectionHeader title="Rapport Stock" count={rows.length} />
      <PrintHeader title="Rapport Stock" count={rows.length} generatedAt={data.generatedAt} />
      <SortableTable headers={['Référence', 'Article', 'Catégorie', 'Quantité', 'Unité', 'Seuil Alerte', 'Prix Unitaire', 'Statut', 'Fournisseur']} rows={rows} />
    </>
  );
}

function SortiesReport({ data }: { data: ReportData }) {
  const responsables = useMemo(() => [...new Set(data.sorties.map(s => s.responsable).filter(Boolean))].sort() as string[], [data]);
  const fields: FilterField[] = [
    { key: 'motif', label: 'Motif', type: 'select', options: ['Utilisation travaux', 'Perte / Détérioration', 'Retour fournisseur', 'Inventaire / Ajustement', 'Autre'] },
    { key: 'responsable', label: 'Responsable', type: 'select', options: responsables },
    { key: 'dateFrom', label: 'Date sortie ≥', type: 'date' },
    { key: 'dateTo', label: 'Date sortie ≤', type: 'date' },
  ];
  const { values, set, activeCount } = useFilters(fields);

  const rows = useMemo(() => data.sorties.filter(s =>
    inc(s.motif, values.motif) &&
    inc(s.responsable, values.responsable) &&
    dateGte(s.dateSortie, values.dateFrom) &&
    dateLte(s.dateSortie, values.dateTo)
  ).map(s => [s.referenceSortie, s.motif, s.quantiteSortie, s.responsable, fmtDate(s.dateSortie), s.notes]), [data, values]);

  return (
    <>
      <FilterBar fields={fields} values={values} onChange={set} activeCount={activeCount} />
      <SectionHeader title="Rapport Sorties de Stock" count={rows.length} />
      <PrintHeader title="Rapport Sorties de Stock" count={rows.length} generatedAt={data.generatedAt} />
      <SortableTable headers={['Référence', 'Motif', 'Quantité Sortie', 'Responsable', 'Date Sortie', 'Notes']} rows={rows} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
const tabConfig = [
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'campagnes', label: 'Campagnes', icon: Megaphone },
  { id: 'emplacements', label: 'Emplacements', icon: MapPin },
  { id: 'reservations', label: 'Réservations', icon: CalendarCheck },
  { id: 'impressions', label: 'Travaux', icon: Layers },
  { id: 'factures', label: 'Factures', icon: FileText },
  { id: 'stock', label: 'Stock', icon: Package },
  { id: 'sorties', label: 'Sorties Stock', icon: TrendingDown },
];

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('clients');

  const load = async () => {
    setLoading(true);
    try { setData(await getReports({})); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-table { font-size: 10px; }
          .no-print-sort span.no-print { display: none; }
          @page { margin: 12mm; size: A4 landscape; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between no-print">
          <div>
            <h2 className="text-xl font-bold text-foreground">Rapports & Impressions</h2>
            <p className="text-sm text-muted-foreground">Filtrez vos données puis imprimez le rapport souhaité</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Button size="sm" onClick={() => window.print()} disabled={loading}>
              <Printer className="w-4 h-4 mr-2" />
              Imprimer
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : data ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap h-auto gap-1 no-print">
              {tabConfig.map(({ id, label, icon: Icon }) => (
                <TabsTrigger key={id} value={id} className="flex items-center gap-1.5 text-xs">
                  <Icon className="w-3.5 h-3.5" />{label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div id="print-area" className="mt-4">
              <TabsContent value="clients"><ClientsReport data={data} /></TabsContent>
              <TabsContent value="campagnes"><CampagnesReport data={data} /></TabsContent>
              <TabsContent value="emplacements"><EmplacementsReport data={data} /></TabsContent>
              <TabsContent value="reservations"><ReservationsReport data={data} /></TabsContent>
              <TabsContent value="impressions"><ImpressionsReport data={data} /></TabsContent>
              <TabsContent value="factures"><FacturesReport data={data} /></TabsContent>
              <TabsContent value="stock"><StockReport data={data} /></TabsContent>
              <TabsContent value="sorties"><SortiesReport data={data} /></TabsContent>
            </div>
          </Tabs>
        ) : null}
      </div>
    </>
  );
}
