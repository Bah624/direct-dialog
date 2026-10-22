import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@project/components/ui/button';
import { Input } from '@project/components/ui/input';
import { Badge } from '@project/components/ui/badge';
import { Card, CardContent } from '@project/components/ui/card';
import { toast } from 'sonner';
import { Toaster } from '@project/components/ui/sonner';
import {
  ArrowRight, Bot, Download, Loader2, Send, Sparkles, Trash2, User,
} from 'lucide-react';
import { useSession } from '@/lib/session';
import { cn } from '@project/components/lib/utils';

type Kpi = { libelle: string; valeur: string; ton?: 'ok' | 'attention' | 'danger' };

type ResultatAgent = {
  intention: string;
  texte: string;
  kpis?: Kpi[];
  tableau?: { colonnes: string[]; lignes: (string | number)[][] };
  export?: { nom: string; csv: string };
  suggestions?: string[];
  liens?: { libelle: string; chemin: string }[];
};

type Bloc =
  | { role: 'user'; texte: string }
  | { role: 'assistant'; resultat: ResultatAgent };

const SUGGESTIONS = [
  'Résumé du jour',
  'Rapport du stock',
  'Factures impayées',
  'Panneaux disponibles',
  'Réservations en attente',
  'Comment créer une campagne ?',
];

const TONS: Record<string, string> = {
  ok: 'text-emerald-600',
  attention: 'text-amber-600',
  danger: 'text-red-600',
};

function TexteRiche({ texte }: { texte: string }) {
  return (
    <>
      {texte.split('\n').map((ligne, index) => (
        <p key={index} className={ligne.trim() === '' ? 'h-2' : 'leading-relaxed'}>
          {ligne.split(/(\*\*[^*]+\*\*)/g).map((morceau, i) =>
            morceau.startsWith('**') && morceau.endsWith('**') ? (
              <strong key={i}>{morceau.slice(2, -2)}</strong>
            ) : (
              <span key={i}>{morceau}</span>
            ),
          )}
        </p>
      ))}
    </>
  );
}

function telecharger(nom: string, contenu: string) {
  const blob = new Blob([contenu], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  lien.click();
  URL.revokeObjectURL(url);
}

export default function AgentPage() {
  const { utilisateur } = useSession();
  const [blocs, setBlocs] = useState<Bloc[]>([]);
  const [saisie, setSaisie] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: 'smooth' });
  }, [blocs, envoi]);

  const envoyer = async (texte: string) => {
    const message = texte.trim();
    if (!message || envoi) return;

    setBlocs((actuels) => [...actuels, { role: 'user', texte: message }]);
    setSaisie('');
    setEnvoi(true);

    try {
      const reponse = await fetch('/api/agent', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const donnees = await reponse.json().catch(() => ({}));
      if (!reponse.ok) {
        toast.error(donnees?.message ?? 'Réponse impossible');
        return;
      }
      setBlocs((actuels) => [...actuels, { role: 'assistant', resultat: donnees }]);
    } catch {
      toast.error('Serveur injoignable');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] -m-4 md:-m-6">
      <Toaster />

      {/* En-tête */}
      <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary grid place-items-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold flex items-center gap-2">
              Assistant DIRECT DIALOG
              <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> connecté à la base
              </Badge>
            </p>
            <p className="text-[11px] text-muted-foreground">
              Rapports, recherche, aide et plan d’action — en temps réel.
            </p>
          </div>
        </div>
        {blocs.length > 0 && (
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => setBlocs([])}>
            <Trash2 className="w-3.5 h-3.5" /> Effacer
          </Button>
        )}
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
        {blocs.length === 0 && (
          <div className="max-w-2xl mx-auto space-y-4 py-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary grid place-items-center mx-auto">
                <Sparkles className="w-7 h-7" />
              </div>
              <h1 className="text-lg font-semibold">Bonjour {utilisateur?.nomComplet?.split(' ')[0] ?? ''}</h1>
              <p className="text-sm text-muted-foreground">
                Demandez un rapport, une recherche ou comment faire une action. Je lis votre base
                en direct et je respecte vos droits d’accès.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => envoyer(suggestion)}
                  className="text-left rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm hover:border-primary/40 hover:bg-primary/5 transition flex items-center justify-between gap-2"
                >
                  {suggestion}
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              Exemples : « stock en rupture », « factures en retard », « combien de panneaux à Conakry ? »,
              « comment ajouter un utilisateur ? ».
            </p>
          </div>
        )}

        {blocs.map((bloc, index) =>
          bloc.role === 'user' ? (
            <div key={index} className="flex justify-end gap-2">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-white">
                {bloc.texte}
              </div>
              <div className="w-7 h-7 rounded-full bg-muted grid place-items-center flex-shrink-0">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </div>
          ) : (
            <div key={index} className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/15 text-primary grid place-items-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <Card className="max-w-[calc(100%-2.5rem)] flex-1">
                <CardContent className="p-3.5 space-y-3 text-sm">
                  <div className="text-foreground">
                    <TexteRiche texte={bloc.resultat.texte} />
                  </div>

                  {bloc.resultat.kpis && bloc.resultat.kpis.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {bloc.resultat.kpis.map((kpi) => (
                        <div key={kpi.libelle} className="rounded-lg bg-muted/60 px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {kpi.libelle}
                          </p>
                          <p className={cn('text-sm font-semibold', TONS[kpi.ton ?? ''] ?? '')}>
                            {kpi.valeur}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {bloc.resultat.tableau && bloc.resultat.tableau.lignes.length > 0 && (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="max-h-72 overflow-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/60 sticky top-0">
                            <tr>
                              {bloc.resultat.tableau.colonnes.map((colonne) => (
                                <th
                                  key={colonne}
                                  className="text-left px-2.5 py-2 font-semibold text-muted-foreground whitespace-nowrap"
                                >
                                  {colonne}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {bloc.resultat.tableau.lignes.map((ligne, i) => (
                              <tr key={i} className="hover:bg-muted/30">
                                {ligne.map((cellule, j) => (
                                  <td key={j} className="px-2.5 py-1.5 whitespace-nowrap">
                                    {cellule}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {bloc.resultat.export && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-8 text-xs"
                        onClick={() => telecharger(bloc.resultat.export!.nom, bloc.resultat.export!.csv)}
                      >
                        <Download className="w-3.5 h-3.5" /> Exporter en CSV
                      </Button>
                    )}
                    {bloc.resultat.liens?.map((lien) => (
                      <Button key={lien.chemin} asChild size="sm" variant="outline" className="gap-1.5 h-8 text-xs">
                        <Link to={lien.chemin}>
                          {lien.libelle} <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    ))}
                  </div>

                  {bloc.resultat.suggestions && bloc.resultat.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {bloc.resultat.suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => envoyer(suggestion)}
                          className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ),
        )}

        {envoi && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/15 text-primary grid place-items-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Je consulte la base…
            </div>
          </div>
        )}

        <div ref={fin} />
      </div>

      {/* Saisie */}
      <div className="border-t border-border bg-card px-4 md:px-6 py-3">
        <form
          onSubmit={(evenement) => {
            evenement.preventDefault();
            envoyer(saisie);
          }}
          className="flex items-center gap-2 max-w-3xl mx-auto"
        >
          <Input
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="Demandez un rapport, une recherche, une aide…"
            className="flex-1"
            disabled={envoi}
          />
          <Button type="submit" className="gap-2" disabled={envoi || !saisie.trim()}>
            {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span className="hidden sm:inline">Envoyer</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
