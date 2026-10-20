import { useEffect, useMemo, useState } from 'react';
import {
  getUtilisateurs,
  saveUtilisateur,
  deleteUtilisateur,
  saveParametres,
  changerMotDePasse,
  GetUtilisateursOutputType,
} from 'zitejs/api';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Textarea } from '@project/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@project/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@project/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@project/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@project/components/ui/select';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import {
  Building2, Check, Download, Info, KeyRound, Pencil, RefreshCw, Save, Search,
  ShieldCheck, Trash2, UserPlus, Users, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@project/components/ui/sonner';
import { useSession } from '@/lib/session';
import { MODULE_LABELS, MODULE_DESCRIPTIONS, initiales } from '@/lib/permissions';

type Utilisateur = GetUtilisateursOutputType['utilisateurs'][0];
type Permissions = Record<string, Record<string, { voir: boolean; gerer: boolean }>>;

const UTILISATEUR_VIDE = {
  nomComplet: '',
  email: '',
  telephone: '',
  profil: 'Commercial',
  statut: 'Actif',
  notes: '',
  motDePasse: '',
};

const ONGLETS = [
  { cle: 'general', libelle: 'Général', icone: Building2 },
  { cle: 'utilisateurs', libelle: 'Utilisateurs', icone: Users },
  { cle: 'roles', libelle: 'Rôles & accès', icone: ShieldCheck },
  { cle: 'compte', libelle: 'Mon compte', icone: KeyRound },
  { cle: 'systeme', libelle: 'Système', icone: Info },
] as const;

type Onglet = (typeof ONGLETS)[number]['cle'];

export default function ParametresPage() {
  const { data, permis, rafraichir } = useSession();
  const [onglet, setOnglet] = useState<Onglet>('general');

  const peutParametres = permis('parametres', 'voir') || permis('utilisateurs', 'voir');

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!peutParametres) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <ShieldCheck className="w-10 h-10 text-muted-foreground" />
          <p className="font-medium">Accès non autorisé</p>
          <p className="text-sm text-muted-foreground max-w-md">
            Votre profil ne dispose pas des droits nécessaires pour consulter les paramètres.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Société, utilisateurs, profils et droits d’accès.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b pb-1">
        {ONGLETS.map(({ cle, libelle, icone: Icone }) => (
          <button
            key={cle}
            type="button"
            onClick={() => setOnglet(cle)}
            className={
              'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-t-lg transition ' +
              (onglet === cle
                ? 'text-primary border-b-2 border-primary -mb-1'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            <Icone className="w-4 h-4" />
            {libelle}
          </button>
        ))}
      </div>

      {onglet === 'general' && <OngletGeneral />}
      {onglet === 'utilisateurs' && <OngletUtilisateurs />}
      {onglet === 'roles' && <OngletRoles />}
      {onglet === 'compte' && <OngletCompte />}
      {onglet === 'systeme' && <OngletSysteme onRafraichir={rafraichir} />}

      <Toaster />
    </div>
  );
}

/* ------------------------------------------------------------------ Général */

function OngletGeneral() {
  const { data, permis, rafraichir } = useSession();
  const modifiable = permis('parametres', 'gerer');
  const [form, setForm] = useState(data!.societe);
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    if (data) setForm(data.societe);
  }, [data]);

  const set = (cle: keyof typeof form, valeur: any) => setForm((f) => ({ ...f, [cle]: valeur }));

  const enregistrer = async () => {
    if (!form.nom.trim()) return toast.error('Le nom de la société est requis');
    setEnregistrement(true);
    try {
      await saveParametres({
        societe: { ...form, tauxTva: Number(form.tauxTva) || 0 },
      });
      await rafraichir();
      toast.success('Paramètres enregistrés');
    } catch (erreur: any) {
      toast.error(erreur?.message ?? 'Enregistrement impossible');
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Identité de la société</CardTitle>
          <CardDescription>Ces informations apparaissent sur les documents et factures.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Nom de la société</Label>
            <Input value={form.nom} disabled={!modifiable} onChange={(e) => set('nom', e.target.value)} />
          </div>
          <div>
            <Label>Slogan</Label>
            <Input value={form.slogan} disabled={!modifiable} onChange={(e) => set('slogan', e.target.value)} />
          </div>
          <div>
            <Label>Téléphone</Label>
            <Input value={form.telephone} disabled={!modifiable} onChange={(e) => set('telephone', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Adresse</Label>
            <Input value={form.adresse} disabled={!modifiable} onChange={(e) => set('adresse', e.target.value)} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input value={form.email} disabled={!modifiable} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <Label>Logo (URL)</Label>
            <Input value={form.logoUrl} disabled={!modifiable} placeholder="https://…" onChange={(e) => set('logoUrl', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Facturation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Devise</Label>
              <Select value={form.devise} disabled={!modifiable} onValueChange={(v) => set('devise', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['GNF', 'XOF', 'EUR', 'USD', 'CHF', 'MAD'].map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Taux de TVA (%)</Label>
              <Input
                type="number"
                value={String(form.tauxTva)}
                disabled={!modifiable}
                onChange={(e) => set('tauxTva', Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">Utilisé par défaut sur les factures.</p>
            </div>
          </CardContent>
        </Card>

        <Button className="w-full gap-2" onClick={enregistrer} disabled={!modifiable || enregistrement}>
          <Save className="w-4 h-4" />
          {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        {!modifiable && (
          <p className="text-xs text-muted-foreground text-center">
            Votre profil ne permet pas de modifier les paramètres.
          </p>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Utilisateurs */

function OngletUtilisateurs() {
  const { data, permis } = useSession();
  const modifiable = permis('utilisateurs', 'gerer');
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [dialogue, setDialogue] = useState(false);
  const [form, setForm] = useState<Record<string, any>>(UTILISATEUR_VIDE);
  const [suppression, setSuppression] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  const charger = async () => {
    try {
      const res = await getUtilisateurs({});
      setUtilisateurs(res.utilisateurs);
    } catch (erreur: any) {
      toast.error(erreur?.message ?? 'Chargement impossible');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return utilisateurs;
    return utilisateurs.filter(
      (u) =>
        u.nomComplet?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.profil?.toLowerCase().includes(q),
    );
  }, [utilisateurs, recherche]);

  const ouvrirNouveau = () => { setForm(UTILISATEUR_VIDE); setDialogue(true); };
  const ouvrirEdition = (u: Utilisateur) => { setForm({ ...u }); setDialogue(true); };

  const enregistrer = async () => {
    if (!form.nomComplet?.trim() || !form.email?.trim()) {
      return toast.error('Nom et e-mail requis');
    }
    if (!form.id && (form.motDePasse ?? '').length < 8) {
      return toast.error('Définissez un mot de passe d’au moins 8 caractères');
    }
    if (form.motDePasse && form.motDePasse.length < 8) {
      return toast.error('Le mot de passe doit contenir au moins 8 caractères');
    }
    setEnregistrement(true);
    try {
      const charge: Record<string, any> = { ...form };
      if (!charge.motDePasse) delete charge.motDePasse;
      await saveUtilisateur(charge as any);
      toast.success(form.id ? 'Utilisateur mis à jour' : 'Utilisateur créé');
      setDialogue(false);
      await charger();
    } catch (erreur: any) {
      toast.error(erreur?.userFacingMessage ?? erreur?.message ?? 'Enregistrement impossible');
    } finally {
      setEnregistrement(false);
    }
  };

  const confirmerSuppression = async () => {
    if (!suppression) return;
    try {
      await deleteUtilisateur({ id: suppression });
      toast.success('Utilisateur supprimé');
      setSuppression(null);
      await charger();
    } catch (erreur: any) {
      toast.error(erreur?.userFacingMessage ?? erreur?.message ?? 'Suppression impossible');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher un utilisateur…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <Badge variant="outline" className="h-8">{utilisateurs.length} compte(s)</Badge>
        {modifiable && (
          <Button onClick={ouvrirNouveau} className="gap-2">
            <UserPlus className="w-4 h-4" /> Nouvel utilisateur
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {chargement ? (
            <div className="p-4 space-y-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtres.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">
              Aucun utilisateur.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Utilisateur</th>
                    <th className="text-left font-medium px-4 py-3">Contact</th>
                    <th className="text-left font-medium px-4 py-3">Profil</th>
                    <th className="text-left font-medium px-4 py-3">Statut</th>
                    <th className="text-left font-medium px-4 py-3">Dernière connexion</th>
                    <th className="text-right font-medium px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtres.map((u) => (
                    <tr key={u.id} className="border-t hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                            {initiales(u.nomComplet)}
                          </div>
                          <div>
                            <p className="font-medium">{u.nomComplet ?? '—'}</p>
                            {u.id === data?.profilActif?.id && (
                              <p className="text-xs text-primary">profil actif</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="break-all max-w-[220px]">{u.email ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{u.telephone || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{u.profil ?? '—'}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.statut === 'Inactif' ? 'outline' : 'default'} className={u.statut === 'Inactif' ? 'text-muted-foreground' : 'bg-emerald-600'}>
                          {u.statut ?? 'Actif'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {u.derniereConnexion
                          ? new Date(u.derniereConnexion).toLocaleDateString('fr-FR')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {modifiable && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => ouvrirEdition(u)} aria-label="Modifier">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setSuppression(u.id)} aria-label="Supprimer">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </>
                          )}
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

      <Dialog open={dialogue} onOpenChange={setDialogue}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Modifier l’utilisateur' : 'Nouvel utilisateur'}</DialogTitle>
            <DialogDescription>
              Le profil détermine les modules accessibles dans l’application.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Nom complet</Label>
              <Input value={form.nomComplet ?? ''} onChange={(e) => setForm({ ...form, nomComplet: e.target.value })} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input value={form.telephone ?? ''} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            </div>
            <div>
              <Label>Profil</Label>
              <Select value={form.profil ?? 'Commercial'} onValueChange={(v) => setForm({ ...form, profil: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(data?.profils ?? []).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Statut</Label>
              <Select value={form.statut ?? 'Actif'} onValueChange={(v) => setForm({ ...form, statut: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Actif">Actif</SelectItem>
                  <SelectItem value="Inactif">Inactif</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>{form.id ? 'Nouveau mot de passe (facultatif)' : 'Mot de passe initial'}</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={form.motDePasse ?? ''}
                onChange={(e) => setForm({ ...form, motDePasse: e.target.value })}
                placeholder={form.id ? 'Laisser vide pour ne pas modifier' : '8 caractères minimum'}
              />
              <p className="text-xs text-muted-foreground mt-1">
                L’utilisateur devra le changer à sa première connexion.
              </p>
            </div>
            <div className="md:col-span-2">
              <Label>Notes</Label>
              <Textarea rows={3} value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogue(false)}>Annuler</Button>
            <Button onClick={enregistrer} disabled={enregistrement} className="gap-2">
              <Save className="w-4 h-4" />
              {enregistrement ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!suppression} onOpenChange={(o) => !o && setSuppression(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. Le dernier administrateur ne peut pas être supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmerSuppression} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </div>
  );
}

/* ------------------------------------------------------------------- Droits */

function OngletRoles() {
  const { data, permis, rafraichir } = useSession();
  const modifiable = permis('parametres', 'gerer');
  const [profil, setProfil] = useState<string>((data?.profils ?? [])[1] ?? 'Comptable');
  const [droits, setDroits] = useState<Permissions>({});
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    if (data) setDroits(JSON.parse(JSON.stringify(data.permissions)));
  }, [data]);

  const modules = data?.modules ?? [];
  const estAdministrateur = profil === 'Administrateur';
  const acces = (module: string) => droits?.[profil]?.[module] ?? { voir: false, gerer: false };

  const basculer = (module: string, action: 'voir' | 'gerer') => {
    if (!modifiable || estAdministrateur) return;
    setDroits((precedent) => {
      const copie: Permissions = JSON.parse(JSON.stringify(precedent));
      const courant = copie[profil]?.[module] ?? { voir: false, gerer: false };
      const suivant = { ...courant };
      suivant[action] = !suivant[action];
      if (action === 'gerer' && suivant.gerer) suivant.voir = true;
      if (action === 'voir' && !suivant.voir) suivant.gerer = false;
      copie[profil] = { ...(copie[profil] ?? {}), [module]: suivant };
      return copie;
    });
  };

  const enregistrer = async () => {
    setEnregistrement(true);
    try {
      await saveParametres({ permissions: droits });
      await rafraichir();
      toast.success('Droits enregistrés');
    } catch (erreur: any) {
      toast.error(erreur?.message ?? 'Enregistrement impossible');
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Droits par profil</CardTitle>
            <CardDescription>
              « Voir » donne accès au module, « Gérer » autorise la création et la suppression.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={profil} onValueChange={setProfil}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(data?.profils ?? []).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            {modifiable && !estAdministrateur && (
              <Button onClick={enregistrer} disabled={enregistrement} className="gap-2">
                <Save className="w-4 h-4" />
                {enregistrement ? '…' : 'Enregistrer'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {modules.map((module) => {
              const droit = acces(module);
              return (
                <div key={module} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{MODULE_LABELS[module] ?? module}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {MODULE_DESCRIPTIONS[module] ?? ''}
                    </p>
                  </div>
                  <BoutonDroit
                    actif={droit.voir || estAdministrateur}
                    libelle="Voir"
                    desactive={!modifiable || estAdministrateur}
                    onClick={() => basculer(module, 'voir')}
                  />
                  <BoutonDroit
                    actif={droit.gerer || estAdministrateur}
                    libelle="Gérer"
                    desactive={!modifiable || estAdministrateur}
                    onClick={() => basculer(module, 'gerer')}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {estAdministrateur && (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          Le profil administrateur conserve toujours l’accès complet.
        </p>
      )}
      {!modifiable && (
        <p className="text-xs text-muted-foreground">
          Votre profil ne permet pas de modifier les droits.
        </p>
      )}

      <Toaster />
    </div>
  );
}

function BoutonDroit({
  actif,
  libelle,
  desactive,
  onClick,
}: {
  actif: boolean;
  libelle: string;
  desactive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactive}
      className={
        'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition ' +
        (actif
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-border bg-background text-muted-foreground') +
        (desactive ? ' opacity-60 cursor-default' : ' hover:border-primary/40')
      }
    >
      {actif ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
      {libelle}
    </button>
  );
}

/* ------------------------------------------------------------------ Système */

function OngletSysteme({ onRafraichir }: { onRafraichir: () => Promise<void> }) {
  const { data, utilisateur } = useSession();
  const stats = data?.statistiques ?? {};
  const [exportEnCours, setExportEnCours] = useState(false);

  const telecharger = async () => {
    setExportEnCours(true);
    try {
      const res = await fetch('/api/export');
      if (!res.ok) throw new Error(`Export refusé (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = `direct-dialog-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
      lien.click();
      URL.revokeObjectURL(url);
      toast.success('Sauvegarde téléchargée');
    } catch (erreur: any) {
      toast.error(erreur?.message ?? 'Export impossible');
    } finally {
      setExportEnCours(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Application</CardTitle>
          <CardDescription>Informations techniques de l’installation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Ligne libelle="Version" valeur="1.3.0" />
          <Ligne libelle="Société" valeur={data?.societe?.nom ?? '—'} />
          <Ligne libelle="Devise" valeur={data?.societe?.devise ?? '—'} />
          <Ligne libelle="TVA par défaut" valeur={`${data?.societe?.tauxTva ?? 0} %`} />
          <Ligne libelle="Compte connecté" valeur={utilisateur ? `${utilisateur.nomComplet} (${utilisateur.profil})` : '—'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Données</CardTitle>
          <CardDescription>Volume enregistré dans la base locale.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {Object.entries(stats).map(([cle, valeur]) => (
            <Ligne key={cle} libelle={MODULE_LABELS[cle] ?? cle} valeur={String(valeur)} />
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Sauvegarde</CardTitle>
          <CardDescription>
            Télécharge l’intégralité des données (JSON). À conserver hors du serveur.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button onClick={telecharger} disabled={exportEnCours} className="gap-2">
            <Download className="w-4 h-4" />
            {exportEnCours ? 'Préparation…' : 'Télécharger la sauvegarde'}
          </Button>
          <Button variant="outline" onClick={() => onRafraichir()} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Rafraîchir
          </Button>
        </CardContent>
      </Card>

      <Toaster />
    </div>
  );
}


/* --------------------------------------------------------------- Mon compte */

function OngletCompte() {
  const { utilisateur, rafraichir } = useSession();
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [enCours, setEnCours] = useState(false);

  const enregistrer = async () => {
    if (nouveau.length < 8) return toast.error('8 caractères minimum');
    if (nouveau !== confirmation) return toast.error('Les deux saisies ne correspondent pas');
    setEnCours(true);
    try {
      await changerMotDePasse({ ancien, nouveau });
      await rafraichir();
      setAncien('');
      setNouveau('');
      setConfirmation('');
      toast.success('Mot de passe modifié');
    } catch (erreur: any) {
      toast.error(erreur?.userFacingMessage ?? erreur?.message ?? 'Modification impossible');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Mon compte</CardTitle>
          <CardDescription>Informations du compte connecté.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Ligne libelle="Nom" valeur={utilisateur?.nomComplet ?? '—'} />
          <Ligne libelle="E-mail" valeur={utilisateur?.email ?? '—'} />
          <Ligne libelle="Profil" valeur={utilisateur?.profil ?? '—'} />
          <Ligne
            libelle="Mot de passe"
            valeur={utilisateur?.doitChangerMotDePasse ? 'à changer' : 'défini'}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Changer de mot de passe</CardTitle>
          <CardDescription>8 caractères minimum.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Mot de passe actuel</Label>
            <Input
              type="password"
              autoComplete="current-password"
              value={ancien}
              onChange={(e) => setAncien(e.target.value)}
            />
          </div>
          <div>
            <Label>Nouveau mot de passe</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={nouveau}
              onChange={(e) => setNouveau(e.target.value)}
            />
          </div>
          <div>
            <Label>Confirmation</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </div>
          <Button onClick={enregistrer} disabled={enCours} className="w-full gap-2">
            <KeyRound className="w-4 h-4" />
            {enCours ? 'Enregistrement…' : 'Changer le mot de passe'}
          </Button>
        </CardContent>
      </Card>

      <Toaster />
    </div>
  );
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{libelle}</span>
      <span className="font-medium text-right break-words">{valeur}</span>
    </div>
  );
}
