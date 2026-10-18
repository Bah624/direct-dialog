import { useEffect, useState } from 'react';
import { getFactures, saveFacture, deleteFacture, GetFacturesOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Card, CardContent } from '@project/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Plus, Pencil, Trash2, FileText, Paperclip, X, Loader2, Printer } from 'lucide-react';
import { uploadFile } from 'zitejs/upload';
import StatusBadge from '@/components/StatusBadge';
import { Skeleton } from '@project/components/ui/skeleton';
import { toast } from 'sonner';
import { Toaster } from '@project/components/ui/sonner';

type Fac = GetFacturesOutputType['factures'][0];
type ClientOpt = GetFacturesOutputType['clients'][0];
type CampOpt = GetFacturesOutputType['campagnes'][0];

const EMPTY: Record<string, any> = { numeroFacture: '', statutPaiement: 'Brouillon' };
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const fmtCurrency = (n?: number) => n != null ? n.toLocaleString('fr-FR') + ' GNF' : '—';

export default function FacturesPage() {
  const [factures, setFactures] = useState<Fac[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [campagnes, setCampagnes] = useState<CampOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState('');
  const [form, setForm] = useState<Record<string, any>>(EMPTY);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string }[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const results = await Promise.all(
        files.map(f => uploadFile({ data: f, filename: f.name }))
      );
      const newFiles = files.map((f, i) => ({ name: f.name, url: results[i].fileUrl }));
      setUploadedFiles(prev => [...prev, ...newFiles]);
      toast.success(`${files.length} fichier(s) téléchargé(s)`);
    } catch {
      toast.error('Erreur lors du téléchargement');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeFile = (idx: number) => setUploadedFiles(prev => prev.filter((_, i) => i !== idx));

  const load = async () => {
    const res = await getFactures({ statut: filterStatut || undefined });
    setFactures(res.factures);
    setClients(res.clients);
    setCampagnes(res.campagnes);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterStatut]);

  const openNew = () => { setForm(EMPTY); setUploadedFiles([]); setDialogOpen(true); };
  const openEdit = (f: Fac) => {
    setForm({ ...f, montantHt: f.montantHt?.toString() ?? '', tva: f.tva?.toString() ?? '', montantTtc: f.montantTtc?.toString() ?? '' });
    // Reload existing attachments
    setUploadedFiles((f.piecesJointes ?? []).map(p => ({
      name: p.url.split('/').pop() ?? 'fichier',
      url: p.url,
    })));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.numeroFacture) return toast.error('Numéro de facture requis');
    setSaving(true);
    try {
      await saveFacture({
        ...form,
        montantHt: form.montantHt ? parseFloat(form.montantHt) : undefined,
        tva: form.tva ? parseFloat(form.tva) : undefined,
        montantTtc: form.montantTtc ? parseFloat(form.montantTtc) : undefined,
        piecesJointes: uploadedFiles.map(f => ({ url: f.url })),
      } as any);
      toast.success(form.id ? 'Facture mise à jour' : 'Facture créée');
      setDialogOpen(false);
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteFacture({ id: deleteId });
    setDeleteId(null);
    toast.success('Facture supprimée');
    load();
  };

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // Auto-calculate TTC
  const handleHtChange = (v: string) => {
    const ht = parseFloat(v) || 0;
    const tva = parseFloat(form.tva) || 0;
    set('montantHt', v);
    setForm(f => ({ ...f, montantHt: v, montantTtc: (ht + (ht * tva / 100)).toFixed(2) }));
  };
  const handleTvaChange = (v: string) => {
    const ht = parseFloat(form.montantHt) || 0;
    const tva = parseFloat(v) || 0;
    setForm(f => ({ ...f, tva: v, montantTtc: (ht + (ht * tva / 100)).toFixed(2) }));
  };

  const totalPaye = factures.filter(f => f.statutPaiement === 'Payée').reduce((s, f) => s + (f.montantTtc || 0), 0);
  const totalEnAttente = factures.filter(f => f.statutPaiement === 'Envoyée').reduce((s, f) => s + (f.montantTtc || 0), 0);

  return (
    <div className="space-y-4">
      <Toaster />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total payé', value: fmtCurrency(totalPaye), color: 'text-green-600' },
          { label: 'En attente de paiement', value: fmtCurrency(totalEnAttente), color: 'text-blue-600' },
          { label: 'Nb. factures', value: factures.length.toString(), color: 'text-foreground' },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`text-xl font-bold mt-1 ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterStatut || '_all'} onValueChange={v => setFilterStatut(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Tous les statuts</SelectItem>
            {['Brouillon','Envoyée','Payée','En retard','Partiellement payée'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()} className="gap-2 print:hidden">
            <Printer className="w-4 h-4" />Imprimer
          </Button>
          <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Nouvelle facture</Button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold">DIRECT DIALOG — Rapport de Facturation</h1>
        <p className="text-sm text-gray-500">Imprimé le {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        <hr className="mt-3" />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : factures.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground gap-2">
              <FileText className="w-10 h-10 opacity-30" /><p className="text-sm">Aucune facture trouvée</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    {['N° Facture', 'Client', 'Campagne', 'Émission', 'Échéance', 'HT', 'TTC', 'Statut', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {factures.map(f => (
                    <tr key={f.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{f.numeroFacture}</td>
                      <td className="px-4 py-3 text-muted-foreground">{f.clientNom || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{f.campagneNom || '—'}</td>
                      <td className="px-4 py-3">{fmtDate(f.dateEmission)}</td>
                      <td className="px-4 py-3">{fmtDate(f.dateEcheance)}</td>
                      <td className="px-4 py-3">{fmtCurrency(f.montantHt)}</td>
                      <td className="px-4 py-3 font-semibold">{fmtCurrency(f.montantTtc)}</td>
                      <td className="px-4 py-3"><StatusBadge status={f.statutPaiement} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(f)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(f.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
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
          <DialogHeader><DialogTitle>{form.id ? 'Modifier la facture' : 'Nouvelle facture'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>N° Facture *</Label><Input value={form.numeroFacture ?? ''} onChange={e => set('numeroFacture', e.target.value)} /></div>
            <div>
              <Label>Client</Label>
              <Select value={form.clientId ?? '_none'} onValueChange={v => set('clientId', v === '_none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Aucun</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nomClient}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Campagne</Label>
              <Select value={form.campagneId ?? '_none'} onValueChange={v => set('campagneId', v === '_none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une campagne" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Aucune</SelectItem>
                  {campagnes.map(c => <SelectItem key={c.id} value={c.id}>{c.nomCampagne}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date d'émission</Label><Input type="date" value={form.dateEmission ?? ''} onChange={e => set('dateEmission', e.target.value)} /></div>
              <div><Label>Date d'échéance</Label><Input type="date" value={form.dateEcheance ?? ''} onChange={e => set('dateEcheance', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Montant HT (GNF)</Label><Input type="number" value={form.montantHt ?? ''} onChange={e => handleHtChange(e.target.value)} /></div>
              <div><Label>TVA (%)</Label><Input type="number" value={form.tva ?? ''} onChange={e => handleTvaChange(e.target.value)} /></div>
              <div><Label>Montant TTC (GNF)</Label><Input type="number" value={form.montantTtc ?? ''} onChange={e => set('montantTtc', e.target.value)} /></div>
            </div>
            <div>
              <Label>Statut paiement</Label>
              <Select value={form.statutPaiement ?? 'Brouillon'} onValueChange={v => set('statutPaiement', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Brouillon','Envoyée','Payée','En retard','Partiellement payée'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Textarea rows={3} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} /></div>

            {/* File upload */}
            <div className="space-y-2">
              <Label>Pièces jointes (PDF, JPEG, CSV)</Label>
              <label className={`flex items-center gap-2 w-full border-2 border-dashed border-border rounded-lg px-4 py-3 cursor-pointer hover:border-primary hover:bg-accent transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.csv"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
                {uploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin text-primary" /><span className="text-sm text-muted-foreground">Téléchargement...</span></>
                ) : (
                  <><Paperclip className="w-4 h-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Cliquer pour joindre un fichier</span></>
                )}
              </label>
              {uploadedFiles.length > 0 && (
                <div className="space-y-1.5">
                  {uploadedFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
                      <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs text-foreground hover:underline flex-1 truncate">{f.name}</a>
                      <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
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
            <AlertDialogTitle>Supprimer la facture ?</AlertDialogTitle>
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
