import { useEffect, useState, useRef } from 'react';
import { getStock, saveStock, deleteStock, getSorties, saveSortie, GetStockOutputType, GetSortiesOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Card, CardContent } from '@project/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@project/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Plus, Pencil, Trash2, Package, AlertTriangle, XCircle, Printer, TrendingUp, ArrowDownLeft, TrendingDown } from 'lucide-react';
import { Skeleton } from '@project/components/ui/skeleton';
import { toast } from 'sonner';
import { Toaster } from '@project/components/ui/sonner';
import { cn } from '@project/components/lib/utils';

type Item = GetStockOutputType['items'][0];
type Sortie = GetSortiesOutputType['sorties'][0];

const CATEGORIES = ['Vinyle', 'Encre', 'Papier grand format', 'Solvant & produits chimiques', 'Outillage', 'Profilé & structure', 'Visserie & fixation', 'Autre'];
const UNITES = ['m²', 'ml (millilitre)', 'L (litre)', 'kg', 'Pièce', 'Rouleau', 'Boîte', 'Mètre linéaire'];
const STATUTS = ['En stock', 'Stock faible', 'Rupture de stock', 'Commandé'];
const MOTIFS = ['Utilisation travaux', 'Perte / Détérioration', 'Retour fournisseur', 'Inventaire / Ajustement', 'Autre'];

const STATUT_STYLE: Record<string, string> = {
  'En stock': 'bg-green-100 text-green-700',
  'Stock faible': 'bg-yellow-100 text-yellow-700',
  'Rupture de stock': 'bg-red-100 text-red-700',
  'Commandé': 'bg-blue-100 text-blue-700',
};

const MOTIF_STYLE: Record<string, string> = {
  'Utilisation travaux': 'bg-blue-100 text-blue-700',
  'Perte / Détérioration': 'bg-red-100 text-red-700',
  'Retour fournisseur': 'bg-orange-100 text-orange-700',
  'Inventaire / Ajustement': 'bg-purple-100 text-purple-700',
  'Autre': 'bg-muted text-muted-foreground',
};

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const fmtQty = (n?: number, u?: string) => n != null ? `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}${u ? ' ' + u : ''}` : '—';
const fmtGNF = (n?: number) => n != null ? n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' GNF' : '—';

const EMPTY_ITEM: Record<string, any> = { referenceArticle: '', statutStock: 'En stock' };
const EMPTY_SORTIE: Record<string, any> = { dateSortie: new Date().toISOString().split('T')[0], motif: 'Utilisation travaux' };

function StatutBadge({ statut }: { statut?: string }) {
  if (!statut) return <span className="text-muted-foreground text-xs">—</span>;
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', STATUT_STYLE[statut] ?? 'bg-muted text-muted-foreground')}>{statut}</span>;
}

function MotifBadge({ motif }: { motif?: string }) {
  if (!motif) return <span className="text-muted-foreground text-xs">—</span>;
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', MOTIF_STYLE[motif] ?? 'bg-muted text-muted-foreground')}>{motif}</span>;
}

