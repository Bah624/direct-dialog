import { useEffect, useMemo, useState } from 'react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Card, CardContent } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Textarea } from '@project/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@project/components/ui/dialog';
import { toast } from 'sonner';
import { Toaster } from '@project/components/ui/sonner';
import { CalendarDays, CheckCircle2, Loader2, MapPin, Search, Send } from 'lucide-react';
import { useSession } from '@/lib/session';

type Panneau = {
  id: string;
  reference: string;
  quartier: string;
  ville: string;
  localisation: string;
  type: string;
  format: string;
  prixParSemaine: number;
  disponibleDu: string;
  disponibleAu: string;
};

type Reservation = {
  id: string;
  reference: string;
  panneau: string;
  quartier: string;
  ville: string;
  dateDebut: string;
  dateFin: string;
  statut: string;
  montant: number;
};

const dateFr = (v?: string) => {
  if (!v) return '—';
  const [a, m, j] = v.split('-');
  return j ? `${j}/${m}/${a}` : v;
};

const aujourdHui = () => new Date().toISOString().slice(0, 10);
const dansDeuxSemaines = () => {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
};

export default function EspaceClient() {
  const { utilisateur } = useSession();
  const [panneaux, setPanneaux] = useState<Panneau[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [cible, setCible] = useState<Panneau | null>(null);
  const [dates, setDates] = useState({ dateDebut: aujourdHui(), dateFin: dansDeuxSemaines() });
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const charger = async () => {
    try {
      const [p, r] = await Promise.all([
        fetch('/api/panneaux-disponibles', { credentials: 'include' }).then((x) => x.json()),
        fetch('/api/mes-reservations', { credentials: 'include' }).then((x) => x.json()),
      ]);
      setPanneaux(p.panneaux ?? []);
      setReservations(r.reservations ?? []);
    } catch {
      toast.error('Impossible de charger les panneaux');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return panneaux;
    return panneaux.filter((p) =>
      [p.reference, p.quartier, p.ville, p.localisation, p.type]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q)),
    );
  }, [panneaux, recherche]);

  const ouvrirReservation = (panneau: Panneau) => {
    setCible(panneau);
    setDates({ dateDebut: aujourdHui(), dateFin: dansDeuxSemaines() });
    setMessage('');
  };

  const reserver = async () => {
    if (!cible) return;
    if (!dates.dateDebut || !dates.dateFin) return toast.error('Choisissez les deux dates');
    if (dates.dateFin < dates.dateDebut) return toast.error('La date de fin doit être après le début');

    setEnvoi(true);
    try {
      const reponse = await fetch('/api/reserver', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emplacementId: cible.id,
          dateDebut: dates.dateDebut,
          dateFin: dates.dateFin,
          message,
        }),
      });
      const donnees = await reponse.json().catch(() => ({}));
      if (!reponse.ok) {
        toast.error(donnees?.message ?? 'Réservation impossible');
        return;
      }
      toast.success(`Réservation ${donnees.reference} enregistrée — confirmation par e-mail`);
      setCible(null);
      await charger();
    } catch {
      toast.error('Serveur injoignable');
    } finally {
      setEnvoi(false);
    }
  };

  const nuits = useMemo(() => {
    if (!dates.dateDebut || !dates.dateFin) return 0;
    const j = Math.round(
      (new Date(dates.dateFin).getTime() - new Date(dates.dateDebut).getTime()) / 86_400_000,
    ) + 1;
    return Math.max(0, j);
  }, [dates]);

  return (
    <div className="space-y-6">
      <Toaster />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Espace client</h1>
          <p className="text-sm text-muted-foreground">
            Bonjour {utilisateur?.nomComplet ?? ''} — seuls les panneaux libres peuvent être réservés.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {panneaux.length} panneau(x) disponible(s)
        </Badge>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Rechercher un quartier, une ville, une référence…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      </div>

      {chargement ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement des panneaux…
        </div>
      ) : filtres.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-sm text-muted-foreground">
            <MapPin className="w-9 h-9 mx-auto mb-3 opacity-30" />
            Aucun panneau disponible pour le moment.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtres.map((panneau) => (
            <Card key={panneau.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{panneau.reference}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[panneau.quartier, panneau.ville].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Disponible</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <Info libelle="Type" valeur={panneau.type || '—'} />
                  <Info libelle="Format" valeur={panneau.format || '—'} />
                  <Info
                    libelle="Prix / semaine"
                    valeur={`${(panneau.prixParSemaine ?? 0).toLocaleString('fr-FR')} GNF`}
                  />
                  <Info
                    libelle="Disponible"
                    valeur={
                      panneau.disponibleDu && panneau.disponibleAu
                        ? `${dateFr(panneau.disponibleDu)} → ${dateFr(panneau.disponibleAu)}`
                        : 'Dès maintenant'
                    }
                  />
                </div>

                {panneau.localisation && (
                  <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{panneau.localisation}</span>
                  </p>
                )}

                <Button className="w-full gap-2" onClick={() => ouvrirReservation(panneau)}>
                  <CalendarDays className="w-4 h-4" /> Réserver ce panneau
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-medium">Mes réservations</p>
            <span className="text-xs text-muted-foreground">{reservations.length}</span>
          </div>
          {reservations.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">
              Aucune réservation pour l’instant.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {reservations.map((r) => (
                <li key={r.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {r.reference} · {r.panneau}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[r.quartier, r.ville].filter(Boolean).join(' · ')} — {dateFr(r.dateDebut)} →{' '}
                      {dateFr(r.dateFin)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      r.statut === 'Confirmée'
                        ? 'text-emerald-600 border-emerald-200'
                        : r.statut === 'Annulée'
                          ? 'text-red-600 border-red-200'
                          : 'text-amber-600 border-amber-200'
                    }
                  >
                    {r.statut}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!cible} onOpenChange={(ouvert) => !ouvert && setCible(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Réserver {cible?.reference}</DialogTitle>
            <DialogDescription>
              {[cible?.quartier, cible?.ville].filter(Boolean).join(' · ')} —{' '}
              {(cible?.prixParSemaine ?? 0).toLocaleString('fr-FR')} GNF / semaine
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date de début *</Label>
                <Input
                  type="date"
                  value={dates.dateDebut}
                  min={aujourdHui()}
                  onChange={(e) => setDates((d) => ({ ...d, dateDebut: e.target.value }))}
                />
              </div>
              <div>
                <Label>Date de fin *</Label>
                <Input
                  type="date"
                  value={dates.dateFin}
                  min={dates.dateDebut}
                  onChange={(e) => setDates((d) => ({ ...d, dateFin: e.target.value }))}
                />
              </div>
            </div>

            <div className="rounded-md bg-muted/60 px-3 py-2 text-xs flex items-center justify-between">
              <span className="text-muted-foreground">Durée</span>
              <span className="font-medium">{nuits} jour(s)</span>
            </div>

            <div className="rounded-md bg-muted/60 px-3 py-2 text-xs flex items-center justify-between">
              <span className="text-muted-foreground">Montant estimé</span>
              <span className="font-semibold">
                {Math.round(((cible?.prixParSemaine ?? 0) * nuits) / 7).toLocaleString('fr-FR')} GNF
              </span>
            </div>

            <div>
              <Label>Message (optionnel)</Label>
              <Textarea
                rows={3}
                placeholder="Précisez votre besoin, la campagne prévue…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-600" />
              Votre demande sera confirmée par notre équipe sous 24 h. Une confirmation vous est
              envoyée par e-mail.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCible(null)}>
              Annuler
            </Button>
            <Button onClick={reserver} disabled={envoi} className="gap-2">
              {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
