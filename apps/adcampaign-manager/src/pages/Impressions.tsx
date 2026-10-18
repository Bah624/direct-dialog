import { useEffect, useState } from 'react';
import { getImpressions, saveImpression, deleteImpression, GetImpressionsOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Card, CardContent } from '@project/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Plus, Pencil, Trash2, Printer, ChevronDown, ChevronUp, Upload, FileText, X as XIcon, ExternalLink, Loader2 } from 'lucide-react';
import { uploadFile } from 'zitejs/upload';
import StatusBadge from '@/components/StatusBadge';
import { Skeleton } from '@project/components/ui/skeleton';
import { toast } from 'sonner';
import { Toaster } from '@project/components/ui/sonner';

type Imp = GetImpressionsOutputType['impressions'][0];
type Camp = GetImpressionsOutputType['campagnes'][0];

const TYPES_TRAVAUX = [
  'Impression',
  'Affichage',
  'Branding',
  'Soudure',
  'Décapoter (retrait vinyle)',
  'Pose de vinyle',
  'Installation panneau',
  'Maintenance / Réparation',
  'Retouche & finition',
  'Autre',
];

const TYPE_COLORS: Record<string, string> = {
  'Impression': 'bg-blue-100 text-blue-700',
  'Affichage': 'bg-purple-100 text-purple-700',
  'Branding': 'bg-pink-100 text-pink-700',
  'Soudure': 'bg-orange-100 text-orange-700',
  'Décapoter (retrait vinyle)': 'bg-yellow-100 text-yellow-700',
  'Pose de vinyle': 'bg-teal-100 text-teal-700',
  'Installation panneau': 'bg-indigo-100 text-indigo-700',
  'Maintenance / Réparation': 'bg-red-100 text-red-700',
  'Retouche & finition': 'bg-lime-100 text-lime-700',
  'Autre': 'bg-gray-100 text-gray-600',
};

function TypeBadge({ type }: { type: string }) {
  const cls = TYPE_COLORS[type] ?? 'bg-muted text-muted-foreground';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{type}</span>;
}

const EMPTY: Record<string, any> = { referenceImpression: '', statut: 'Planifiée' };
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

