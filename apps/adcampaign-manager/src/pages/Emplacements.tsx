import { useEffect, useMemo, useState } from 'react';
import { getEmplacements, saveEmplacement, deleteEmplacement, GetEmplacementsOutputType } from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Card, CardContent } from '@project/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@project/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@project/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Label } from '@project/components/ui/label';
import { Plus, Search, Pencil, Trash2, MapPin, List, Map as MapIcon, Crosshair, Navigation, ExternalLink } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import CartePanneaux from '@/components/CartePanneaux';
import Carte3DPanneaux from '@/components/Carte3DPanneaux';
import { Skeleton } from '@project/components/ui/skeleton';
import { toast } from 'sonner';
import { Toaster } from '@project/components/ui/sonner';
import { cn } from '@project/components/lib/utils';

type Emp = GetEmplacementsOutputType['emplacements'][0];

const EMPTY: Record<string, any> = {
  referenceEmplacement: '',
  disponibilite: 'Disponible',
  type: 'Panneau',
};

const fmtCurrency = (n?: number) =>
  n != null ? n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) : '—';

const coordonnees = (e: { latitude?: number; longitude?: number }) =>
  e.latitude != null && e.longitude != null
    ? `${e.latitude.toFixed(5)}, ${e.longitude.toFixed(5)}`
    : '—';

