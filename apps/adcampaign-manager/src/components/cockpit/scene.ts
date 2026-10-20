// Scène 3D du cockpit : une ville isométrique stylisée où chaque emplacement
// publicitaire est représenté par un panneau lumineux, coloré selon sa
// disponibilité. Rendue en Three.js pur, sans dépendance React.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type Panneau = {
  id: string;
  reference: string;
  localisation?: string;
  ville?: string;
  type?: string;
  format?: string;
  prixParSemaine?: number;
  disponibilite?: string;
};

export type SceneHandle = {
  dispose: () => void;
  focus: (id: string | null) => void;
  setRotation: (actif: boolean) => void;
  setFiltre: (filtre: string | null) => void;
  redimensionner: () => void;
};

const COULEURS: Record<string, number> = {
  Disponible: 0x22c55e,
  Réservé: 0xf59e0b,
  Occupé: 0xef4444,
  'En maintenance': 0x94a3b8,
};

const couleur = (dispo?: string) =>
  COULEURS[dispo ?? ''] ?? 0x38bdf8;

/** Générateur pseudo-aléatoire déterministe (le décor ne change pas au rechargement). */
function aleatoire(graine: number) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ANCRAGES: { x: number; z: number; rotation: number }[] = [
  { x: -3.6, z: -7, rotation: 0.5 },
  { x: 3.6, z: 6.5, rotation: -2.6 },
  { x: -8.5, z: 3.6, rotation: 1.6 },
  { x: 8.5, z: -3.6, rotation: -1.6 },
  { x: -3.6, z: 9, rotation: 0.4 },
  { x: 3.6, z: -9.5, rotation: -2.7 },
  { x: -12, z: 0, rotation: 1.57 },
  { x: 12, z: 0, rotation: -1.57 },
];