export default function ImpressionsPage() {
  const [impressions, setImpressions] = useState<Imp[]>([]);
  const [campagnes, setCampagnes] = useState<Camp[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState('');
  const [form, setForm] = useState<Record<string, any>>(EMPTY);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [campagneMode, setCampagneMode] = useState<'liste' | 'manuel'>('liste');
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const res = await getImpressions({ statut: filterStatut || undefined });
    setImpressions(res.impressions);
    setCampagnes(res.campagnes);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterStatut]);

  const openNew = () => { setForm(EMPTY); setCampagneMode('liste'); setDialogOpen(true); };
  const openEdit = (i: Imp) => {
    setForm({ ...i, quantite: i.quantite?.toString() ?? '', campagneManuel: i.campagneNom ?? '', batFichierUrls: i.batFichier?.map((f: any) => f.url) ?? [] });
    setCampagneMode(i.campagneId ? 'liste' : 'manuel');
    setDialogOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [...(form.batFichierUrls ?? [])];
      for (let i = 0; i < files.length; i++) {
        const { fileUrl } = await uploadFile({ data: files[i], filename: files[i].name });
        urls.push(fileUrl);
      }
      set('batFichierUrls', urls);
      toast.success(`${files.length} fichier(s) téléversé(s)`);
    } catch {
      toast.error('Erreur lors du téléversement');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeFile = (idx: number) => {
    set('batFichierUrls', (form.batFichierUrls ?? []).filter((_: any, i: number) => i !== idx));
  };

  const handleSave = async () => {
    if (!form.referenceImpression) return toast.error('Référence requise');
    setSaving(true);
    try {
      await saveImpression({ ...form, quantite: form.quantite ? parseFloat(form.quantite) : undefined, batFichierUrls: form.batFichierUrls ?? [] } as any);
      toast.success(form.id ? 'Impression mise à jour' : 'Impression créée');
      setDialogOpen(false);
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteImpression({ id: deleteId });
    setDeleteId(null);
    toast.success('Impression supprimée');
    load();
  };

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <Toaster />
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterStatut || '_all'} onValueChange={v => setFilterStatut(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Tous les statuts</SelectItem>
            {['Planifiée','En cours','Terminée','Annulée'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" />Imprimer
          </Button>
          <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Nouvelle impression</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : impressions.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground gap-2">
              <Printer className="w-10 h-10 opacity-30" /><p className="text-sm">Aucune impression trouvée</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    {['Référence', 'Type de travaux', 'Campagne', 'Date planifiée', 'Date réalisation', 'Format', 'Qté', 'Machiniste', 'BAT', 'Statut', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {impressions.map(i => (
                    <tr key={i.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{i.referenceImpression}</td>
                      <td className="px-4 py-3">{i.typeDeTravaux ? <TypeBadge type={i.typeDeTravaux} /> : '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{i.campagneNom || '—'}</td>
                      <td className="px-4 py-3">{fmtDate(i.datePlanifiee)}</td>
                      <td className="px-4 py-3">{fmtDate(i.dateRealisation)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{i.formatImpression || '—'}</td>
                      <td className="px-4 py-3">{i.quantite ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{i.machinisteAssigne || '—'}</td>
                      <td className="px-4 py-3">
                        {i.batFichier?.length ? (
                          <div className="flex flex-col gap-1">
                            {i.batFichier.map((f: any, idx: number) => {
                              const name = decodeURIComponent(f.url.split('/').pop() || 'Fichier');
                              return (
                                <a key={idx} href={f.url} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline max-w-[120px] truncate">
                                  <FileText className="w-3 h-3 flex-shrink-0" /><span className="truncate">{name}</span>
                                </a>
                              );
                            })}
                          </div>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={i.statut} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(i)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(i.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
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
          <DialogHeader><DialogTitle>{form.id ? 'Modifier l\'impression' : 'Nouvelle impression'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Référence *</Label><Input value={form.referenceImpression ?? ''} onChange={e => set('referenceImpression', e.target.value)} /></div>
            <div>
              <Label>Type de travaux</Label>
              <Select value={form.typeDeTravaux ?? '_none'} onValueChange={v => set('typeDeTravaux', v === '_none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Aucun —</SelectItem>
                  {TYPES_TRAVAUX.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Campagne</Label>
                <button
                  type="button"
                  onClick={() => { setCampagneMode(m => m === 'liste' ? 'manuel' : 'liste'); set('campagneId', ''); set('campagneManuel', ''); }}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  {campagneMode === 'liste' ? <><ChevronDown className="w-3 h-3" />Saisie manuelle</> : <><ChevronUp className="w-3 h-3" />Choisir dans la liste</>}
                </button>
              </div>
              {campagneMode === 'liste' ? (
                <Select value={form.campagneId ?? '_none'} onValueChange={v => set('campagneId', v === '_none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner une campagne" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Aucune</SelectItem>
                    {campagnes.map(c => <SelectItem key={c.id} value={c.id}>{c.nomCampagne}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input placeholder="Nom de la campagne (saisie libre)" value={form.campagneManuel ?? ''} onChange={e => set('campagneManuel', e.target.value)} />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date planifiée</Label><Input type="date" value={form.datePlanifiee ?? ''} onChange={e => set('datePlanifiee', e.target.value)} /></div>
              <div><Label>Date réalisation</Label><Input type="date" value={form.dateRealisation ?? ''} onChange={e => set('dateRealisation', e.target.value)} /></div>
            </div>
            <div><Label>Format impression</Label><Input value={form.formatImpression ?? ''} onChange={e => set('formatImpression', e.target.value)} /></div>
            <div><Label>Quantité</Label><Input type="number" value={form.quantite ?? ''} onChange={e => set('quantite', e.target.value)} /></div>
            <div><Label>Machiniste assigné</Label><Input value={form.machinisteAssigne ?? ''} onChange={e => set('machinisteAssigne', e.target.value)} /></div>
            <div><Label>Chef atelier</Label><Input value={form.chefAtelier ?? ''} onChange={e => set('chefAtelier', e.target.value)} /></div>
            <div>
              <Label>Statut</Label>
              <Select value={form.statut ?? 'Planifiée'} onValueChange={v => set('statut', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Planifiée','En cours','Terminée','Annulée'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Bon d'impression / BAT */}
            <div className="space-y-2">
              <Label>Bon d'impression / BAT</Label>
              <div className="border border-dashed border-border rounded-lg p-3 bg-muted/20">
                {(form.batFichierUrls ?? []).length > 0 && (
                  <div className="space-y-2 mb-3">
                    {(form.batFichierUrls ?? []).map((url: string, idx: number) => {
                      const name = decodeURIComponent(url.split('/').pop() || 'Fichier');
                      return (
                        <div key={idx} className="flex items-center gap-2 bg-card border border-border rounded-md px-3 py-2">
                          <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate flex-1">{name}</a>
                          <button type="button" onClick={() => removeFile(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <XIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <label className={`flex items-center justify-center gap-2 px-4 py-3 rounded-md border border-border cursor-pointer transition-colors ${uploading ? 'bg-muted cursor-wait' : 'hover:bg-muted/60 bg-card'}`}>
                  {uploading ? (
                    <><Loader2 className="w-4 h-4 animate-spin text-primary" /><span className="text-xs text-muted-foreground">Téléversement…</span></>
                  ) : (
                    <><Upload className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Cliquez pour ajouter un fichier (PDF, image…)</span></>
                  )}
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.svg,.doc,.docx,.xls,.xlsx" multiple onChange={handleFileUpload} disabled={uploading} />
                </label>
              </div>
            </div>
            <div><Label>Notes</Label><Textarea rows={3} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} /></div>
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
            <AlertDialogTitle>Supprimer l'impression ?</AlertDialogTitle>
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
