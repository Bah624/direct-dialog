// Maquette 3D du siège : tous les bureaux de l'entreprise réunis autour d'un
// hall central. Chaque bureau est cliquable et affiche ses responsables et le
// volume d'opérations à traiter.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type StatutSalle = 'active' | 'attente' | 'alerte' | 'libre';

export type Salle = {
  id: string;
  nom: string;
  operations: number;
  responsables: number;
  statut: StatutSalle;
};

export type SiegeHandle = {
  dispose: () => void;
  focus: (id: string | null) => void;
  setRotation: (actif: boolean) => void;
  redimensionner: () => void;
};

const COULEURS: Record<StatutSalle, number> = {
  active: 0xf97316,
  attente: 0xfacc15,
  alerte: 0xef4444,
  libre: 0x38bdf8,
};

type EmplacementSalle = {
  id: string;
  x: number;
  z: number;
};

const EMPLACEMENTS: EmplacementSalle[] = [
  { id: 'accueil', x: -11, z: -9 },
  { id: 'operations', x: 0, z: -9 },
  { id: 'atelier', x: 11, z: -9 },
  { id: 'comptabilite', x: -11, z: 0 },
  { id: 'studio', x: 11, z: 0 },
  { id: 'rh', x: -11, z: 9 },
  { id: 'commercial', x: 0, z: 9 },
  { id: 'direction', x: 11, z: 9 },
];

export const SALLES_SIEGE = EMPLACEMENTS.map((e) => e.id);

const NOMS: Record<string, string> = {
  accueil: 'Accueil',
  operations: 'Opérations',
  atelier: 'Atelier',
  comptabilite: 'Comptabilité',
  studio: 'Studio graphique',
  rh: 'Ressources humaines',
  commercial: 'Commercial',
  direction: 'Direction',
};

const LARGEUR = 9;
const PROFONDEUR = 7.4;

