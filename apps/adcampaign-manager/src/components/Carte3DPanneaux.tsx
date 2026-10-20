import { useEffect, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  LngLatBounds,
  NavigationControl,
  setWorkerUrl,
  type StyleSpecification,
} from 'maplibre-gl';
import urlWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

// Le worker de MapLibre doit être servi par le bundle (sinon les tuiles
// vectorielles ne sont jamais analysées).
setWorkerUrl(urlWorker);
import { cn } from '@project/components/lib/utils';

export type Panneau3D = {
  id: string;
  referenceEmplacement?: string;
  ville?: string;
  disponibilite?: string;
  latitude?: number;
  longitude?: number;
};

const COULEURS: Record<string, string> = {
  Disponible: '#34d399',
  Réservé: '#fbbf24',
  Occupé: '#f87171',
  'En maintenance': '#cbd5e1',
};

// Carte satellite 3D : imagerie Esri + bâtiments OpenStreetMap extrudés
// (tuiles vectorielles VersaTiles), sans clé d'API.
const STYLE: StyleSpecification = {
  version: 8,
  name: 'Satellite 3D',
  sources: {
    satellite: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagerie &copy; Esri, Maxar, Earthstar Geographics',
    },
    plan: {
      type: 'vector',
      tiles: ['https://tiles.versatiles.org/tiles/osm/{z}/{x}/{y}'],
      minzoom: 0,
      maxzoom: 14,
      bounds: [-180, -90, 180, 90],
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'fond-satellite',
      type: 'raster',
      source: 'satellite',
      paint: { 'raster-brightness-max': 0.95, 'raster-saturation': -0.1 },
    },
    {
      id: 'batiments',
      type: 'fill-extrusion',
      source: 'plan',
      'source-layer': 'buildings',
      minzoom: 13,
      paint: {
        'fill-extrusion-color': '#ffffff',
        'fill-extrusion-height': 18,
        'fill-extrusion-opacity': 0.62,
      },
    },
  ],
};

type Props = {
  panneaux: Panneau3D[];
  selection?: string | null;
  onSelect?: (id: string) => void;
  hauteur?: number;
  className?: string;
};