export default function StockPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [sorties, setSorties] = useState<Sortie[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSorties, setLoadingSorties] = useState(true);
  const [filterCat, setFilterCat] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('inventaire');

  // Item form
  const [itemForm, setItemForm] = useState<Record<string, any>>(EMPTY_ITEM);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [savingItem, setSavingItem] = useState(false);

  // Sortie form
  const [sortieForm, setSortieForm] = useState<Record<string, any>>(EMPTY_SORTIE);
  const [sortieDialogOpen, setSortieDialogOpen] = useState(false);
  const [savingSortie, setSavingSortie] = useState(false);

  const loadItems = async () => {
    const res = await getStock({ categorie: filterCat || undefined, statut: filterStatut || undefined });
    setItems(res.items);
    setLoading(false);
  };

  const loadSorties = async () => {
    setLoadingSorties(true);
    const res = await getSorties({});
    setSorties(res.sorties);
    setLoadingSorties(false);
  };

  useEffect(() => { loadItems(); }, [filterCat, filterStatut]);
  useEffect(() => { if (tab === 'sorties') loadSorties(); }, [tab]);

  const filtered = items.filter(i =>
    !search || i.nomArticle?.toLowerCase().includes(search.toLowerCase()) || i.referenceArticle?.toLowerCase().includes(search.toLowerCase())
  );

  const statsTotal = items.length;
  const statsFaible = items.filter(i => i.statutStock === 'Stock faible').length;
  const statsRupture = items.filter(i => i.statutStock === 'Rupture de stock').length;
  const statsValeur = items.reduce((acc, i) => acc + ((i.prixUnitaire ?? 0) * (i.quantiteEnStock ?? 0)), 0);

  // Item handlers
  const openNewItem = () => { setItemForm(EMPTY_ITEM); setItemDialogOpen(true); };
  const openEditItem = (i: Item) => { setItemForm({ ...i }); setItemDialogOpen(true); };
  const setItemField = (k: string, v: any) => setItemForm(f => ({ ...f, [k]: v }));

  const handleSaveItem = async () => {
    if (!itemForm.referenceArticle) return toast.error('Référence requise');
    setSavingItem(true);
    try {
      await saveStock({
        ...itemForm,
        quantiteEnStock: itemForm.quantiteEnStock ? parseFloat(itemForm.quantiteEnStock) : undefined,
        seuilDAlerte: itemForm.seuilDAlerte ? parseFloat(itemForm.seuilDAlerte) : undefined,
        prixUnitaire: itemForm.prixUnitaire ? parseFloat(itemForm.prixUnitaire) : undefined,
      } as any);
      toast.success(itemForm.id ? 'Article mis à jour' : 'Article créé');
      setItemDialogOpen(false);
      loadItems();
    } finally { setSavingItem(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteStock({ id: deleteId });
    setDeleteId(null);
    toast.success('Article supprimé');
    loadItems();
  };

  // Sortie handlers
  const openNewSortie = (articleId?: string) => {
    setSortieForm({ ...EMPTY_SORTIE, articleId: articleId ?? '' });
    setSortieDialogOpen(true);
  };

  const setSortieField = (k: string, v: any) => setSortieForm(f => ({ ...f, [k]: v }));

  const handleSaveSortie = async () => {
    if (!sortieForm.articleId) return toast.error('Article requis');
    if (!sortieForm.quantiteSortie || parseFloat(sortieForm.quantiteSortie) <= 0) return toast.error('Quantité invalide');
    setSavingSortie(true);
    try {
      const res = await saveSortie({
        articleId: sortieForm.articleId,
        quantiteSortie: parseFloat(sortieForm.quantiteSortie),
        motif: sortieForm.motif || undefined,
        dateSortie: sortieForm.dateSortie || undefined,
        responsable: sortieForm.responsable || undefined,
        notes: sortieForm.notes || undefined,
      });
      const art = items.find(i => i.id === sortieForm.articleId);
      toast.success(`Sortie enregistrée — Nouveau stock : ${fmtQty(res.newQuantite, art?.unite)}`);
      setSortieDialogOpen(false);
      loadItems();
      if (tab === 'sorties') loadSorties();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur lors de la sortie');
    } finally { setSavingSortie(false); }
  };

  return (
    <div className="space-y-5">
      <Toaster />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
        {[
          { label: 'Total articles', value: statsTotal, icon: Package, color: 'text-primary' },
          { label: 'Stock faible', value: statsFaible, icon: AlertTriangle, color: 'text-yellow-500' },
          { label: 'Rupture de stock', value: statsRupture, icon: XCircle, color: 'text-destructive' },
          { label: 'Valeur totale', value: fmtGNF(statsValeur), icon: TrendingUp, color: 'text-green-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`${color} bg-muted rounded-lg p-2`}><Icon className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-bold text-foreground text-lg leading-tight">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">DIRECT DIALOG — Rapport de Stock</h1>
        <p className="text-sm text-gray-500">Imprimé le {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        <div className="flex gap-6 mt-3 text-sm">
          <span>Total: <strong>{statsTotal}</strong></span>
          <span>Stock faible: <strong>{statsFaible}</strong></span>
          <span>Rupture: <strong>{statsRupture}</strong></span>
          <span>Valeur: <strong>{fmtGNF(statsValeur)}</strong></span>
        </div>
        <hr className="mt-3" />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="print:hidden">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="inventaire" className="gap-2"><Package className="w-3.5 h-3.5" />Inventaire</TabsTrigger>
            <TabsTrigger value="sorties" className="gap-2"><TrendingDown className="w-3.5 h-3.5" />Sorties de stock</TabsTrigger>
          </TabsList>

          {tab === 'inventaire' && (
            <div className="flex items-center gap-2 flex-wrap">
              <Input placeholder="Rechercher..." className="w-40" value={search} onChange={e => setSearch(e.target.value)} />
              <Select value={filterCat || '_all'} onValueChange={v => setFilterCat(v === '_all' ? '' : v)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Toutes catégories</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatut || '_all'} onValueChange={v => setFilterStatut(v === '_all' ? '' : v)}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Tous statuts</SelectItem>
                  {STATUTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => window.print()} className="gap-2">
                <Printer className="w-4 h-4" />Imprimer
              </Button>
              <Button onClick={openNewItem} className="gap-2"><Plus className="w-4 h-4" />Nouvel article</Button>
            </div>
          )}

          {tab === 'sorties' && (
            <Button onClick={() => openNewSortie()} className="gap-2">
              <ArrowDownLeft className="w-4 h-4" />Nouvelle sortie
            </Button>
          )}
        </div>

        {/* ── INVENTAIRE TAB ── */}
        <TabsContent value="inventaire" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-muted-foreground gap-2">
                  <Package className="w-10 h-10 opacity-30" /><p className="text-sm">Aucun article trouvé</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/40">
                      <tr>
                        {['Référence', 'Nom Article', 'Catégorie', 'Qté en stock', 'Seuil', 'Prix unit.', 'Fournisseur', 'Statut', ''].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filtered.map(i => (
                        <tr key={i.id} className="hover:bg-muted/30 transition-colors group">
                          <td className="px-4 py-3 font-mono text-xs font-medium">{i.referenceArticle}</td>
                          <td className="px-4 py-3 font-medium">{i.nomArticle || '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{i.categorie || '—'}</td>
                          <td className="px-4 py-3 font-semibold">
                            <span className={cn(
                              i.quantiteEnStock === 0 ? 'text-destructive' :
                              i.seuilDAlerte && i.quantiteEnStock != null && i.quantiteEnStock <= i.seuilDAlerte ? 'text-yellow-600' : ''
                            )}>
                              {fmtQty(i.quantiteEnStock, i.unite)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{i.seuilDAlerte != null ? fmtQty(i.seuilDAlerte) : '—'}</td>
                          <td className="px-4 py-3">{fmtGNF(i.prixUnitaire)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{i.fournisseur || '—'}</td>
                          <td className="px-4 py-3"><StatutBadge statut={i.statutStock} /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="outline" size="sm"
                                className="h-7 text-xs gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                                onClick={() => openNewSortie(i.id)}
                              >
                                <ArrowDownLeft className="w-3 h-3" />Sortie
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditItem(i)}><Pencil className="w-3.5 h-3.5" /></Button>
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
        </TabsContent>

        {/* ── SORTIES TAB ── */}
        <TabsContent value="sorties" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loadingSorties ? (
                <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : sorties.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-muted-foreground gap-2">
                  <TrendingDown className="w-10 h-10 opacity-30" />
                  <p className="text-sm">Aucune sortie enregistrée</p>
                  <Button size="sm" variant="outline" onClick={() => openNewSortie()} className="gap-2 mt-2">
                    <ArrowDownLeft className="w-3.5 h-3.5" />Enregistrer une sortie
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/40">
                      <tr>
                        {['N°', 'Article', 'Réf.', 'Quantité sortie', 'Motif', 'Date sortie', 'Responsable', 'Enregistré le'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sorties.map(s => (
                        <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{s.referenceSortie ?? '—'}</td>
                          <td className="px-4 py-3 font-medium">{s.articleNom || '—'}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.articleRef || '—'}</td>
                          <td className="px-4 py-3 font-semibold text-destructive">
                            <span className="flex items-center gap-1">
                              <ArrowDownLeft className="w-3 h-3" />
                              {fmtQty(s.quantiteSortie, s.unite)}
                            </span>
                          </td>
                          <td className="px-4 py-3"><MotifBadge motif={s.motif} /></td>
                          <td className="px-4 py-3">{fmtDate(s.dateSortie)}</td>
                          <td className="px-4 py-3 text-muted-foreground">{s.responsable || '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{s.dateEnregistrement ? fmtDate(s.dateEnregistrement) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Article form dialog ── */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{itemForm.id ? 'Modifier l\'article' : 'Nouvel article'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Référence *</Label><Input value={itemForm.referenceArticle ?? ''} onChange={e => setItemField('referenceArticle', e.target.value)} /></div>
              <div><Label>Nom Article</Label><Input value={itemForm.nomArticle ?? ''} onChange={e => setItemField('nomArticle', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Catégorie</Label>
                <Select value={itemForm.categorie ?? '_none'} onValueChange={v => setItemField('categorie', v === '_none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unité</Label>
                <Select value={itemForm.unite ?? '_none'} onValueChange={v => setItemField('unite', v === '_none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>{UNITES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantité en stock</Label><Input type="number" value={itemForm.quantiteEnStock ?? ''} onChange={e => setItemField('quantiteEnStock', e.target.value)} /></div>
              <div><Label>Seuil d'alerte</Label><Input type="number" value={itemForm.seuilDAlerte ?? ''} onChange={e => setItemField('seuilDAlerte', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prix unitaire (GNF)</Label><Input type="number" value={itemForm.prixUnitaire ?? ''} onChange={e => setItemField('prixUnitaire', e.target.value)} /></div>
              <div><Label>Fournisseur</Label><Input value={itemForm.fournisseur ?? ''} onChange={e => setItemField('fournisseur', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Dernier approvisionnement</Label><Input type="date" value={itemForm.dernierApprovisionnement ?? ''} onChange={e => setItemField('dernierApprovisionnement', e.target.value)} /></div>
              <div>
                <Label>Statut Stock</Label>
                <Select value={itemForm.statutStock ?? 'En stock'} onValueChange={v => setItemField('statutStock', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notes</Label><Textarea rows={2} value={itemForm.notes ?? ''} onChange={e => setItemField('notes', e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSaveItem} disabled={savingItem}>{savingItem ? 'Enregistrement...' : 'Enregistrer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Sortie form dialog ── */}
      <Dialog open={sortieDialogOpen} onOpenChange={setSortieDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownLeft className="w-4 h-4 text-destructive" />
              Enregistrer une sortie de stock
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Article *</Label>
              <Select value={sortieForm.articleId ?? '_none'} onValueChange={v => setSortieField('articleId', v === '_none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un article" /></SelectTrigger>
                <SelectContent>
                  {items.map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.nomArticle || i.referenceArticle}
                      {i.quantiteEnStock != null && (
                        <span className="text-muted-foreground ml-1 text-xs">(stock: {fmtQty(i.quantiteEnStock, i.unite)})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantité sortie *</Label>
                <Input type="number" min="0.01" step="0.01" placeholder="0" value={sortieForm.quantiteSortie ?? ''} onChange={e => setSortieField('quantiteSortie', e.target.value)} />
              </div>
              <div>
                <Label>Date de sortie</Label>
                <Input type="date" value={sortieForm.dateSortie ?? ''} onChange={e => setSortieField('dateSortie', e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Motif</Label>
              <Select value={sortieForm.motif ?? '_none'} onValueChange={v => setSortieField('motif', v === '_none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Motif de sortie" /></SelectTrigger>
                <SelectContent>{MOTIFS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsable</Label>
              <Input placeholder="Nom du responsable" value={sortieForm.responsable ?? ''} onChange={e => setSortieField('responsable', e.target.value)} />
            </div>
            <div><Label>Notes</Label><Textarea rows={2} value={sortieForm.notes ?? ''} onChange={e => setSortieField('notes', e.target.value)} /></div>

            {/* Preview quantity change */}
            {sortieForm.articleId && sortieForm.quantiteSortie && (() => {
              const art = items.find(i => i.id === sortieForm.articleId);
              if (!art) return null;
              const newQty = Math.max(0, (art.quantiteEnStock ?? 0) - parseFloat(sortieForm.quantiteSortie));
              return (
                <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 text-sm flex items-center justify-between">
                  <span className="text-muted-foreground">Nouveau stock estimé :</span>
                  <span className={cn('font-bold', newQty === 0 ? 'text-destructive' : newQty <= (art.seuilDAlerte ?? 0) ? 'text-yellow-600' : 'text-foreground')}>
                    {fmtQty(newQty, art.unite)}
                  </span>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSortieDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSaveSortie} disabled={savingSortie} className="gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              <ArrowDownLeft className="w-4 h-4" />
              {savingSortie ? 'Enregistrement...' : 'Confirmer la sortie'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'article ?</AlertDialogTitle>
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
