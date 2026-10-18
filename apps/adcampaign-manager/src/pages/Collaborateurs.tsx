import { useEffect, useState } from 'react';
import {
  getCollaborateurs, saveCollaborateur, deleteCollaborateur,
  GetCollaborateursOutputType,
} from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Card, CardContent } from '@project/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@project/components/ui/alert-dialog';
import { Label } from '@project/components/ui/label';
import { Switch } from '@project/components/ui/switch';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { Plus, Pencil, Trash2, Mail, Bell, BellOff, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@project/components/ui/sonner';

type Collab = GetCollaborateursOutputType['collaborateurs'][0];

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const EMPTY = { nomComplet: '', email: '', poste: '', notificationsActives: true };

export default function CollaborateursPage() {
  const [collabs, setCollabs] = useState<Collab[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, any>>(EMPTY);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await getCollaborateurs({});
    setCollabs(res.collaborateurs);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (c: Collab) => { setForm({ ...c }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.nomComplet || !form.email) return toast.error('Nom et email requis');
    setSaving(true);
    try {
      await saveCollaborateur(form as any);
      toast.success(form.id ? 'Collaborateur mis à jour' : 'Collaborateur ajouté');
      setDialogOpen(false);
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteCollaborateur({ id: deleteId });
    setDeleteId(null);
    toast.success('Collaborateur supprimé');
    load();
  };

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const activeCount = collabs.filter(c => c.notificationsActives).length;

  return (
    <div className="space-y-5">
      <Toaster />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Collaborateurs & Notifications</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gérez les emails de votre équipe. Chaque collaborateur actif sera notifié automatiquement quand une campagne est validée.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2"><UserPlus className="w-4 h-4" />Ajouter un collaborateur</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{collabs.length}</p>
              <p className="text-xs text-muted-foreground">Total collaborateurs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Notifications actives</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <BellOff className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{collabs.length - activeCount}</p>
              <p className="text-xs text-muted-foreground">Notifications désactivées</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : collabs.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground gap-3">
              <Mail className="w-12 h-12 opacity-30" />
              <p className="text-sm">Aucun collaborateur ajouté</p>
              <Button size="sm" onClick={openNew} className="gap-1.5"><Plus className="w-3.5 h-3.5" />Ajouter le premier</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    {['Nom', 'Email', 'Poste', 'Notifications', 'Ajouté le', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {collabs.map(c => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{c.nomComplet || '—'}</td>
                      <td className="px-4 py-3">
                        <a href={`mailto:${c.email}`} className="text-primary hover:underline">{c.email}</a>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.poste || '—'}</td>
                      <td className="px-4 py-3">
                        {c.notificationsActives ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1"><Bell className="w-3 h-3" />Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1"><BellOff className="w-3 h-3" />Désactivée</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(c.dateAjout)}</td>
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

      {/* Info banner */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <Mail className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-sm text-foreground">
          <p className="font-medium mb-1">Comment ça marche ?</p>
          <p className="text-muted-foreground">
            Quand vous changez le statut d'une campagne à <strong>« Validée »</strong>, un email de notification est automatiquement envoyé 
            à tous les collaborateurs ayant les notifications actives. L'email contient le nom de la campagne, le client, le budget, les dates et le commercial responsable.
          </p>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{form.id ? 'Modifier le collaborateur' : 'Nouveau collaborateur'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nom complet *</Label><Input value={form.nomComplet ?? ''} onChange={e => set('nomComplet', e.target.value)} placeholder="Ex: Alpha Diallo" /></div>
            <div><Label>Email *</Label><Input type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} placeholder="alpha@directdialog.com" /></div>
            <div><Label>Poste</Label><Input value={form.poste ?? ''} onChange={e => set('poste', e.target.value)} placeholder="Ex: Directeur commercial" /></div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Notifications email</p>
                <p className="text-xs text-muted-foreground">Recevoir les alertes de validation</p>
              </div>
              <Switch checked={form.notificationsActives ?? true} onCheckedChange={v => set('notificationsActives', v)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce collaborateur ?</AlertDialogTitle>
            <AlertDialogDescription>Cette personne ne recevra plus les notifications de validation.</AlertDialogDescription>
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