function textureEtiquette(
  nom: string,
  operations: number,
  responsables: number,
  statut: StatutSalle,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 190;
  const ctx = canvas.getContext('2d')!;
  const teinte = `#${COULEURS[statut].toString(16).padStart(6, '0')}`;

  ctx.fillStyle = 'rgba(8, 16, 30, 0.93)';
  ctx.beginPath();
  ctx.roundRect(0, 0, 640, 190, 26);
  ctx.fill();
  ctx.strokeStyle = teinte;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = teinte;
  ctx.beginPath();
  ctx.roundRect(22, 24, 8, 142, 4);
  ctx.fill();

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText(nom.slice(0, 24), 50, 70);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '30px system-ui, sans-serif';
  ctx.fillText(`${responsables} responsable${responsables > 1 ? 's' : ''}`, 50, 112);

  ctx.fillStyle = operations > 0 ? teinte : '#64748b';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(
    operations === 0 ? 'aucune action' : `${operations} opération${operations > 1 ? 's' : ''} à traiter`,
    50,
    158,
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function creerSiege(
  conteneur: HTMLDivElement,
  salles: Salle[],
  options: { onSelect?: (id: string | null) => void; rotation?: boolean } = {},
): SiegeHandle {
  const largeur = () => conteneur.clientWidth || 800;
  const hauteur = () => conteneur.clientHeight || 600;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(largeur(), hauteur());
  renderer.setClearColor(0x060d1a, 1);
  conteneur.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x060d1a, 0.008);

  const camera = new THREE.PerspectiveCamera(38, largeur() / hauteur(), 0.1, 400);
  camera.position.set(30, 26, 34);

  const controles = new OrbitControls(camera, renderer.domElement);
  controles.enableDamping = true;
  controles.dampingFactor = 0.06;
  controles.enablePan = false;
  controles.minDistance = 20;
  controles.maxDistance = 90;
  controles.minPolarAngle = 0.4;
  controles.maxPolarAngle = 1.18;
  controles.target.set(0, 1.5, 0);

  // --- Lumières -------------------------------------------------------------
  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x0b1220, 1.15));

  const soleil = new THREE.DirectionalLight(0xffffff, 2.1);
  soleil.position.set(-14, 34, 18);
  scene.add(soleil);

  const contraste = new THREE.DirectionalLight(0x93c5fd, 0.85);
  contraste.position.set(24, 16, -20);
  scene.add(contraste);

  // --- Sol du plateau -------------------------------------------------------
  const dalle = new THREE.Mesh(
    new THREE.BoxGeometry(44, 0.4, 38),
    new THREE.MeshStandardMaterial({ color: 0x0c1728, roughness: 0.95 }),
  );
  dalle.position.y = -0.2;
  scene.add(dalle);

  const trame = new THREE.GridHelper(44, 44, 0x1e3a5f, 0x14253d);
  (trame.material as THREE.Material).transparent = true;
  (trame.material as THREE.Material).opacity = 0.4;
  trame.position.y = 0.02;
  scene.add(trame);

  // --- Matériaux ------------------------------------------------------------
  const bois = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.35 });
  const sombre = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
  const verre = new THREE.MeshStandardMaterial({
    color: 0x93c5fd,
    transparent: true,
    opacity: 0.12,
    roughness: 0.2,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  const areteVerre = new THREE.LineBasicMaterial({
    color: 0x60a5fa,
    transparent: true,
    opacity: 0.45,
  });

  const salleParId = new Map(salles.map((s) => [s.id, s]));
  const groupes = new Map<string, THREE.Group>();
  const cliquables: THREE.Object3D[] = [];
  const etiquettes: { sprite: THREE.Sprite; base: number }[] = [];

  const couleurDe = (id: string) =>
    new THREE.Color(COULEURS[salleParId.get(id)?.statut ?? 'libre']);

  function cliquable(objet: THREE.Object3D, id: string) {
    objet.userData.salleId = id;
    cliquables.push(objet);
  }

  // --- Personnages ----------------------------------------------------------
  function personnage(couleur: THREE.Color, poste: number) {
    const groupe = new THREE.Group();
    const corps = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.3, 0.95, 10),
      new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.7 }),
    );
    corps.position.y = 0.72;
    groupe.add(corps);

    const tete = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xe2c4a8, roughness: 0.8 }),
    );
    tete.position.y = 1.42;
    groupe.add(tete);

    groupe.position.set(poste, 0, 0);
    return groupe;
  }

  // --- Bureau ---------------------------------------------------------------
  function bureau(groupe: THREE.Group, x: number, z: number, couleur: THREE.Color, id: string) {
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 1.3), bois);
    table.position.set(x, 0.95, z);
    groupe.add(table);
    cliquable(table, id);

    for (const [dx, dz] of [[-1.2, -0.5], [1.2, -0.5], [-1.2, 0.5], [1.2, 0.5]]) {
      const pied = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.08), metal);
      pied.position.set(x + dx, 0.47, z + dz);
      groupe.add(pied);
    }

    const ecran = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.55, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x1d4ed8 }),
    );
    ecran.position.set(x - 0.6, 1.32, z - 0.25);
    groupe.add(ecran);

    const chaise = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.12, 0.75), sombre);
    chaise.position.set(x - 0.2, 0.55, z + 1.05);
    groupe.add(chaise);
    const dossier = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.1), sombre);
    dossier.position.set(x - 0.2, 0.95, z + 1.42);
    groupe.add(dossier);

    const personne = personnage(couleur, 0);
    personne.position.set(x + 0.5, 0, z + 1.6);
    personne.rotation.y = Math.PI;
    groupe.add(personne);

    // Petite plante
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.18, 0.32, 10),
      new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.9 }),
    );
    pot.position.set(x + 1.5, 0.16, z - 1.1);
    groupe.add(pot);
    const feuillage = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 }),
    );
    feuillage.position.set(x + 1.5, 0.55, z - 1.1);
    groupe.add(feuillage);
  }

  // --- Salles ---------------------------------------------------------------
  for (const emplacement of EMPLACEMENTS) {
    const salle = salleParId.get(emplacement.id);
    const groupe = new THREE.Group();
    groupe.position.set(emplacement.x, 0, emplacement.z);

    const teinte = couleurDe(emplacement.id);

    // Dalle de la salle
    const dalleSalle = new THREE.Mesh(
      new THREE.BoxGeometry(LARGEUR, 0.14, PROFONDEUR),
      new THREE.MeshStandardMaterial({
        color: teinte,
        transparent: true,
        opacity: 0.16,
        roughness: 0.9,
      }),
    );
    dalleSalle.position.y = 0.07;
    groupe.add(dalleSalle);
    cliquable(dalleSalle, emplacement.id);

    const bordure = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(LARGEUR, 0.02, PROFONDEUR)),
      new THREE.LineBasicMaterial({ color: teinte, transparent: true, opacity: 0.6 }),
    );
    bordure.position.y = 0.15;
    groupe.add(bordure);

    // Cloisons vitrées : deux côtés pour garder la vue isométrique
    const hauteurMur = 2.6;
    const murNord = new THREE.Mesh(new THREE.BoxGeometry(LARGEUR, hauteurMur, 0.08), verre);
    murNord.position.set(0, hauteurMur / 2, -PROFONDEUR / 2);
    groupe.add(murNord);
    const areteNord = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(LARGEUR, hauteurMur, 0.08)),
      areteVerre,
    );
    areteNord.position.copy(murNord.position);
    groupe.add(areteNord);

    const murOuest = new THREE.Mesh(new THREE.BoxGeometry(0.08, hauteurMur, PROFONDEUR), verre);
    murOuest.position.set(-LARGEUR / 2, hauteurMur / 2, 0);
    groupe.add(murOuest);
    const areteOuest = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.08, hauteurMur, PROFONDEUR)),
      areteVerre,
    );
    areteOuest.position.copy(murOuest.position);
    groupe.add(areteOuest);

    cliquable(murNord, emplacement.id);
    cliquable(murOuest, emplacement.id);

    // Mobilier : deux postes de travail
    bureau(groupe, -2.1, -0.6, teinte, emplacement.id);
    bureau(groupe, 2.1, -0.6, teinte, emplacement.id);

    // Étiquette flottante
    const texture = textureEtiquette(
      NOMS[emplacement.id] ?? emplacement.id,
      salle?.operations ?? 0,
      salle?.responsables ?? 0,
      salle?.statut ?? 'libre',
    );
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
    );
    sprite.scale.set(5.6, 1.66, 1);
    sprite.position.set(0, 5.2, 0);
    groupe.add(sprite);
    etiquettes.push({ sprite, base: 5.2 });

    const matEtiquette = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 3.4, 6), metal);
    matEtiquette.position.set(0, 2.7, 0);
    groupe.add(matEtiquette);

    scene.add(groupe);
    groupes.set(emplacement.id, groupe);
  }

  // --- Hall central ---------------------------------------------------------
  const hall = new THREE.Group();

  const tapis = new THREE.Mesh(
    new THREE.CircleGeometry(4.6, 48),
    new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.9 }),
  );
  tapis.rotation.x = -Math.PI / 2;
  tapis.position.y = 0.03;
  hall.add(tapis);

  const anneau = new THREE.Mesh(
    new THREE.RingGeometry(4.5, 4.75, 48),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  );
  anneau.rotation.x = -Math.PI / 2;
  anneau.position.y = 0.05;
  hall.add(anneau);

  const comptoir = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 1.1), bois);
  comptoir.position.set(0, 0.55, 0.4);
  hall.add(comptoir);

  const logo = new THREE.Mesh(
    new THREE.CircleGeometry(1.1, 32),
    new THREE.MeshBasicMaterial({ color: 0xf97316 }),
  );
  logo.rotation.x = -Math.PI / 2;
  logo.position.set(0, 0.06, 0.4);
  hall.add(logo);

  scene.add(hall);

  // --- Interaction ----------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointeur = new THREE.Vector2();
  let selection: string | null = null;
  let survol: string | null = null;
  let rotationActive = options.rotation ?? true;
  let cadre = 0;
  let dernier = performance.now();
  let depart = 0;
  let departSouris = { x: 0, y: 0 };

  function appliquerEtat(id: string) {
    const groupe = groupes.get(id);
    if (!groupe) return;
    const actif = selection === id || survol === id;
    groupe.position.y = selection === id ? 0.35 : 0;
    groupe.scale.setScalar(selection === id ? 1.03 : 1);

    groupe.traverse((objet) => {
      const mesh = objet as THREE.Mesh;
      const materiau = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (materiau && materiau.emissive && materiau.transparent && materiau.opacity <= 0.2) {
        materiau.opacity = actif ? 0.28 : 0.12;
      }
    });
  }

  function positionPointeur(e: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointeur.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointeur.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function salleSousPointeur(): string | null {
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
    const id = salleSousPointeur();
    selection = id;
    groupes.forEach((_, cle) => appliquerEtat(cle));
    options.onSelect?.(id);
  };
  const surDeplacement = (e: PointerEvent) => {
    positionPointeur(e);
    const id = salleSousPointeur();
    if (id !== survol) {
      survol = id;
      renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
      groupes.forEach((_, cle) => appliquerEtat(cle));
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

    if (depart < 1.8) {
      const t = Math.min(1, depart / 1.8);
      const ease = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(new THREE.Vector3(44, 38, 48), new THREE.Vector3(30, 26, 34), ease);
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
    selection = id;
    groupes.forEach((_, cle) => appliquerEtat(cle));
    const groupe = id ? groupes.get(id) : null;
    if (groupe) {
      const position = groupe.position;
      controles.target.set(position.x, 1.8, position.z);
      cible.copy(controles.target);
      camera.position.set(position.x + 21, 23, position.z + 21);
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
