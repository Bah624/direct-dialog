import { useEffect, useState } from 'react';
import { getClients, saveClient, deleteClient, GetClientsOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Card, CardContent } from '@project/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Label } from '@project/components/ui/label';
import { Plus, Search, Pencil, Trash2, Users } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { Skeleton } from '@project/components/ui/skeleton';
import { toast } from 'sonner';
import { Toaster } from '@project/components/ui/sonner';

type Client = GetClientsOutputType['clients'][0];

const EMPTY: Partial<Client> = { nomClient: '', email: '', telephone: '', adresse: '', secteurDactivite: '', statut: 'Actif' };

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<Partial<Client>>(EMPTY);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async (s = search) => {
    const res = await getClients({ search: s || undefined });
    setClients(res.clients);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (c: Client) => { setForm(c); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.nomClient) return toast.error('Nom du client requis');
    setSaving(true);
    try {
      await saveClient(form as any);
      toast.success(form.id ? 'Client mis à jour' : 'Client créé');
      setDialogOpen(false);
      load('');
      setSearch('');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteClient({ id: deleteId });
    setDeleteId(null);
    toast.success('Client supprimé');
    load('');
  };

  const handleSearch = (v: string) => { setSearch(v); load(v); };

  return (
    <div className="space-y-4">
      <Toaster />
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher un client..." value={search} onChange={e => handleSearch(e.target.value)} />
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Nouveau client</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground gap-2">
              <Users className="w-10 h-10 opacity-30" />
              <p className="text-sm">Aucun client trouvé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    {['Nom', 'Email', 'Téléphone', 'Secteur', 'Statut', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clients.map(c => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{c.nomClient}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.email || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.telephone || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.secteurDactivite || '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.statut} /></td>
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

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{form.id ? 'Modifier le client' : 'Nouveau client'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom *</Label><Input value={form.nomClient ?? ''} onChange={e => setForm(f => ({ ...f, nomClient: e.target.value }))} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><Label>Téléphone</Label><Input value={form.telephone ?? ''} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} /></div>
            <div><Label>Adresse</Label><Input value={form.adresse ?? ''} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} /></div>
            <div><Label>Secteur d'activité</Label><Input value={form.secteurDactivite ?? ''} onChange={e => setForm(f => ({ ...f, secteurDactivite: e.target.value }))} /></div>
            <div>
              <Label>Statut</Label>
              <Select value={form.statut ?? 'Actif'} onValueChange={v => setForm(f => ({ ...f, statut: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Actif">Actif</SelectItem>
                  <SelectItem value="Inactif">Inactif</SelectItem>
                  <SelectItem value="Prospect">Prospect</SelectItem>
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

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le client ?</AlertDialogTitle>
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
