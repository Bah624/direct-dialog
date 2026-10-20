// Maquette 3D de l'atelier : une salle isométrique avec les postes de travail
// (imprimantes, table de finition, séchage, stock, expédition, bureau).
// Chaque poste est cliquable et porte une étiquette avec le nombre d'opérations
// qui lui sont affectées.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type StatutZone = 'active' | 'attente' | 'alerte' | 'libre';

export type ZoneAtelier = {
  id: string;
  nom: string;
  operations: number;
  statut: StatutZone;
};

export type AtelierHandle = {
  dispose: () => void;
  focus: (id: string | null) => void;
  setRotation: (actif: boolean) => void;
  redimensionner: () => void;
};

const COULEURS: Record<StatutZone, number> = {
  active: 0xf97316,
  attente: 0xfacc15,
  alerte: 0xef4444,
  libre: 0x38bdf8,
};

type Poste = {
  id: string;
  nom: string;
  x: number;
  z: number;
  largeur: number;
  profondeur: number;
};

export const ZONES_ATELIER: { id: string; nom: string }[] = [];

const POSTES: Poste[] = [
  { id: 'impression', nom: 'Impression', x: -7.5, z: -4, largeur: 6, profondeur: 5 },
  { id: 'finition', nom: 'Découpe & finition', x: -1, z: -4.5, largeur: 5.5, profondeur: 4.5 },
  { id: 'sechage', nom: 'Séchage', x: 5, z: -4.5, largeur: 5, profondeur: 4.5 },
  { id: 'stock', nom: 'Stock atelier', x: 7.5, z: 2, largeur: 5, profondeur: 5 },
  { id: 'expedition', nom: 'Expédition / pose', x: 0, z: 3.5, largeur: 7, profondeur: 4.5 },
  { id: 'bureau', nom: 'Bureau chef d’atelier', x: -7.5, z: 3.5, largeur: 5, profondeur: 4.5 },
];

