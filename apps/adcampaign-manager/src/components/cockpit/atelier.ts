// Vue « Atelier » : le même grand espace que dans le siège, vu de plus près,
// avec ses quatre pôles (opérations, imprimerie, soudure, décoration).

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  construireAtelier,
  creerSalleAtelier,
  DISPOSITION_POLES,
  LARGEUR_ATELIER,
  NOMS_POLES,
  PROFONDEUR_ATELIER,
  type PoleId,
  type StatutPole,
} from './poles';

export type ZoneAtelier = {
  id: PoleId;
  nom: string;
  operations: number;
  statut: StatutPole;
};

export type AtelierHandle = {
  dispose: () => void;
  focus: (id: string | null) => void;
  setRotation: (actif: boolean) => void;
  redimensionner: () => void;
};

const ORDRE: PoleId[] = ['operations', 'imprimerie', 'soudure', 'decoration'];

export const ZONES_ATELIER: ZoneAtelier[] = ORDRE.map((id) => ({
  id,
  nom: NOMS_POLES[id],
  operations: 0,
  statut: 'libre',
}));

export function creerAtelier(
  conteneur: HTMLDivElement,
  zones: ZoneAtelier[],
  options: { onSelect?: (id: string | null) => void; rotation?: boolean } = {},
): AtelierHandle {
  const largeur = () => conteneur.clientWidth || 800;
  const hauteur = () => conteneur.clientHeight || 600;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(largeur(), hauteur());
  renderer.setClearColor(0x060d1a, 1);
  conteneur.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x060d1a, 0.008);

  const camera = new THREE.PerspectiveCamera(40, largeur() / hauteur(), 0.1, 300);
  camera.position.set(29, 27, 33);

  const controles = new OrbitControls(camera, renderer.domElement);
  controles.enableDamping = true;
  controles.dampingFactor = 0.07;
  controles.enablePan = false;
  controles.minDistance = 16;
  controles.maxDistance = 80;
  controles.minPolarAngle = 0.4;
  controles.maxPolarAngle = 1.18;
  controles.target.set(0, 1.5, 0);

  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x0b1220, 1.25));

  const plafonnier = new THREE.DirectionalLight(0xffffff, 2.3);
  plafonnier.position.set(-8, 30, 12);
  scene.add(plafonnier);

  const appoint = new THREE.DirectionalLight(0x93c5fd, 0.9);
  appoint.position.set(20, 14, -14);
  scene.add(appoint);

  const metal = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.35 });
  const verre = new THREE.MeshStandardMaterial({
    color: 0x93c5fd,
    transparent: true,
    opacity: 0.09,
    roughness: 0.2,
    side: THREE.DoubleSide,
  });
  const areteVerre = new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.4 });

  const groupe = new THREE.Group();
  scene.add(groupe);

  const cliquables: THREE.Object3D[] = [];
  const etiquettes: { sprite: THREE.Sprite; base: number }[] = [];

  function cliquable(objet: THREE.Object3D, id: string) {
    objet.userData.salleId = id;
    cliquables.push(objet);
  }

  const dalle = creerSalleAtelier(groupe, new THREE.Color(0x38bdf8));
  cliquable(dalle, 'atelier');

  const hauteurMur = 3;
  const murNord = new THREE.Mesh(new THREE.BoxGeometry(LARGEUR_ATELIER, hauteurMur, 0.08), verre);
  murNord.position.set(0, hauteurMur / 2, -PROFONDEUR_ATELIER / 2);
  groupe.add(murNord);
  const areteNord = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(LARGEUR_ATELIER, hauteurMur, 0.08)),
    areteVerre,
  );
  areteNord.position.copy(murNord.position);
  groupe.add(areteNord);

  const murOuest = new THREE.Mesh(new THREE.BoxGeometry(0.08, hauteurMur, PROFONDEUR_ATELIER), verre);
  murOuest.position.set(-LARGEUR_ATELIER / 2, hauteurMur / 2, 0);
  groupe.add(murOuest);
  const areteOuest = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.08, hauteurMur, PROFONDEUR_ATELIER)),
    areteVerre,
  );
  areteOuest.position.copy(murOuest.position);
  groupe.add(areteOuest);

  cliquable(murNord, 'atelier');
  cliquable(murOuest, 'atelier');

  construireAtelier(
    groupe,
    zones.map((z) => ({
      id: z.id,
      nom: z.nom,
      operations: z.operations,
      responsables: 0,
      statut: z.statut,
    })),
    { cliquable, etiquettes },
  );

  // --- Interaction ----------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointeur = new THREE.Vector2();
  let survol: string | null = null;
  let rotationActive = options.rotation ?? true;
  let cadre = 0;
  let dernier = performance.now();
  let depart = 0;
  let departSouris = { x: 0, y: 0 };

  function positionPointeur(e: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointeur.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointeur.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function zoneSousPointeur(): string | null {
    raycaster.setFromCamera(pointeur, camera);
    const hit = raycaster.intersectObjects(cliquables, false)[0];
    return (hit?.object.userData.salleId as string) ?? null;
  }

  const surBas = (e: PointerEvent) => {
    departSouris = { x: e.clientX, y: e.clientY };
  };
  const surHaut = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - departSouris.x, e.clientY - departSouris.y) > 6) return;
    positionPointeur(e);
    options.onSelect?.(zoneSousPointeur());
  };
  const surDeplacement = (e: PointerEvent) => {
    positionPointeur(e);
    const id = zoneSousPointeur();
    if (id !== survol) {
      survol = id;
      renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
    }
  };

  renderer.domElement.addEventListener('pointerdown', surBas);
  renderer.domElement.addEventListener('pointerup', surHaut);
  renderer.domElement.addEventListener('pointermove', surDeplacement);
  renderer.domElement.style.cursor = 'grab';

  // --- Boucle ---------------------------------------------------------------
  const cible = new THREE.Vector3(0, 1.5, 0);

  function animer() {
    cadre = requestAnimationFrame(animer);
    const maintenant = performance.now();
    const dt = (maintenant - dernier) / 1000;
    dernier = maintenant;
    depart += dt;

    if (depart < 1.6) {
      const t = Math.min(1, depart / 1.6);
      const ease = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(new THREE.Vector3(38, 34, 42), new THREE.Vector3(29, 27, 33), ease);
    } else if (rotationActive && !survol) {
      const rayon = Math.hypot(camera.position.x, camera.position.z);
      const angle = Math.atan2(camera.position.z, camera.position.x) + dt * 0.03;
      camera.position.x = Math.cos(angle) * rayon;
      camera.position.z = Math.sin(angle) * rayon;
    }

    controles.target.lerp(cible, 0.08);
    controles.update();

    etiquettes.forEach(({ sprite, base }, index) => {
      sprite.position.y = base + Math.sin(maintenant / 1000 + index) * 0.07;
    });

    renderer.render(scene, camera);
  }
  animer();

  // --- API ------------------------------------------------------------------
  function focus(id: string | null) {
    const emplacement = id && id !== 'atelier' ? DISPOSITION_POLES[id as PoleId] : null;
    if (emplacement) {
      controles.target.set(emplacement.x, 1.8, emplacement.z);
      cible.copy(controles.target);
      camera.position.set(emplacement.x + 12, 13, emplacement.z + 12);
      rotationActive = false;
    } else {
      controles.target.set(0, 1.5, 0);
      cible.set(0, 1.5, 0);
    }
  }

  function setRotation(actif: boolean) {
    rotationActive = actif;
  }

  function redimensionner() {
    camera.aspect = largeur() / hauteur();
    camera.updateProjectionMatrix();
    renderer.setSize(largeur(), hauteur());
  }

  const observateur = new ResizeObserver(() => redimensionner());
  observateur.observe(conteneur);

  function dispose() {
    cancelAnimationFrame(cadre);
    observateur.disconnect();
    renderer.domElement.removeEventListener('pointerdown', surBas);
    renderer.domElement.removeEventListener('pointerup', surHaut);
    renderer.domElement.removeEventListener('pointermove', surDeplacement);
    controles.dispose();
    scene.traverse((objet) => {
      const mesh = objet as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const materiau = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(materiau)) materiau.forEach((m) => m.dispose());
      else materiau?.dispose();
    });
    renderer.dispose();
    conteneur.removeChild(renderer.domElement);
  }

  return { dispose, focus, setRotation, redimensionner };
}
