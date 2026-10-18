import { useEffect, useState } from 'react';
import { getEmplacements, saveEmplacement, deleteEmplacement, GetEmplacementsOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Card, CardContent } from '@project/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Label } from '@project/components/ui/label';
import { Plus, Search, Pencil, Trash2, MapPin } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { Skeleton } from '@project/components/ui/skeleton';
import { toast } from 'sonner';
import { Toaster } from '@project/components/ui/sonner';

type Emp = GetEmplacementsOutputType['emplacements'][0];

const EMPTY: Record<string, any> = { referenceEmplacement: '', disponibilite: 'Disponible', type: 'Panneau' };
const fmtCurrency = (n?: number) => n != null ? n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) : '—';

export default function EmplacementsPage() {
  const [emplacements, setEmplacements] = useState<Emp[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDispo, setFilterDispo] = useState('');
  const [form, setForm] = useState<Record<string, any>>(EMPTY);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await getEmplacements({ search: search || undefined, disponibilite: filterDispo || undefined });
    setEmplacements(res.emplacements);
    setLoading(false);
  };

  useEffect(() => { load(); }, [search, filterDispo]);

  const openNew = () => { setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (e: Emp) => { setForm({ ...e, prixParSemaine: e.prixParSemaine?.toString() ?? '' }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.referenceEmplacement) return toast.error('Référence requise');
    setSaving(true);
    try {
      await saveEmplacement({ ...form, prixParSemaine: form.prixParSemaine ? parseFloat(form.prixParSemaine) : undefined } as any);
      toast.success(form.id ? 'Emplacement mis à jour' : 'Emplacement créé');
      setDialogOpen(false);
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteEmplacement({ id: deleteId });
    setDeleteId(null);
    toast.success('Emplacement supprimé');
    load();
  };

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <Toaster />
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterDispo || '_all'} onValueChange={v => setFilterDispo(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Disponibilité" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Toutes</SelectItem>
            {['Disponible','Réservé','Occupé','En maintenance'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Nouvel emplacement</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : emplacements.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground gap-2">
              <MapPin className="w-10 h-10 opacity-30" /><p className="text-sm">Aucun emplacement trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    {['Référence', 'Localisation', 'Ville', 'Type', 'Format', 'Prix/semaine', 'Disponibilité', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {emplacements.map(e => (
                    <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{e.referenceEmplacement}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.localisation || '—'}</td>
                      <td className="px-4 py-3">{e.ville || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.type || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.format || '—'}</td>
                      <td className="px-4 py-3 font-medium">{fmtCurrency(e.prixParSemaine)}</td>
                      <td className="px-4 py-3"><StatusBadge status={e.disponibilite} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(e.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
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
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{form.id ? 'Modifier l\'emplacement' : 'Nouvel emplacement'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Référence *</Label><Input value={form.referenceEmplacement ?? ''} onChange={e => set('referenceEmplacement', e.target.value)} /></div>
            <div><Label>Localisation</Label><Input value={form.localisation ?? ''} onChange={e => set('localisation', e.target.value)} /></div>
            <div><Label>Ville</Label><Input value={form.ville ?? ''} onChange={e => set('ville', e.target.value)} /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.type ?? 'Panneau'} onValueChange={v => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Panneau','Affichage Urbain','Billboard','Abribus'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Format (ex: 4x3m)</Label><Input value={form.format ?? ''} onChange={e => set('format', e.target.value)} /></div>
            <div><Label>Prix par semaine (€)</Label><Input type="number" value={form.prixParSemaine ?? ''} onChange={e => set('prixParSemaine', e.target.value)} /></div>
            <div>
              <Label>Disponibilité</Label>
              <Select value={form.disponibilite ?? 'Disponible'} onValueChange={v => set('disponibilite', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Disponible','Réservé','Occupé','En maintenance'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
            <AlertDialogTitle>Supprimer l'emplacement ?</AlertDialogTitle>
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
