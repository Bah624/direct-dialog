import { useEffect, useState } from 'react';
import { getReservations, saveReservation, deleteReservation, GetReservationsOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Card, CardContent } from '@project/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Label } from '@project/components/ui/label';
import { Plus, Pencil, Trash2, CalendarCheck, ChevronDown, ChevronUp } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { Skeleton } from '@project/components/ui/skeleton';
import { toast } from 'sonner';
import { Toaster } from '@project/components/ui/sonner';
type Res = GetReservationsOutputType['reservations'][0];
type Camp = GetReservationsOutputType['campagnes'][0];
type Emp = GetReservationsOutputType['emplacements'][0];
const EMPTY: Record<string, any> = {
  referenceReservation: '',
  statut: 'En attente'
};
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const fmtCurrency = (n?: number) => n != null ? n.toLocaleString('fr-FR') + ' GNF' : '—';
export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Res[]>([]);
  const [campagnes, setCampagnes] = useState<Camp[]>([]);
  const [emplacements, setEmplacements] = useState<Emp[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState('');
  const [form, setForm] = useState<Record<string, any>>(EMPTY);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [campagneMode, setCampagneMode] = useState<'liste' | 'manuel'>('liste');
  const [emplacementMode, setEmplacementMode] = useState<'liste' | 'manuel'>('liste');
  const load = async () => {
    const res = await getReservations({
      statut: filterStatut || undefined
    });
    setReservations(res.reservations);
    setCampagnes(res.campagnes);
    setEmplacements(res.emplacements);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, [filterStatut]);
  const openNew = () => {
    setForm(EMPTY);
    setCampagneMode('liste');
    setEmplacementMode('liste');
    setDialogOpen(true);
  };
  const openEdit = (r: Res) => {
    setForm({
      ...r,
      montant: r.montant?.toString() ?? '',
      campagneManuel: r.campagneNom ?? '',
      emplacementManuel: r.emplacementRef ?? ''
    });
    setCampagneMode(r.campagneId ? 'liste' : 'manuel');
    setEmplacementMode(r.emplacementId ? 'liste' : 'manuel');
    setDialogOpen(true);
  };
  const handleSave = async () => {
    if (!form.referenceReservation) return toast.error('Référence requise');
    setSaving(true);
    try {
      await saveReservation({
        ...form,
        montant: form.montant ? parseFloat(form.montant) : undefined
      } as any);
      toast.success(form.id ? 'Réservation mise à jour' : 'Réservation créée');
      setDialogOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };
  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteReservation({
      id: deleteId
    });
    setDeleteId(null);
    toast.success('Réservation supprimée');
    load();
  };
  const set = (k: string, v: any) => setForm(f => ({
    ...f,
    [k]: v
  }));
  return <div className="space-y-4">
      <Toaster />
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterStatut || '_all'} onValueChange={v => setFilterStatut(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Tous les statuts</SelectItem>
            {['Confirmée', 'En attente', 'Annulée'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={openNew} className="gap-2 ml-auto"><Plus className="w-4 h-4" />Nouvelle réservation</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div> : reservations.length === 0 ? <div className="flex flex-col items-center py-16 text-muted-foreground gap-2">
              <CalendarCheck className="w-10 h-10 opacity-30" /><p className="text-sm">Aucune réservation trouvée</p>
            </div> : <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    {['Référence', 'Campagne', 'Emplacement', 'Ville', 'Période', 'Montant', 'Statut', ''].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reservations.map(r => <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{r.referenceReservation}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.campagneNom || '—'}</td>
                      <td className="px-4 py-3">{r.emplacementRef || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.emplacementVille || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(r.dateDebut)} → {fmtDate(r.dateFin)}</td>
                      <td className="px-4 py-3 font-medium">{fmtCurrency(r.montant)}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.statut} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                    </tr>)}
                </tbody>
              </table>
            </div>}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? 'Modifier la réservation' : 'Nouvelle réservation'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Référence *</Label><Input value={form.referenceReservation ?? ''} onChange={e => set('referenceReservation', e.target.value)} /></div>
            {/* Campagne */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Campagne</Label>
                <button type="button" onClick={() => {
                setCampagneMode(m => m === 'liste' ? 'manuel' : 'liste');
                set('campagneId', '');
                set('campagneManuel', '');
              }} className="text-xs text-primary hover:underline flex items-center gap-1">
                  {campagneMode === 'liste' ? <><ChevronDown className="w-3 h-3" />Saisie manuelle</> : <><ChevronUp className="w-3 h-3" />Choisir dans la liste</>}
                </button>
              </div>
              {campagneMode === 'liste' ? <Select value={form.campagneId ?? '_none'} onValueChange={v => set('campagneId', v === '_none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner une campagne" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Aucune</SelectItem>
                    {campagnes.map(c => <SelectItem key={c.id} value={c.id}>{c.nomCampagne}</SelectItem>)}
                  </SelectContent>
                </Select> : <Input placeholder="Nom de la campagne (saisie libre)" value={form.campagneManuel ?? ''} onChange={e => set('campagneManuel', e.target.value)} />}
            </div>

            {/* Emplacement */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Emplacement</Label>
                <button type="button" onClick={() => {
                setEmplacementMode(m => m === 'liste' ? 'manuel' : 'liste');
                set('emplacementId', '');
                set('emplacementManuel', '');
              }} className="text-xs text-primary hover:underline flex items-center gap-1">
                  {emplacementMode === 'liste' ? <><ChevronDown className="w-3 h-3" />Saisie manuelle</> : <><ChevronUp className="w-3 h-3" />Choisir dans la liste</>}
                </button>
              </div>
              {emplacementMode === 'liste' ? <Select value={form.emplacementId ?? '_none'} onValueChange={v => set('emplacementId', v === '_none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un emplacement" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Aucun</SelectItem>
                    {emplacements.map(e => <SelectItem key={e.id} value={e.id}>{e.referenceEmplacement} {e.ville ? `— ${e.ville}` : ''}</SelectItem>)}
                  </SelectContent>
                </Select> : <Input placeholder="Référence emplacement (saisie libre)" value={form.emplacementManuel ?? ''} onChange={e => set('emplacementManuel', e.target.value)} />}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date début</Label><Input type="date" value={form.dateDebut ?? ''} onChange={e => set('dateDebut', e.target.value)} /></div>
              <div><Label>Date fin</Label><Input type="date" value={form.dateFin ?? ''} onChange={e => set('dateFin', e.target.value)} /></div>
            </div>
            <div><Label className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>Montant (Gnf)</Label><Input type="number" value={form.montant ?? ''} onChange={e => set('montant', e.target.value)} /></div>
            <div>
              <Label>Statut</Label>
              <Select value={form.statut ?? 'En attente'} onValueChange={v => set('statut', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Confirmée', 'En attente', 'Annulée'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
            <AlertDialogTitle>Supprimer la réservation ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
}