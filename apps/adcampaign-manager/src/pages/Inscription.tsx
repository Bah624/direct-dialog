import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { Card, CardContent } from '@project/components/ui/card';
import { Loader2, MapPin, Megaphone, ShieldCheck } from 'lucide-react';

export default function Inscription() {
  const [form, setForm] = useState({
    nomComplet: '',
    societe: '',
    email: '',
    telephone: '',
    motDePasse: '',
    confirmation: '',
  });
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const set = (cle: string, valeur: string) => setForm((f) => ({ ...f, [cle]: valeur }));

  const soumettre = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    setErreur('');

    if (!form.nomComplet.trim()) return setErreur('Votre nom est requis.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setErreur('Adresse e-mail invalide.');
    if (form.motDePasse.length < 8) return setErreur('Le mot de passe doit contenir au moins 8 caractères.');
    if (form.motDePasse !== form.confirmation) return setErreur('Les deux mots de passe ne correspondent pas.');

    setEnvoi(true);
    try {
      const reponse = await fetch('/api/inscription', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomComplet: form.nomComplet.trim(),
          societe: form.societe.trim(),
          email: form.email.trim(),
          telephone: form.telephone.trim(),
          motDePasse: form.motDePasse,
        }),
      });
      const donnees = await reponse.json().catch(() => ({}));
      if (!reponse.ok) {
        setErreur(donnees?.message ?? 'Inscription impossible.');
        return;
      }
      window.location.href = '/espace-client';
    } catch {
      setErreur('Serveur injoignable. Réessayez.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-slate-900 text-white p-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-orange-500 grid place-items-center">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <p className="font-semibold tracking-wide">DIRECT DIALOG</p>
            <p className="text-xs text-slate-400">Régie Publicitaire</p>
          </div>
        </div>

        <div className="space-y-6 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">
            Réservez vos panneaux publicitaires en ligne
          </h1>
          <ul className="space-y-4 text-sm text-slate-300">
            <li className="flex gap-3">
              <MapPin className="w-5 h-5 text-orange-400 shrink-0" />
              Consultez les panneaux disponibles, leur quartier et leur période de disponibilité.
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="w-5 h-5 text-orange-400 shrink-0" />
              Réservez uniquement les panneaux libres : les panneaux déjà occupés sont bloqués.
            </li>
            <li className="flex gap-3">
              <Megaphone className="w-5 h-5 text-orange-400 shrink-0" />
              Suivez vos réservations et recevez une confirmation par e-mail.
            </li>
          </ul>
        </div>

        <p className="text-xs text-slate-500">
          © {new Date().getFullYear()} DIRECT DIALOG — Espace client
        </p>
      </div>

      <div className="flex items-center justify-center p-6 bg-muted/30">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 space-y-5">
            <div>
              <h2 className="text-xl font-semibold">Créer un compte client</h2>
              <p className="text-sm text-muted-foreground">
                Quelques informations suffisent pour accéder aux panneaux disponibles.
              </p>
            </div>

            <form onSubmit={soumettre} className="space-y-3">
              <div>
                <Label htmlFor="nom">Nom complet *</Label>
                <Input
                  id="nom"
                  value={form.nomComplet}
                  onChange={(e) => set('nomComplet', e.target.value)}
                  placeholder="Mamadou Diallo"
                  autoComplete="name"
                />
              </div>
              <div>
                <Label htmlFor="societe">Société / activité</Label>
                <Input
                  id="societe"
                  value={form.societe}
                  onChange={(e) => set('societe', e.target.value)}
                  placeholder="Diallo Distribution"
                  autoComplete="organization"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="vous@exemple.com"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <Label htmlFor="telephone">Téléphone</Label>
                  <Input
                    id="telephone"
                    value={form.telephone}
                    onChange={(e) => set('telephone', e.target.value)}
                    placeholder="+224 620 00 00 00"
                    autoComplete="tel"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="mdp">Mot de passe *</Label>
                  <Input
                    id="mdp"
                    type="password"
                    value={form.motDePasse}
                    onChange={(e) => set('motDePasse', e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <Label htmlFor="confirmation">Confirmation *</Label>
                  <Input
                    id="confirmation"
                    type="password"
                    value={form.confirmation}
                    onChange={(e) => set('confirmation', e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {erreur && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{erreur}</p>
              )}

              <Button type="submit" className="w-full gap-2" disabled={envoi}>
                {envoi && <Loader2 className="w-4 h-4 animate-spin" />}
                Créer mon compte
              </Button>
            </form>

            <p className="text-xs text-muted-foreground text-center">
              Déjà client ?{' '}
              <Link to="/" className="text-primary hover:underline">
                Se connecter
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
