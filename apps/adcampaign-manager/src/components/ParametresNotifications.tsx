import { useEffect, useState } from 'react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Switch } from '@project/components/ui/switch';
import { toast } from 'sonner';
import { Bell, CalendarClock, Loader2, Mail, MessageCircle, Save, Send, Smartphone } from 'lucide-react';
import {
  CANAUX_DEFAUT,
  chargerNotifications,
  enregistrerNotifications,
  envoyerAlertesMaintenant,
  testerNotification,
  type AlertePanneau,
  type Canaux,
  type HistoriqueNotification,
} from '@/lib/notifications';

const dateFr = (valeur: string) => {
  if (!valeur) return '—';
  const [annee, mois, jour] = valeur.split('-');
  return jour ? `${jour}/${mois}/${annee}` : valeur;
};

export default function ParametresNotifications() {
  const [config, setConfig] = useState<Canaux>(CANAUX_DEFAUT);
  const [alertes, setAlertes] = useState<AlertePanneau[]>([]);
  const [historique, setHistorique] = useState<HistoriqueNotification[]>([]);
  const [dernierEnvoi, setDernierEnvoi] = useState('');
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [testEnCours, setTestEnCours] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const charger = async () => {
    try {
      const etat = await chargerNotifications();
      setConfig({ ...CANAUX_DEFAUT, ...etat.config });
      setAlertes(etat.alertes ?? []);
      setHistorique(etat.historique ?? []);
      setDernierEnvoi(etat.dernierEnvoi ?? '');
    } catch (erreur: any) {
      toast.error(erreur?.message ?? 'Impossible de charger les notifications');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const set = (chemin: string, valeur: any) => {
    setConfig((actuel) => {
      const copie: any = structuredClone(actuel);
      const cles = chemin.split('.');
      let cible = copie;
      for (const cle of cles.slice(0, -1)) cible = cible[cle];
      cible[cles[cles.length - 1]] = valeur;
      return copie;
    });
  };

  const enregistrer = async () => {
    setEnregistrement(true);
    try {
      const resultat = await enregistrerNotifications(config);
      setConfig({ ...CANAUX_DEFAUT, ...resultat.config });
      toast.success('Réglages de notification enregistrés');
    } catch (erreur: any) {
      toast.error(erreur?.message ?? 'Enregistrement impossible');
    } finally {
      setEnregistrement(false);
    }
  };

  const tester = async (canal: 'email' | 'telegram' | 'whatsapp') => {
    setTestEnCours(canal);
    try {
      const { resultats } = await testerNotification(canal);
      const resultat = resultats.find((r) => r.canal === canal) ?? resultats[0];
      if (resultat?.ok) toast.success(`Test ${canal} : ${resultat.detail}`);
      else toast.error(`Test ${canal} : ${resultat?.detail ?? 'échec'}`);
    } catch (erreur: any) {
      toast.error(erreur?.message ?? 'Test impossible');
    } finally {
      setTestEnCours(null);
    }
  };

  const envoyerMaintenant = async () => {
    setEnvoiEnCours(true);
    try {
      const resultat = await envoyerAlertesMaintenant();
      if (resultat.alertes.length === 0) {
        toast.info('Aucune période à signaler pour le moment');
      } else if (resultat.envoyes === 0) {
        toast.warning('Alertes calculées mais aucun canal n’a pu envoyer (vérifiez la configuration)');
      } else {
        toast.success(`${resultat.alertes.length} alerte(s) envoyée(s) sur ${resultat.envoyes} canal(aux)`);
      }
      await charger();
    } catch (erreur: any) {
      toast.error(erreur?.message ?? 'Envoi impossible');
    } finally {
      setEnvoiEnCours(false);
    }
  };

  if (chargement) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-10">
        <Loader2 className="w-4 h-4 animate-spin" /> Chargement des réglages…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" /> Alertes de fin de disponibilité
          </CardTitle>
          <CardDescription>
            Chaque jour à l’heure choisie, un récapitulatif des panneaux dont la période se termine
            est envoyé par e-mail, Telegram et WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Heure d’envoi</Label>
            <Input
              type="time"
              value={config.heureEnvoi}
              onChange={(e) => set('heureEnvoi', e.target.value)}
            />
          </div>
          <div>
            <Label>Prévenir combien de jours avant la fin</Label>
            <Input
              type="number"
              min={0}
              max={90}
              value={config.alerteJours}
              onChange={(e) => set('alerteJours', Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" /> E-mail
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Activer l’envoi par e-mail</Label>
            <Switch checked={config.email.actif} onCheckedChange={(v) => set('email.actif', v)} />
          </div>
          <div>
            <Label>Destinataires (séparés par des virgules)</Label>
            <Input
              value={config.email.destinataires.join(', ')}
              onChange={(e) =>
                set(
                  'email.destinataires',
                  e.target.value.split(',').map((v) => v.trim()).filter(Boolean),
                )
              }
              placeholder="direction@exemple.com, operations@exemple.com"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Serveur SMTP</Label>
              <Input
                value={config.smtp.host}
                onChange={(e) => set('smtp.host', e.target.value)}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div>
              <Label>Port</Label>
              <Input
                type="number"
                value={config.smtp.port}
                onChange={(e) => set('smtp.port', Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Utilisateur</Label>
              <Input value={config.smtp.user} onChange={(e) => set('smtp.user', e.target.value)} />
            </div>
            <div>
              <Label>Mot de passe / clé</Label>
              <Input
                type="password"
                value={config.smtp.pass}
                onChange={(e) => set('smtp.pass', e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Expéditeur</Label>
              <Input
                value={config.smtp.from}
                onChange={(e) => set('smtp.from', e.target.value)}
                placeholder="Direct Dialog <notifications@direct-dialog.com>"
              />
            </div>
          </div>
          {!config.smtp.host && (
            <p className="text-xs text-muted-foreground">
              Sans serveur SMTP, les e-mails sont archivés localement (dossier data, fichier
              outbox.jsonl).
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={testEnCours === 'email'}
            onClick={() => tester('email')}
          >
            {testEnCours === 'email' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Envoyer un e-mail de test
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" /> Telegram
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Activer Telegram</Label>
              <Switch checked={config.telegram.actif} onCheckedChange={(v) => set('telegram.actif', v)} />
            </div>
            <div>
              <Label>Jeton du bot</Label>
              <Input
                value={config.telegram.token}
                onChange={(e) => set('telegram.token', e.target.value)}
                placeholder="123456789:AA…"
              />
            </div>
            <div>
              <Label>Chat ID</Label>
              <Input
                value={config.telegram.chatId}
                onChange={(e) => set('telegram.chatId', e.target.value)}
                placeholder="-1001234567890"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={testEnCours === 'telegram'}
              onClick={() => tester('telegram')}
            >
              {testEnCours === 'telegram' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Tester Telegram
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-primary" /> WhatsApp
            </CardTitle>
            <CardDescription>API WhatsApp Business (Meta Cloud API).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Activer WhatsApp</Label>
              <Switch checked={config.whatsapp.actif} onCheckedChange={(v) => set('whatsapp.actif', v)} />
            </div>
            <div>
              <Label>Jeton d’accès</Label>
              <Input
                type="password"
                value={config.whatsapp.token}
                onChange={(e) => set('whatsapp.token', e.target.value)}
              />
            </div>
            <div>
              <Label>Identifiant du numéro (phone number ID)</Label>
              <Input
                value={config.whatsapp.phoneNumberId}
                onChange={(e) => set('whatsapp.phoneNumberId', e.target.value)}
              />
            </div>
            <div>
              <Label>Numéro destinataire</Label>
              <Input
                value={config.whatsapp.destinataire}
                onChange={(e) => set('whatsapp.destinataire', e.target.value)}
                placeholder="224620000000"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={testEnCours === 'whatsapp'}
              onClick={() => tester('whatsapp')}
            >
              {testEnCours === 'whatsapp' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Tester WhatsApp
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" /> Prochaines échéances
          </CardTitle>
          <CardDescription>
            Calculées à partir des périodes « disponible du / au » des panneaux.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {alertes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune échéance proche. Renseignez les dates de disponibilité dans la fiche des panneaux.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {alertes.map((alerte) => (
                <li key={alerte.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {alerte.reference}
                      <span className="text-muted-foreground font-normal">
                        {alerte.quartier ? ` · ${alerte.quartier}` : ''}
                        {alerte.ville ? ` · ${alerte.ville}` : ''}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {alerte.typePeriode === 'location' ? 'Location' : 'Disponibilité'} :{' '}
                      {dateFr(alerte.du)} → {dateFr(alerte.au)} ·{' '}
                      {alerte.joursRestants < 0
                        ? `terminée depuis ${Math.abs(alerte.joursRestants)} j`
                        : `dans ${alerte.joursRestants} j`}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      alerte.etat === 'termine'
                        ? 'text-red-600 border-red-200'
                        : 'text-amber-600 border-amber-200'
                    }
                  >
                    {alerte.etat === 'termine' ? 'Terminée' : 'À surveiller'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button className="gap-2" onClick={envoyerMaintenant} disabled={envoiEnCours}>
              {envoiEnCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Envoyer le récapitulatif maintenant
            </Button>
            {dernierEnvoi && (
              <span className="text-xs text-muted-foreground">
                Dernier envoi : {dateFr(dernierEnvoi)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {historique.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Historique des envois</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {historique.slice(0, 10).map((entree, index) => (
                <li key={`${entree.date}-${index}`} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate">{entree.sujet}</p>
                    <p className="text-xs text-muted-foreground">{entree.canaux}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(entree.date).toLocaleString('fr-FR')}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={enregistrer} disabled={enregistrement} className="gap-2">
          {enregistrement ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer les réglages
        </Button>
      </div>
    </div>
  );
}