export default function Carte3DPanneaux({
  panneaux,
  selection,
  onSelect,
  hauteur = 560,
  className,
}: Props) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<MapLibreMap | null>(null);
  const marqueurs = useRef<Map<string, MapLibreMarker>>(new Map());
  const [relief, setRelief] = useState(true);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    if (!conteneur.current) return;

    const instance = new MapLibreMap({
      container: conteneur.current,
      style: STYLE,
      center: [2.345, 48.862],
      zoom: 14,
      pitch: 58,
      bearing: -22,
      maxPitch: 75,
      antialias: true,
      attributionControl: { compact: true },
    });

    instance.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');

    // Le conteneur peut être monté avec une taille nulle (onglet) : on force
    // un premier dimensionnement, puis on suit les changements de taille.
    const redimensionner = () => instance.resize();
    requestAnimationFrame(redimensionner);
    const observateur = new ResizeObserver(redimensionner);
    observateur.observe(conteneur.current);

    instance.on('load', () => setPret(true));
    instance.on('idle', () => setPret(true));
    instance.on('error', (evenement) => {
      console.warn('[carte3d]', evenement?.error?.message ?? evenement);
    });
    const secours = window.setTimeout(() => setPret(true), 3000);

    carte.current = instance;
    return () => {
      window.clearTimeout(secours);
      observateur.disconnect();
      instance.remove();
      carte.current = null;
      marqueurs.current.clear();
      setPret(false);
    };
  }, []);

  // Marqueurs : panneaux plats, sans dégradé ni relief.
  useEffect(() => {
    const instance = carte.current;
    if (!instance) return;

    for (const marqueur of marqueurs.current.values()) marqueur.remove();
    marqueurs.current.clear();

    const geolocalises = panneaux.filter(
      (p) => typeof p.latitude === 'number' && typeof p.longitude === 'number',
    );

    for (const panneau of geolocalises) {
      const actif = selection === panneau.id;
      const element = document.createElement('button');
      element.type = 'button';
      element.className = cn('dd-bb', actif && 'dd-bb-actif');
      element.style.setProperty('--pin', COULEURS[panneau.disponibilite ?? ''] ?? '#38bdf8');
      element.innerHTML =
        `<span class="dd-bb-carte"><strong>${panneau.referenceEmplacement ?? 'Panneau'}</strong>` +
        `<small>${panneau.ville ?? ''}</small></span>` +
        `<span class="dd-bb-tige"></span><span class="dd-bb-sol"></span>`;
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        onSelect?.(panneau.id);
      });

      const marqueur = new MapLibreMarker({ element, anchor: 'bottom' })
        .setLngLat([panneau.longitude!, panneau.latitude!])
        .addTo(instance);
      marqueurs.current.set(panneau.id, marqueur);
    }

    if (geolocalises.length > 0 && !selection) {
      // On cadre la ville qui concentre le plus de panneaux, pour rester assez
      // proche du sol et voir les bâtiments en 3D.
      const parVille = new Map<string, Panneau3D[]>();
      for (const panneau of geolocalises) {
        const ville = panneau.ville || '—';
        parVille.set(ville, [...(parVille.get(ville) ?? []), panneau]);
      }
      const groupe = [...parVille.values()].sort((a, b) => b.length - a.length)[0];
      const etendue = Math.max(
        ...geolocalises.map((p) => Math.abs(p.latitude! - groupe[0].latitude!)),
        ...geolocalises.map((p) => Math.abs(p.longitude! - groupe[0].longitude!)),
      );

      if (etendue > 0.3) {
        instance.jumpTo({
          center: [groupe[0].longitude!, groupe[0].latitude!],
          zoom: 15,
          pitch: 58,
          bearing: -22,
        });
      } else {
        const bornes = groupe.reduce(
          (acc, p) => acc.extend([p.longitude!, p.latitude!]),
          new LngLatBounds(
            [groupe[0].longitude!, groupe[0].latitude!],
            [groupe[0].longitude!, groupe[0].latitude!],
          ),
        );
        instance.fitBounds(bornes, { padding: 90, maxZoom: 15.5, pitch: 58, bearing: -22, duration: 0 });
      }
    }
  }, [panneaux, selection, onSelect]);

  // Recentrage sur la sélection
  useEffect(() => {
    const instance = carte.current;
    if (!instance || !selection) return;
    const panneau = panneaux.find((p) => p.id === selection);
    if (panneau?.latitude != null && panneau.longitude != null) {
      instance.easeTo({
        center: [panneau.longitude, panneau.latitude],
        zoom: Math.max(instance.getZoom(), 15),
        pitch: 58,
        duration: 700,
      });
    }
  }, [selection, panneaux]);

  const basculerRelief = () => {
    const instance = carte.current;
    if (!instance) return;
    const prochain = !relief;
    setRelief(prochain);
    instance.easeTo({ pitch: prochain ? 58 : 0, bearing: prochain ? -22 : 0, duration: 600 });
  };

  const recentrer = () => {
    const instance = carte.current;
    if (!instance) return;
    const geolocalises = panneaux.filter((p) => p.latitude != null && p.longitude != null);
    if (geolocalises.length === 0) return;
    const bornes = geolocalises.reduce(
      (acc, p) => acc.extend([p.longitude!, p.latitude!]),
      new LngLatBounds(
        [geolocalises[0].longitude!, geolocalises[0].latitude!],
        [geolocalises[0].longitude!, geolocalises[0].latitude!],
      ),
    );
    instance.fitBounds(bornes, { padding: 90, maxZoom: 15, pitch: relief ? 58 : 0, duration: 600 });
  };

  return (
    <div className={cn('relative overflow-hidden rounded-lg border border-border', className)}>
      <div ref={conteneur} style={{ height: hauteur }} className="w-full" />

      <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-lg bg-background/90 p-1 shadow-sm ring-1 ring-border backdrop-blur">
        <button
          type="button"
          onClick={basculerRelief}
          className="rounded px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted"
        >
          {relief ? 'Vue plan' : 'Vue 3D'}
        </button>
        <button
          type="button"
          onClick={recentrer}
          className="rounded px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted"
        >
          Recentrer
        </button>
      </div>

      {!pret && (
        <div className="absolute inset-0 grid place-items-center bg-muted/60 text-xs text-muted-foreground">
          Chargement de la carte satellite…
        </div>
      )}
    </div>
  );
}