export function creerScene(
  conteneur: HTMLDivElement,
  panneaux: Panneau[],
  options: { onSelect?: (id: string | null) => void; rotation?: boolean } = {},
): SceneHandle {
  const largeur = () => conteneur.clientWidth || 800;
  const hauteur = () => conteneur.clientHeight || 600;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(largeur(), hauteur());
  renderer.shadowMap.enabled = false;
  renderer.setClearColor(0x050b18, 1);
  conteneur.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050b18, 0.012);

  const camera = new THREE.PerspectiveCamera(42, largeur() / hauteur(), 0.1, 400);
  camera.position.set(18, 15, 18);

  const controles = new OrbitControls(camera, renderer.domElement);
  controles.enableDamping = true;
  controles.dampingFactor = 0.06;
  controles.enablePan = false;
  controles.minDistance = 14;
  controles.maxDistance = 70;
  controles.minPolarAngle = 0.35;
  controles.maxPolarAngle = 1.25;
  controles.target.set(0, 2, 0);

  // --- Lumières -------------------------------------------------------------
  scene.add(new THREE.HemisphereLight(0x93c5fd, 0x111c30, 1.15));

  const lune = new THREE.DirectionalLight(0xdbeafe, 2.1);
  lune.position.set(-18, 32, -12);
  scene.add(lune);

  const contre = new THREE.DirectionalLight(0x38bdf8, 0.9);
  contre.position.set(20, 14, 18);
  scene.add(contre);

  const halo = new THREE.PointLight(0x38bdf8, 110, 90, 2);
  halo.position.set(0, 16, 0);
  scene.add(halo);

  // --- Sol ------------------------------------------------------------------
  const sol = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: 0x070f1f, roughness: 1, metalness: 0 }),
  );
  sol.rotation.x = -Math.PI / 2;
  scene.add(sol);

  const grille = new THREE.GridHelper(120, 60, 0x1e3a5f, 0x122033);
  (grille.material as THREE.Material).transparent = true;
  (grille.material as THREE.Material).opacity = 0.35;
  scene.add(grille);

  // --- Routes ---------------------------------------------------------------
  const routeMat = new THREE.MeshStandardMaterial({ color: 0x0d1728, roughness: 0.9 });
  const routeX = new THREE.Mesh(new THREE.BoxGeometry(120, 0.08, 5.5), routeMat);
  routeX.position.y = 0.04;
  scene.add(routeX);
  const routeZ = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.08, 120), routeMat);
  routeZ.position.y = 0.04;
  scene.add(routeZ);

  const marquageMat = new THREE.MeshBasicMaterial({ color: 0x1e40af, transparent: true, opacity: 0.5 });
  for (let i = -56; i <= 56; i += 6) {
    const trait = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.12), marquageMat);
    trait.rotation.x = -Math.PI / 2;
    trait.position.set(i, 0.09, 0);
    scene.add(trait);
    const traitZ = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 2.6), marquageMat);
    traitZ.rotation.x = -Math.PI / 2;
    traitZ.position.set(0, 0.09, i);
    scene.add(traitZ);
  }

  // --- Immeubles ------------------------------------------------------------
  const rng = aleatoire(20261020);
  const batiments = new THREE.Group();
  const materiaux = [0x1b2c48, 0x203352, 0x16243c].map(
    (c) =>
      new THREE.MeshStandardMaterial({
        color: c,
        emissive: 0x0d1a2e,
        emissiveIntensity: 0.6,
        roughness: 0.7,
        metalness: 0.15,
      }),
  );
  const fenetresMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.7 });
  const areteMat = new THREE.LineBasicMaterial({ color: 0x2b4a72, transparent: true, opacity: 0.55 });

  for (let bx = -28; bx <= 28; bx += 7) {
    for (let bz = -28; bz <= 28; bz += 7) {
      if (Math.abs(bx) < 5 || Math.abs(bz) < 5) continue; // laisse les avenues libres

      // Dégage une place autour de chaque panneau pour qu'il reste visible.
      const surUnePlace = ANCRAGES.some(
        (a) => Math.hypot(bx - a.x, bz - a.z) < 6.5,
      );
      if (surUnePlace) continue;
      const nb = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < nb; i++) {
        const w = 2 + rng() * 3;
        const d = 2 + rng() * 3;
        const h = 2 + rng() * 12;
        const mat = materiaux[Math.floor(rng() * materiaux.length)];
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(
          bx + (rng() - 0.5) * 3.5,
          h / 2,
          bz + (rng() - 0.5) * 3.5,
        );
        batiments.add(b);

        const aretes = new THREE.LineSegments(new THREE.EdgesGeometry(b.geometry), areteMat);
        aretes.position.copy(b.position);
        batiments.add(aretes);

        // Bandeau de fenêtres lumineuses
        if (h > 4) {
          const vitre = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.72, 0.16, d * 0.72),
            fenetresMat,
          );
          vitre.position.set(b.position.x, h * 0.72, b.position.z);
          batiments.add(vitre);
        }
      }
    }
  }
  scene.add(batiments);

  // --- Panneaux publicitaires ----------------------------------------------
  const groupePanneaux = new THREE.Group();
  scene.add(groupePanneaux);

  type ElementPanneau = {
    id: string;
    groupe: THREE.Group;
    face: THREE.Mesh;
    anneau: THREE.Mesh;
    dispo?: string;
  };
  const elements = new Map<string, ElementPanneau>();
  const cliquables: THREE.Object3D[] = [];

  const couleurStatut = (dispo?: string) => new THREE.Color(couleur(dispo));

  const hexa = (valeur: number) => `#${valeur.toString(16).padStart(6, '0')}`;

  /** Habillage du panneau : référence, statut et ville, dessinés dans une texture. */
  function texturePanneau(panneau: Panneau): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 288;
    const ctx = canvas.getContext('2d')!;
    const teinte = hexa(couleur(panneau.disponibilite));

    ctx.fillStyle = '#0a1424';
    ctx.fillRect(0, 0, 512, 288);

    ctx.fillStyle = teinte;
    ctx.fillRect(0, 0, 512, 14);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 70px system-ui, sans-serif';
    ctx.fillText(panneau.reference.slice(0, 12), 32, 130);

    ctx.fillStyle = teinte;
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText((panneau.disponibilite ?? '').toUpperCase(), 32, 195);

    ctx.fillStyle = '#64748b';
    ctx.font = '28px system-ui, sans-serif';
    ctx.fillText((panneau.ville ?? '').slice(0, 22), 32, 245);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  panneaux.forEach((panneau, index) => {
    const ancre = ANCRAGES[index % ANCRAGES.length];
    const groupe = new THREE.Group();
    groupe.position.set(ancre.x, 0, ancre.z);
    groupe.rotation.y = ancre.rotation;

    const texture = texturePanneau(panneau);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texture,
      emissive: 0xffffff,
      emissiveMap: texture,
      emissiveIntensity: 0.85,
      roughness: 0.45,
      metalness: 0.1,
    });

    // mât
    const mat_ = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 2.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 }),
    );
    mat_.position.y = 1.3;
    groupe.add(mat_);

    // panneau
    const face = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.9, 0.16), mat);
    face.position.y = 3.4;
    groupe.add(face);
    clique(face, panneau.id);

    // cadre lumineux
    const cadre = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(3.55, 2.05, 0.22)),
      new THREE.LineBasicMaterial({ color: couleurStatut(panneau.disponibilite) }),
    );
    cadre.position.y = 3.4;
    groupe.add(cadre);

    // halo au sol
    const anneau = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.15, 32),
      new THREE.MeshBasicMaterial({
        color: couleurStatut(panneau.disponibilite),
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      }),
    );
    anneau.rotation.x = -Math.PI / 2;
    anneau.position.y = 0.06;
    groupe.add(anneau);

    const lumiere = new THREE.PointLight(couleurStatut(panneau.disponibilite), 14, 12, 2);
    lumiere.position.set(0, 3.4, 0.8);
    groupe.add(lumiere);

    groupePanneaux.add(groupe);
    elements.set(panneau.id, { id: panneau.id, groupe, face, anneau, dispo: panneau.disponibilite });
  });

  function clique(objet: THREE.Object3D, id: string) {
    objet.userData.panneauId = id;
    cliquables.push(objet);
  }

  // --- Particules (circulation) --------------------------------------------
  const nbParticules = 160;
  const positions = new Float32Array(nbParticules * 3);
  const vitesses = new Float32Array(nbParticules);
  for (let i = 0; i < nbParticules; i++) {
    const axe = rng() > 0.5;
    const t = (rng() - 0.5) * 110;
    positions[i * 3] = axe ? t : (rng() - 0.5) * 4;
    positions[i * 3 + 1] = 0.25;
    positions[i * 3 + 2] = axe ? (rng() - 0.5) * 4 : t;
    vitesses[i] = (0.15 + rng() * 0.45) * (rng() > 0.5 ? 1 : -1);
  }
  const geometrieParticules = new THREE.BufferGeometry();
  geometrieParticules.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particules = new THREE.Points(
    geometrieParticules,
    new THREE.PointsMaterial({
      color: 0xfbbf24,
      size: 0.22,
      transparent: true,
      opacity: 0.75,
      sizeAttenuation: true,
    }),
  );
  scene.add(particules);

  // --- Interactions ---------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointeur = new THREE.Vector2();
  let selection: string | null = null;
  let survol: string | null = null;
  let filtre: string | null = null;
  let rotationActive = options.rotation ?? true;
  let cadreAnimation = 0;
  let dernierTemps = performance.now();
  let depart = 0;

  function appliquerEtat(id: string) {
    const element = elements.get(id);
    if (!element) return;
    const estSelectionne = selection === id;
    const estSurvole = survol === id;
    const echelle = estSelectionne ? 1.18 : estSurvole ? 1.08 : 1;
    element.face.scale.setScalar(echelle);
    element.groupe.position.y = estSelectionne ? 0.25 : 0;
    const mat = element.face.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = estSelectionne ? 1.35 : estSurvole ? 1.05 : 0.85;
  }

  function positionPointeur(evenement: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointeur.x = ((evenement.clientX - rect.left) / rect.width) * 2 - 1;
    pointeur.y = -((evenement.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function idSousPointeur(): string | null {
    raycaster.setFromCamera(pointeur, camera);
    const intersections = raycaster.intersectObjects(cliquables, false);
    const premier = intersections.find((i) => {
      const id = i.object.userData.panneauId as string | undefined;
      if (!id) return false;
      const el = elements.get(id);
      return !filtre || el?.dispo === filtre;
    });
    return (premier?.object.userData.panneauId as string) ?? null;
  }

  let departSouris = { x: 0, y: 0 };
  const surBas = (e: PointerEvent) => {
    departSouris = { x: e.clientX, y: e.clientY };
  };
  const surHaut = (e: PointerEvent) => {
    const deplacement = Math.hypot(e.clientX - departSouris.x, e.clientY - departSouris.y);
    if (deplacement > 6) return; // c'était un glissement de caméra
    positionPointeur(e);
    const id = idSousPointeur();
    selection = id;
    elements.forEach((_, cle) => appliquerEtat(cle));
    options.onSelect?.(id);
  };
  const surDeplacement = (e: PointerEvent) => {
    positionPointeur(e);
    const id = idSousPointeur();
    if (id !== survol) {
      survol = id;
      renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
      elements.forEach((_, cle) => appliquerEtat(cle));
    }
  };

  renderer.domElement.addEventListener('pointerdown', surBas);
  renderer.domElement.addEventListener('pointerup', surHaut);
  renderer.domElement.addEventListener('pointermove', surDeplacement);
  renderer.domElement.style.cursor = 'grab';

  // --- Boucle ---------------------------------------------------------------
  const cibleCamera = new THREE.Vector3(0, 2, 0);

  function animer() {
    cadreAnimation = requestAnimationFrame(animer);
    const maintenant = performance.now();
    const dt = (maintenant - dernierTemps) / 1000;
    dernierTemps = maintenant;
    depart += dt;

    // Intro : la caméra s'approche doucement.
    if (depart < 1.8) {
      const t = Math.min(1, depart / 1.8);
      const ease = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(new THREE.Vector3(40, 34, 40), new THREE.Vector3(18, 15, 18), ease);
    } else if (rotationActive && !survol) {
      // Rotation lente autour du centre.
      const rayon = Math.hypot(camera.position.x, camera.position.z);
      const angle = Math.atan2(camera.position.z, camera.position.x) + dt * 0.045;
      camera.position.x = Math.cos(angle) * rayon;
      camera.position.z = Math.sin(angle) * rayon;
    }

    controles.target.lerp(cibleCamera, 0.08);
    controles.update();

    // Circulation
    const pos = geometrieParticules.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < nbParticules; i++) {
      const axeX = Math.abs(pos.getZ(i)) < 4;
      let v = pos.getX(i);
      let w = pos.getZ(i);
      if (axeX) v += vitesses[i] * dt * 6;
      else w += vitesses[i] * dt * 6;
      if (v > 58 || v < -58 || w > 58 || w < -58) {
        v = (Math.random() - 0.5) * 4;
        w = (Math.random() - 0.5) * 4;
      }
      pos.setX(i, v);
      pos.setZ(i, w);
    }
    pos.needsUpdate = true;

    // Pulsation des panneaux sélectionnés / survolés
    const pulsation = 0.5 + Math.sin(maintenant / 420) * 0.18;
    elements.forEach((el, id) => {
      const actif = id === selection || id === survol;
      el.anneau.scale.setScalar(actif ? 1.15 + Math.sin(maintenant / 300) * 0.06 : 1);
      if (id === selection) {
        (el.face.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.1 + pulsation * 0.35;
      }
    });

    renderer.render(scene, camera);
  }

  animer();

  // --- API ------------------------------------------------------------------
  function focus(id: string | null) {
    selection = id;
    elements.forEach((_, cle) => appliquerEtat(cle));
    const element = id ? elements.get(id) : null;
    if (element) {
      const position = element.groupe.position;
      controles.target.set(position.x, 2.6, position.z);
      cibleCamera.copy(controles.target);
      // Vue plongeante à 45° : la caméra passe au-dessus des immeubles.
      camera.position.set(position.x + 13, 19, position.z + 13);
      rotationActive = false;
    } else {
      controles.target.set(0, 2, 0);
      cibleCamera.set(0, 2, 0);
    }
  }

  function setRotation(actif: boolean) {
    rotationActive = actif;
  }

  function setFiltre(nouveau: string | null) {
    filtre = nouveau;
    elements.forEach((el, id) => {
      const visible = !filtre || el.dispo === filtre;
      el.groupe.visible = visible;
      const index = cliquables.findIndex((o) => o.userData.panneauId === id);
      if (visible && index === -1) cliquables.push(el.face);
      if (!visible && index !== -1) cliquables.splice(index, 1);
    });
    if (selection && filtre && elements.get(selection)?.dispo !== filtre) {
      selection = null;
      options.onSelect?.(null);
    }
  }

  function redimensionner() {
    camera.aspect = largeur() / hauteur();
    camera.updateProjectionMatrix();
    renderer.setSize(largeur(), hauteur());
  }

  const observateur = new ResizeObserver(() => redimensionner());
  observateur.observe(conteneur);

  function dispose() {
    cancelAnimationFrame(cadreAnimation);
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

  return { dispose, focus, setRotation, setFiltre, redimensionner };
}
