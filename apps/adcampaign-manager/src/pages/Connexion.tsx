import { useState } from 'react';
import { Megaphone, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Label } from '@project/components/ui/label';
import { useSession } from '@/lib/session';

export default function Connexion() {
  const { connecter } = useSession();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [visible, setVisible] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (evenement: React.FormEvent) => {
    evenement.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await connecter(email.trim(), motDePasse);
    } catch (e: any) {
      setErreur(e?.message ?? 'Connexion impossible.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8 text-white">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Megaphone className="w-6 h-6" />
          </div>
          <div className="text-center">
            <p className="font-bold text-lg leading-tight">DIRECT DIALOG</p>
            <p className="text-primary text-xs font-semibold uppercase tracking-wide">
              Régie publicitaire
            </p>
          </div>
        </div>

        <form onSubmit={soumettre} className="bg-white rounded-xl shadow-2xl p-6 space-y-4">
          <div>
            <h1 className="font-semibold text-lg">Connexion</h1>
            <p className="text-sm text-muted-foreground">
              Accédez à votre espace de gestion.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Adresse e-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@entreprise.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mot-de-passe">Mot de passe</Label>
            <div className="relative">
              <Input
                id="mot-de-passe"
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {erreur && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {erreur}
            </p>
          )}

          <Button type="submit" className="w-full gap-2" disabled={enCours}>
            {enCours && <Loader2 className="w-4 h-4 animate-spin" />}
            {enCours ? 'Connexion…' : 'Se connecter'}
          </Button>

          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            Les identifiants du compte administrateur sont affichés au démarrage
            du serveur (<code className="text-[11px]">docker compose logs app</code>).
          </p>
        </form>
      </div>
    </div>
  );
}
