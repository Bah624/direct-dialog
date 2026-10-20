import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@project/components/lib/utils';

export type PanneauCarte = {
  id: string;
  referenceEmplacement?: string;
  localisation?: string;
  ville?: string;
  disponibilite?: string;
  latitude?: number;
  longitude?: number;
};

const COULEURS: Record<string, string> = {
  Disponible: '#10b981',
  Réservé: '#f59e0b',
  Occupé: '#ef4444',
  'En maintenance': '#94a3b8',
};

// Fond de carte OpenStreetMap, sans clé d'API.
const FOND = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

function icone(actif: boolean, couleur: string) {
  return L.divIcon({
    className: '',
    html: `<div class="dd-pin${actif ? ' dd-pin-actif' : ''}" style="--pin:${couleur}"><span></span></div>`,
    iconSize: [26, 32],
    iconAnchor: [13, 30],
    popupAnchor: [0, -28],
  });
}

type Props = {
  panneaux: PanneauCarte[];
  selection?: string | null;
  onSelect?: (id: string) => void;
  /** Mode « choisir une position » : un clic sur la carte renvoie les coordonnées. */
  onPick?: (latitude: number, longitude: number) => void;
  /** Position à afficher en mode choisir (marqueur déplaçable). */
  point?: { latitude?: number; longitude?: number } | null;
  centre?: { latitude?: number; longitude?: number } | null;
  hauteur?: number;
  className?: string;
};

export default function CartePanneaux({
  panneaux,
  selection,
  onSelect,
  onPick,
  point,
  centre,
  hauteur = 420,
  className,
}: Props) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<L.Map | null>(null);
  const marqueurs = useRef<Map<string, L.Marker>>(new Map());
  const marqueurPoint = useRef<L.Marker | null>(null);

  // Initialisation
  useEffect(() => {
    if (!conteneur.current) return;

    const instance = L.map(conteneur.current, {
      center: [centre?.latitude ?? 9.6412, centre?.longitude ?? -13.5784], // Conakry par défaut
      zoom: 12,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer(FOND, {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(instance);

    instance.on('click', (e: L.LeafletMouseEvent) => {
      if (onPick) onPick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    });

    carte.current = instance;
    return () => {
      instance.remove();
      carte.current = null;
      marqueurs.current.clear();
      marqueurPoint.current = null;
    };
    // La carte n'est créée qu'une fois ; les données sont mises à jour ensuite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marqueurs des panneaux
  useEffect(() => {
    const instance = carte.current;
    if (!instance) return;

    for (const marqueur of marqueurs.current.values()) marqueur.remove();
    marqueurs.current.clear();

    const avecCoordonnees = panneaux.filter(
      (p) => typeof p.latitude === 'number' && typeof p.longitude === 'number',
    );

    for (const panneau of avecCoordonnees) {
      const actif = selection === panneau.id;
      const marqueur = L.marker([panneau.latitude!, panneau.longitude!], {
        icon: icone(actif, COULEURS[panneau.disponibilite ?? ''] ?? '#38bdf8'),
        title: panneau.referenceEmplacement ?? 'Panneau',
      });

      marqueur.bindTooltip(
        `<strong>${panneau.referenceEmplacement ?? 'Panneau'}</strong>` +
          (panneau.ville ? `<br/>${panneau.ville}` : ''),
        { direction: 'top', offset: [0, -18] },
      );
      marqueur.on('click', () => onSelect?.(panneau.id));
      marqueur.addTo(instance);
      marqueurs.current.set(panneau.id, marqueur);
    }

    if (avecCoordonnees.length > 0 && !selection) {
      const bounds = L.latLngBounds(
        avecCoordonnees.map((p) => [p.latitude!, p.longitude!] as [number, number]),
      );
      instance.fitBounds(bounds.pad(0.25), { maxZoom: 14, animate: false });
    }
  }, [panneaux, selection, onSelect]);

  // Recentrage sur la sélection
  useEffect(() => {
    const instance = carte.current;
    if (!instance || !selection) return;
    const panneau = panneaux.find((p) => p.id === selection);
    if (panneau?.latitude != null && panneau.longitude != null) {
      instance.setView([panneau.latitude, panneau.longitude], Math.max(instance.getZoom(), 14), {
        animate: true,
      });
    }
  }, [selection, panneaux]);

  // Marqueur du point choisi (mode sélection de position)
  useEffect(() => {
    const instance = carte.current;
    if (!instance) return;

    const latitude = point?.latitude;
    const longitude = point?.longitude;
    const valide = typeof latitude === 'number' && typeof longitude === 'number';

    if (!onPick || !valide) {
      marqueurPoint.current?.remove();
      marqueurPoint.current = null;
      return;
    }

    if (!marqueurPoint.current) {
      marqueurPoint.current = L.marker([latitude, longitude], {
        icon: icone(true, '#f97316'),
        draggable: true,
      }).addTo(instance);
      marqueurPoint.current.on('dragend', () => {
        const position = marqueurPoint.current?.getLatLng();
        if (position) {
          onPick(Number(position.lat.toFixed(6)), Number(position.lng.toFixed(6)));
        }
      });
    } else {
      marqueurPoint.current.setLatLng([latitude, longitude]);
    }
  }, [point?.latitude, point?.longitude, onPick]);

  const sansCoordonnees = panneaux.filter(
    (p) => typeof p.latitude !== 'number' || typeof p.longitude !== 'number',
  ).length;

  return (
    <div className={cn('relative overflow-hidden rounded-lg border border-border', className)}>
      <div ref={conteneur} style={{ height: hauteur }} className="w-full z-0" />

      {onPick && (
        <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-md bg-background/95 px-2.5 py-1.5 text-[11px] shadow-sm ring-1 ring-border">
          Cliquez sur la carte (ou déplacez le repère) pour choisir la position
        </div>
      )}

      {sansCoordonnees > 0 && !onPick && (
        <div className="pointer-events-none absolute left-3 bottom-3 z-[500] rounded-md bg-background/95 px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-sm ring-1 ring-border">
          {sansCoordonnees} panneau{sansCoordonnees > 1 ? 'x' : ''} sans coordonnées GPS
        </div>
      )}
    </div>
  );
}
