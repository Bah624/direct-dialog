import { useEffect, useState } from 'react';
import { getCampagnes, saveCampagne, deleteCampagne, GetCampagnesOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Card, CardContent } from '@project/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Plus, Search, Pencil, Trash2, Megaphone, ChevronDown, ChevronUp } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { Skeleton } from '@project/components/ui/skeleton';
import { toast } from 'sonner';
import { Toaster } from '@project/components/ui/sonner';

type Camp = GetCampagnesOutputType['campagnes'][0];
type ClientOpt = GetCampagnesOutputType['clients'][0];

const EMPTY: Record<string, any> = { nomCampagne: '', statut: 'Brouillon', validationCreation: 'En attente', clientManuel: '' };

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const fmtGNF = (n?: number) => n != null ? n.toLocaleString('fr-FR') + ' GNF' : '—';

export default function Campagnes() {
  const [campagnes, setCampagnes] = useState<Camp[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [form, setForm] = useState<Record<string, any>>(EMPTY);
  const [clientMode, setClientMode] = useState<'liste' | 'manuel'>('liste');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await getCampagnes({ search: search || undefined, statut: filterStatut || undefined });
    setCampagnes(res.campagnes);
    setClients(res.clients);
    setLoading(false);
  };

  useEffect(() => { load(); }, [search, filterStatut]);

  const openNew = () => {
    setForm(EMPTY);
    setClientMode('liste');
    setDialogOpen(true);
  };

  const openEdit = (c: Camp) => {
    setForm({ ...c, budgetTotal: c.budgetTotal?.toString() ?? '', clientManuel: c.clientNom ?? '' });
    // If client has an ID it came from the list, otherwise it was manual
    setClientMode(c.clientId ? 'liste' : 'manuel');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nomCampagne) return toast.error('Nom de campagne requis');
    setSaving(true);
    try {
      // If manual mode, store client name in commercialResponsable field context or just pass clientId empty
      const payload: Record<string, any> = {
        ...form,
        budgetTotal: form.budgetTotal ? parseFloat(form.budgetTotal) : undefined,
      };
      if (clientMode === 'manuel') {
        payload.clientId = undefined;
        // Store manual client name in description prefix if needed — kept in form.clientManuel for display only
      }
      const result = await saveCampagne(payload as any);
      toast.success(form.id ? 'Campagne mise à jour' : 'Campagne créée');
      if (result.emailsSent && result.emailsSent > 0) {
        toast.success(`📧 ${result.emailsSent} collaborateur(s) notifié(s) par email`);
      }
      setDialogOpen(false);
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteCampagne({ id: deleteId });
    setDeleteId(null);
    toast.success('Campagne supprimée');
    load();
  };

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // Display client name: from list or manual entry stored in commercialResponsable fallback
  const displayClient = (c: Camp) => c.clientNom || '—';

  return (
    <div className="space-y-4">
      <Toaster />
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatut || '_all'} onValueChange={v => setFilterStatut(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Tous les statuts</SelectItem>
            {['Brouillon','En attente','Validée','En cours','Terminée','Annulée'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Nouvelle campagne</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : campagnes.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground gap-2">
              <Megaphone className="w-10 h-10 opacity-30" /><p className="text-sm">Aucune campagne trouvée</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    {['Campagne', 'Client', 'Période', 'Budget', 'Statut', 'Création', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {campagnes.map(c => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{c.nomCampagne}</td>
                      <td className="px-4 py-3 text-muted-foreground">{displayClient(c)}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(c.dateDebut)} → {fmtDate(c.dateFin)}</td>
                      <td className="px-4 py-3 font-medium">{fmtGNF(c.budgetTotal)}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.statut} /></td>
                      <td className="px-4 py-3"><StatusBadge status={c.validationCreation} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? 'Modifier la campagne' : 'Nouvelle campagne'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom de campagne *</Label><Input value={form.nomCampagne ?? ''} onChange={e => set('nomCampagne', e.target.value)} /></div>

            {/* Client field with toggle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Client</Label>
                <button
                  type="button"
                  onClick={() => {
                    setClientMode(m => m === 'liste' ? 'manuel' : 'liste');
                    set('clientId', '');
                    set('clientManuel', '');
                  }}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  {clientMode === 'liste' ? <><ChevronDown className="w-3 h-3" />Saisie manuelle</> : <><ChevronUp className="w-3 h-3" />Choisir dans la liste</>}
                </button>
              </div>
              {clientMode === 'liste' ? (
                <Select value={form.clientId ?? '_none'} onValueChange={v => set('clientId', v === '_none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Aucun client</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nomClient}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="Nom du client (saisie libre)"
                  value={form.clientManuel ?? ''}
                  onChange={e => set('clientManuel', e.target.value)}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date début</Label><Input type="date" value={form.dateDebut ?? ''} onChange={e => set('dateDebut', e.target.value)} /></div>
              <div><Label>Date fin</Label><Input type="date" value={form.dateFin ?? ''} onChange={e => set('dateFin', e.target.value)} /></div>
            </div>

            {/* Budget in GNF */}
            <div>
              <Label>Budget (GNF)</Label>
              <div className="relative">
                <Input
                  type="number"
                  className="pr-14"
                  placeholder="0"
                  value={form.budgetTotal ?? ''}
                  onChange={e => set('budgetTotal', e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground pointer-events-none">GNF</span>
              </div>
              {form.budgetTotal && !isNaN(parseFloat(form.budgetTotal)) && (
                <p className="text-xs text-muted-foreground mt-1">{parseFloat(form.budgetTotal).toLocaleString('fr-FR')} GNF</p>
              )}
            </div>

            <div>
              <Label>Statut campagne</Label>
              <Select value={form.statut ?? 'Brouillon'} onValueChange={v => set('statut', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Brouillon','En attente','Validée','En cours','Terminée','Annulée'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Validation création</Label>
              <Select value={form.validationCreation ?? 'En attente'} onValueChange={v => set('validationCreation', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['En attente','Validée','Refusée','En révision'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Commercial responsable</Label><Input value={form.commercialResponsable ?? ''} onChange={e => set('commercialResponsable', e.target.value)} /></div>
            <div><Label>Description</Label><Textarea rows={3} value={form.description ?? ''} onChange={e => set('description', e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la campagne ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