export default function PanneauxPage() {
  const [emplacements, setEmplacements] = useState<Emp[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDispo, setFilterDispo] = useState('');
  const [form, setForm] = useState<Record<string, any>>(EMPTY);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [vue, setVue] = useState<'liste' | 'carte'>('liste');
  const [selection, setSelection] = useState<string | null>(null);

  const load = async () => {
    const res = await getEmplacements({ search: search || undefined, disponibilite: filterDispo || undefined });
    setEmplacements(res.emplacements);
    setLoading(false);
  };

  useEffect(() => { load(); }, [search, filterDispo]);

  const openNew = () => { setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (e: Emp) => {
    setForm({
      ...e,
      prixParSemaine: e.prixParSemaine?.toString() ?? '',
      latitude: e.latitude?.toString() ?? '',
      longitude: e.longitude?.toString() ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.referenceEmplacement) return toast.error('Référence requise');
    setSaving(true);
    try {
      const latitude =
        form.latitude !== '' && form.latitude != null ? parseFloat(form.latitude) : undefined;
      const longitude =
        form.longitude !== '' && form.longitude != null ? parseFloat(form.longitude) : undefined;
      if (
        (latitude != null && Number.isNaN(latitude)) ||
        (longitude != null && Number.isNaN(longitude))
      ) {
        toast.error('Coordonnées GPS invalides');
        return;
      }
      await saveEmplacement({
        ...form,
        prixParSemaine: form.prixParSemaine ? parseFloat(form.prixParSemaine) : undefined,
        latitude,
        longitude,
      } as any);
      toast.success(form.id ? 'Panneau mis à jour' : 'Panneau créé');
      setDialogOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteEmplacement({ id: deleteId });
    setDeleteId(null);
    if (selection === deleteId) setSelection(null);
    toast.success('Panneau supprimé');
    load();
  };

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const positionActuelle = () => {
    if (!navigator.geolocation) return toast.error('Géolocalisation non disponible');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        set('latitude', position.coords.latitude.toFixed(6));
        set('longitude', position.coords.longitude.toFixed(6));
        toast.success('Position récupérée');
      },
      () => toast.error('Impossible de récupérer votre position'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const panneauSelectionne = emplacements.find((e) => e.id === selection) ?? null;
  const geoLocalises = useMemo(
    () => emplacements.filter((e) => e.latitude != null && e.longitude != null).length,
    [emplacements],
  );

  return (
    <div className="space-y-4">
      <Toaster />

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher un panneau..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterDispo || '_all'} onValueChange={(v) => setFilterDispo(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Disponibilité" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Toutes</SelectItem>
            {['Disponible', 'Réservé', 'Occupé', 'En maintenance'].map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center rounded-md border border-border p-0.5">
          <button
            type="button"
            onClick={() => setVue('liste')}
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium',
              vue === 'liste' ? 'bg-muted' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <List className="w-3.5 h-3.5" /> Liste
          </button>
          <button
            type="button"
            onClick={() => setVue('carte')}
            className={cn(
              'flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium',
              vue === 'carte' ? 'bg-muted' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <MapIcon className="w-3.5 h-3.5" /> Carte
          </button>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" />
          Nouveau panneau
        </Button>
      </div>

      {vue === 'carte' ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Carte3DPanneaux
            panneaux={emplacements}
            selection={selection}
            onSelect={setSelection}
            hauteur={560}
          />

          <div className="space-y-3">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Panneaux géolocalisés</p>
                  <span className="text-xs text-muted-foreground">
                    {geoLocalises} / {emplacements.length}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{
                      width: `${emplacements.length ? (geoLocalises / emplacements.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Carte satellite 3D : cliquez un panneau pour ouvrir sa fiche, puis « Modifier »
                  pour ajuster ses coordonnées GPS.
                </p>
              </CardContent>
            </Card>

            {panneauSelectionne ? (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{panneauSelectionne.referenceEmplacement}</p>
                      <p className="text-xs text-muted-foreground">
                        {panneauSelectionne.localisation || '—'} · {panneauSelectionne.ville || '—'}
                      </p>
                    </div>
                    <StatusBadge status={panneauSelectionne.disponibilite} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <Info libelle="Type" valeur={panneauSelectionne.type ?? '—'} />
                    <Info libelle="Format" valeur={panneauSelectionne.format ?? '—'} />
                    <Info libelle="Prix / semaine" valeur={fmtCurrency(panneauSelectionne.prixParSemaine)} />
                    <Info libelle="Coordonnées" valeur={coordonnees(panneauSelectionne)} />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5"
                      onClick={() => openEdit(panneauSelectionne)}
                    >
                      <Pencil className="w-3.5 h-3.5" /> Modifier
                    </Button>
                    {panneauSelectionne.latitude != null && panneauSelectionne.longitude != null && (
                      <Button asChild size="sm" variant="outline" className="flex-1 gap-1.5">
                        <a
                          href={`https://www.google.com/maps?q=${panneauSelectionne.latitude},${panneauSelectionne.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Itinéraire
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Cliquez un panneau sur la carte pour afficher sa fiche.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : emplacements.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-muted-foreground gap-2">
                <MapPin className="w-10 h-10 opacity-30" />
                <p className="text-sm">Aucun panneau trouvé</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40">
                    <tr>
                      {[
                        'Référence',
                        'Localisation',
                        'Ville',
                        'Type',
                        'Format',
                        'Prix/semaine',
                        'Coordonnées GPS',
                        'Disponibilité',
                        '',
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {emplacements.map((e) => (
                      <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{e.referenceEmplacement}</td>
                        <td className="px-4 py-3 text-muted-foreground">{e.localisation || '—'}</td>
                        <td className="px-4 py-3">{e.ville || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{e.type || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{e.format || '—'}</td>
                        <td className="px-4 py-3 font-medium">{fmtCurrency(e.prixParSemaine)}</td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums text-xs">
                          {coordonnees(e)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={e.disponibilite} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Localiser sur la carte"
                              onClick={() => {
                                setSelection(e.id);
                                setVue('carte');
                              }}
                            >
                              <MapPin className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(e)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => setDeleteId(e.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
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
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Modifier le panneau' : 'Nouveau panneau'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Référence *</Label>
              <Input
                value={form.referenceEmplacement ?? ''}
                onChange={(e) => set('referenceEmplacement', e.target.value)}
              />
            </div>
            <div>
              <Label>Ville</Label>
              <Input value={form.ville ?? ''} onChange={(e) => set('ville', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label>Localisation</Label>
              <Input
                value={form.localisation ?? ''}
                onChange={(e) => set('localisation', e.target.value)}
                placeholder="Ex : Carrefour Bambeto, face à la station"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type ?? 'Panneau'} onValueChange={(v) => set('type', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Panneau', 'Affichage Urbain', 'Billboard', 'Abribus'].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Format (ex: 4x3m)</Label>
              <Input value={form.format ?? ''} onChange={(e) => set('format', e.target.value)} />
            </div>
            <div>
              <Label>Prix par semaine</Label>
              <Input
                type="number"
                value={form.prixParSemaine ?? ''}
                onChange={(e) => set('prixParSemaine', e.target.value)}
              />
            </div>
            <div>
              <Label>Disponibilité</Label>
              <Select
                value={form.disponibilite ?? 'Disponible'}
                onValueChange={(v) => set('disponibilite', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Disponible', 'Réservé', 'Occupé', 'En maintenance'].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Crosshair className="w-4 h-4 text-primary" /> Coordonnées GPS
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 h-7 text-xs"
                onClick={positionActuelle}
              >
                <Navigation className="w-3.5 h-3.5" /> Ma position
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Latitude</Label>
                <Input
                  className="tabular-nums"
                  value={form.latitude ?? ''}
                  onChange={(e) => set('latitude', e.target.value)}
                  placeholder="9.641185"
                />
              </div>
              <div>
                <Label className="text-xs">Longitude</Label>
                <Input
                  className="tabular-nums"
                  value={form.longitude ?? ''}
                  onChange={(e) => set('longitude', e.target.value)}
                  placeholder="-13.578401"
                />
              </div>
            </div>
            {dialogOpen && (
              <CartePanneaux
                panneaux={[]}
                hauteur={220}
                point={{
                  latitude:
                    form.latitude !== '' && form.latitude != null ? Number(form.latitude) : undefined,
                  longitude:
                    form.longitude !== '' && form.longitude != null
                      ? Number(form.longitude)
                      : undefined,
                }}
                centre={{
                  latitude:
                    form.latitude !== '' && form.latitude != null ? Number(form.latitude) : undefined,
                  longitude:
                    form.longitude !== '' && form.longitude != null
                      ? Number(form.longitude)
                      : undefined,
                }}
                onPick={(latitude, longitude) => {
                  set('latitude', latitude.toString());
                  set('longitude', longitude.toString());
                }}
              />
            )}
            <p className="text-[11px] text-muted-foreground">
              Cliquez sur la carte pour placer le panneau, ou saisissez les coordonnées. Le fond de
              carte nécessite une connexion Internet.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le panneau ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Info({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="rounded-md bg-muted/60 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{libelle}</p>
      <p className="truncate">{valeur}</p>
    </div>
  );
}