function textureEtiquette(nom: string, operations: number, statut: StatutZone): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  const teinte = `#${COULEURS[statut].toString(16).padStart(6, '0')}`;

  ctx.fillStyle = 'rgba(8, 16, 30, 0.92)';
  ctx.beginPath();
  ctx.roundRect(0, 0, 640, 160, 28);
  ctx.fill();
  ctx.strokeStyle = teinte;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = teinte;
  ctx.beginPath();
  ctx.roundRect(24, 24, 8, 112, 4);
  ctx.fill();

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 42px system-ui, sans-serif';
  ctx.fillText(nom.slice(0, 22), 52, 78);

  ctx.fillStyle = statut === 'libre' ? '#64748b' : teinte;
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(
    operations === 0 ? 'aucune opération' : `${operations} opération${operations > 1 ? 's' : ''}`,
    52,
    124,
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

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
  scene.fog = new THREE.FogExp2(0x060d1a, 0.012);

  const camera = new THREE.PerspectiveCamera(40, largeur() / hauteur(), 0.1, 300);
  camera.position.set(18, 16, 20);

  const controles = new OrbitControls(camera, renderer.domElement);
  controles.enableDamping = true;
  controles.dampingFactor = 0.07;
  controles.enablePan = false;
  controles.minDistance = 16;
  controles.maxDistance = 60;
  controles.minPolarAngle = 0.45;
  controles.maxPolarAngle = 1.2;
  controles.target.set(0, 1.5, 0);

  // --- Lumières -------------------------------------------------------------
  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x0b1220, 1.05));

  const plafonnier = new THREE.DirectionalLight(0xffffff, 2.2);
  plafonnier.position.set(-6, 26, 8);
  scene.add(plafonnier);

  const appoint = new THREE.DirectionalLight(0x93c5fd, 0.8);
  appoint.position.set(18, 12, -10);
  scene.add(appoint);

  // --- Sol et murs ----------------------------------------------------------
  const sol = new THREE.Mesh(
    new THREE.BoxGeometry(30, 0.3, 22),
    new THREE.MeshStandardMaterial({ color: 0x111e33, roughness: 0.95 }),
  );
  sol.position.y = -0.15;
  scene.add(sol);

  // Trame du sol
  const trame = new THREE.GridHelper(30, 30, 0x1e3a5f, 0x152a45);
  (trame.material as THREE.Material).transparent = true;
  (trame.material as THREE.Material).opacity = 0.35;
  trame.position.y = 0.01;
  scene.add(trame);

  const murMat = new THREE.MeshStandardMaterial({
    color: 0x16243c,
    roughness: 0.85,
    emissive: 0x0a1424,
    emissiveIntensity: 0.7,
  });
  const murFond = new THREE.Mesh(new THREE.BoxGeometry(30, 7, 0.4), murMat);
  murFond.position.set(0, 3.5, -11);
  scene.add(murFond);
  const murGauche = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 22), murMat);
  murGauche.position.set(-15, 3.5, 0);
  scene.add(murGauche);

  // Bandeau lumineux en haut des murs
  const neonMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 });
  const neonFond = new THREE.Mesh(new THREE.BoxGeometry(29, 0.12, 0.12), neonMat);
  neonFond.position.set(0, 6.4, -10.7);
  scene.add(neonFond);
  const neonGauche = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 21), neonMat);
  neonGauche.position.set(-14.7, 6.4, 0);
  scene.add(neonGauche);

  // --- Matériaux ------------------------------------------------------------
  const metal = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.35 });
  const sombre = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.3, roughness: 0.7 });
  const plastique = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
  const bois = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.9 });
  const papier = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.95,
    emissive: 0x94a3b8,
    emissiveIntensity: 0.12,
  });

  const zoneParId = new Map(zones.map((z) => [z.id, z]));
  const groupes = new Map<string, THREE.Group>();
  const cliquables: THREE.Object3D[] = [];
  const etiquettes: { sprite: THREE.Sprite; base: number }[] = [];

  const statutDe = (id: string): StatutZone => zoneParId.get(id)?.statut ?? 'libre';
  const couleurDe = (id: string) => new THREE.Color(COULEURS[statutDe(id)]);

  function ajouterCliquable(objet: THREE.Object3D, id: string) {
    objet.userData.zoneId = id;
    cliquables.push(objet);
  }

  function creerPoste(poste: Poste) {
    const groupe = new THREE.Group();
    groupe.position.set(poste.x, 0, poste.z);
    const teinte = couleurDe(poste.id);

    // Zone au sol
    const zone = new THREE.Mesh(
      new THREE.PlaneGeometry(poste.largeur, poste.profondeur),
      new THREE.MeshBasicMaterial({
        color: teinte,
        transparent: true,
        opacity: 0.09,
        side: THREE.DoubleSide,
      }),
    );
    zone.rotation.x = -Math.PI / 2;
    zone.position.y = 0.02;
    groupe.add(zone);

    const bordure = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(poste.largeur, poste.profondeur)),
      new THREE.LineBasicMaterial({ color: teinte, transparent: true, opacity: 0.55 }),
    );
    bordure.rotation.x = -Math.PI / 2;
    bordure.position.y = 0.03;
    groupe.add(bordure);

    // Étiquette flottante
    const texture = textureEtiquette(
      poste.nom,
      zoneParId.get(poste.id)?.operations ?? 0,
      statutDe(poste.id),
    );
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
    );
    sprite.scale.set(4.3, 1.07, 1);
    sprite.position.set(0, 4.2, 0);
    groupe.add(sprite);
    etiquettes.push({ sprite, base: 4.2 });

    // Mât de l'étiquette
    const mat = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3, 6), metal);
    mat.position.set(0, 2.2, 0);
    groupe.add(mat);

    scene.add(groupe);
    groupes.set(poste.id, groupe);
    return groupe;
  }

  // --- Mobilier par poste ---------------------------------------------------
  function construireImpression(groupe: THREE.Group) {
    for (const [index, decalage] of [-2.2, 2.2].entries()) {
      const imprimante = new THREE.Group();
      imprimante.position.set(decalage, 0, -0.3);

      const socle = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 1.9), sombre);
      socle.position.y = 0.55;
      imprimante.add(socle);
      ajouterCliquable(socle, 'impression');

      const portique = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, 0.35), metal);
      portique.position.set(0, 1.55, 0.6);
      imprimante.add(portique);

      const barre = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 8), metal);
      barre.rotation.z = Math.PI / 2;
      barre.position.set(0, 1.55, 0.6);
      imprimante.add(barre);

      const rouleau = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.9, 14), papier);
      rouleau.rotation.z = Math.PI / 2;
      rouleau.position.set(0, 1.05, 1.35);
      imprimante.add(rouleau);

      const ecran = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.06), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
      ecran.position.set(-1.1, 1.35, 0.95);
      imprimante.add(ecran);

      // Voyant d'état
      const voyant = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 12, 12),
        new THREE.MeshBasicMaterial({ color: couleurDe('impression') }),
      );
      voyant.position.set(1.35, 1.25, 0.95);
      imprimante.add(voyant);

      if (index === 0) {
        const lumiere = new THREE.PointLight(couleurDe('impression'), 8, 8, 2);
        lumiere.position.set(0, 1.8, 0);
        imprimante.add(lumiere);
      }

      groupe.add(imprimante);
    }
  }

  function construireFinition(groupe: THREE.Group) {
    const plateau = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.16, 2.2), bois);
    plateau.position.y = 1;
    groupe.add(plateau);
    ajouterCliquable(plateau, 'finition');

    for (const [x, z] of [[-2.1, -0.9], [2.1, -0.9], [-2.1, 0.9], [2.1, 0.9]]) {
      const pied = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12), metal);
      pied.position.set(x, 0.5, z);
      groupe.add(pied);
    }

    // Règle de coupe
    const regle = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.08, 0.16), metal);
    regle.position.set(0, 1.1, -0.8);
    groupe.add(regle);

    // Rouleaux de vinyle
    for (const [index, couleur] of [0xf97316, 0x38bdf8, 0x22c55e].entries()) {
      const rouleau = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.26, 1.6, 14),
        new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.5 }),
      );
      rouleau.rotation.x = Math.PI / 2;
      rouleau.position.set(-1.5 + index * 0.7, 0.3, 1.1);
      groupe.add(rouleau);
    }

    // Feuille en cours de découpe
    const feuille = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.1), papier);
    feuille.rotation.x = -Math.PI / 2;
    feuille.position.set(0.8, 1.09, 0.1);
    groupe.add(feuille);
  }

  function construireSechage(groupe: THREE.Group) {
    const structure = new THREE.Group();
    structure.position.set(0, 0, 0);
    for (const x of [-1.8, 1.8]) {
      const montant = new THREE.Mesh(new THREE.BoxGeometry(0.14, 3.4, 0.14), metal);
      montant.position.set(x, 1.7, 0);
      structure.add(montant);
      ajouterCliquable(montant, 'sechage');
    }
    for (let etage = 0; etage < 3; etage++) {
      const barre = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.1, 0.1), metal);
      barre.position.set(0, 0.9 + etage * 1.05, 0);
      structure.add(barre);

      const panneau = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.85), papier);
      panneau.position.set(0, 0.45 + etage * 1.05, 0.02);
      structure.add(panneau);
      ajouterCliquable(panneau, 'sechage');
    }
    groupe.add(structure);
  }

  function construireStock(groupe: THREE.Group) {
    const etagere = new THREE.Group();
    for (const x of [-2, 2]) {
      const montant = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4, 0.16), metal);
      montant.position.set(x, 2, 0);
      etagere.add(montant);
      ajouterCliquable(montant, 'stock');
    }
    for (let niveau = 0; niveau < 3; niveau++) {
      const tablette = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 1.6), bois);
      tablette.position.set(0, 0.7 + niveau * 1.25, 0);
      etagere.add(tablette);
      ajouterCliquable(tablette, 'stock');

      for (let i = 0; i < 3; i++) {
        const carton = new THREE.Mesh(
          new THREE.BoxGeometry(0.8, 0.7, 0.9),
          new THREE.MeshStandardMaterial({ color: 0x3f2f20, roughness: 0.95 }),
        );
        carton.position.set(-1.2 + i * 1.2, 1.1 + niveau * 1.25, 0);
        etagere.add(carton);
      }
    }
    groupe.add(etagere);
  }

  function construireExpedition(groupe: THREE.Group) {
    const palette = new THREE.Mesh(new THREE.BoxGeometry(3, 0.22, 2), bois);
    palette.position.set(-1, 0.11, 0);
    groupe.add(palette);
    ajouterCliquable(palette, 'expedition');

    for (let i = 0; i < 3; i++) {
      const panneau = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.08), papier);
      panneau.position.set(-1.9 + i * 0.9, 0.9, 0.2);
      panneau.rotation.z = 0.12 * (i - 1);
      groupe.add(panneau);
      ajouterCliquable(panneau, 'expedition');
    }

    const diable = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 0.1), metal);
    diable.position.set(1.6, 0.9, 0);
    diable.rotation.z = -0.12;
    groupe.add(diable);
  }

  function construireBureau(groupe: THREE.Group) {
    const plateau = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 1.7), bois);
    plateau.position.y = 0.95;
    groupe.add(plateau);
    ajouterCliquable(plateau, 'bureau');

    for (const [x, z] of [[-1.5, -0.7], [1.5, -0.7], [-1.5, 0.7], [1.5, 0.7]]) {
      const pied = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.95, 0.1), metal);
      pied.position.set(x, 0.47, z);
      groupe.add(pied);
    }

    for (const x of [-0.8, 0.2]) {
      const ecran = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.65, 0.05),
        new THREE.MeshBasicMaterial({ color: 0x1e40af }),
      );
      ecran.position.set(x, 1.45, -0.35);
      groupe.add(ecran);
      const piedEcran = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), metal);
      piedEcran.position.set(x, 1.12, -0.35);
      groupe.add(piedEcran);
    }

    const chaise = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.9), plastique);
    chaise.position.set(0, 0.55, 1.2);
    groupe.add(chaise);
    const dossier = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.12), plastique);
    dossier.position.set(0, 1, 1.65);
    groupe.add(dossier);
  }

  const constructeurs: Record<string, (groupe: THREE.Group) => void> = {
    impression: construireImpression,
    finition: construireFinition,
    sechage: construireSechage,
    stock: construireStock,
    expedition: construireExpedition,
    bureau: construireBureau,
  };

  for (const poste of POSTES) {
    const groupe = creerPoste(poste);
    constructeurs[poste.id]?.(groupe);
  }

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
    groupe.scale.setScalar(selection === id ? 1.04 : 1);
    groupe.position.y = selection === id ? 0.12 : 0;
    groupe.traverse((objet) => {
      const mesh = objet as THREE.Mesh;
      const materiau = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (materiau && 'emissive' in materiau) {
        materiau.emissiveIntensity = actif ? 1.2 : 0;
      }
    });
    groupe.visible = true;
  }

  function positionPointeur(e: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointeur.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointeur.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function zoneSousPointeur(): string | null {
    raycaster.setFromCamera(pointeur, camera);
    const hit = raycaster.intersectObjects(cliquables, false)[0];
    return (hit?.object.userData.zoneId as string) ?? null;
  }

  const surBas = (e: PointerEvent) => {
    departSouris = { x: e.clientX, y: e.clientY };
  };
  const surHaut = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - departSouris.x, e.clientY - departSouris.y) > 6) return;
    positionPointeur(e);
    const id = zoneSousPointeur();
    selection = id;
    groupes.forEach((_, cle) => appliquerEtat(cle));
    options.onSelect?.(id);
  };
  const surDeplacement = (e: PointerEvent) => {
    positionPointeur(e);
    const id = zoneSousPointeur();
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

    if (depart < 1.6) {
      const t = Math.min(1, depart / 1.6);
      const ease = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(new THREE.Vector3(30, 26, 32), new THREE.Vector3(18, 16, 20), ease);
    } else if (rotationActive && !survol) {
      const rayon = Math.hypot(camera.position.x, camera.position.z);
      const angle = Math.atan2(camera.position.z, camera.position.x) + dt * 0.035;
      camera.position.x = Math.cos(angle) * rayon;
      camera.position.z = Math.sin(angle) * rayon;
    }

    controles.target.lerp(cible, 0.08);
    controles.update();

    // Les étiquettes flottent doucement
    etiquettes.forEach(({ sprite, base }, index) => {
      sprite.position.y = base + Math.sin(maintenant / 900 + index) * 0.08;
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
      controles.target.set(position.x, 2.2, position.z);
      cible.copy(controles.target);
      camera.position.set(position.x + 17, 19, position.z + 17);
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

// Liste des postes, utilisée par l'interface pour dresser la liste latérale.
ZONES_ATELIER.push(...POSTES.map((poste) => ({ id: poste.id, nom: poste.nom })));
