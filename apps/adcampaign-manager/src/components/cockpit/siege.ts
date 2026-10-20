// Maquette 3D du siège : aile administrative (direction, finances, RH,
// secrétariat) et aile atelier (opérations, imprimerie, soudure, décoration).
// Chaque espace est cliquable et affiche ses responsables et ses opérations.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type StatutSalle = 'active' | 'attente' | 'alerte' | 'libre';
export type TypeSalle = 'bureau' | 'imprimerie' | 'soudure' | 'decoration';

export type Salle = {
  id: string;
  nom: string;
  operations: number;
  responsables: number;
  statut: StatutSalle;
  type?: TypeSalle;
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
  nom: string;
  type: TypeSalle;
  x: number;
  z: number;
};

// Deux ailes : bureaux à gauche, atelier à droite, hall au centre.
const EMPLACEMENTS: EmplacementSalle[] = [
  { id: 'direction', nom: 'Direction générale', type: 'bureau', x: -13, z: -9.5 },
  { id: 'secretariat', nom: 'Secrétariat', type: 'bureau', x: -2, z: -9.5 },
  { id: 'finance', nom: 'Finances', type: 'bureau', x: -13, z: 0 },
  { id: 'rh', nom: 'Ressources humaines', type: 'bureau', x: -13, z: 9.5 },
  { id: 'operations', nom: 'Opérations', type: 'bureau', x: -2, z: 9.5 },
  { id: 'imprimerie', nom: 'Imprimerie', type: 'imprimerie', x: 13, z: -9.5 },
  { id: 'soudure', nom: 'Soudure', type: 'soudure', x: 13, z: 0 },
  { id: 'decoration', nom: 'Décoration', type: 'decoration', x: 13, z: 9.5 },
];

export const SALLES_SIEGE = EMPLACEMENTS.map((e) => e.id);

const LARGEUR = 9.6;
const PROFONDEUR = 7.8;

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
  scene.fog = new THREE.FogExp2(0x060d1a, 0.006);

  const camera = new THREE.PerspectiveCamera(40, largeur() / hauteur(), 0.1, 400);
  camera.position.set(34, 28, 38);

  const controles = new OrbitControls(camera, renderer.domElement);
  controles.enableDamping = true;
  controles.dampingFactor = 0.06;
  controles.enablePan = false;
  controles.minDistance = 22;
  controles.maxDistance = 100;
  controles.minPolarAngle = 0.4;
  controles.maxPolarAngle = 1.15;
  controles.target.set(0, 1.5, 0);

  // --- Lumières -------------------------------------------------------------
  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x0b1220, 1.2));

  const soleil = new THREE.DirectionalLight(0xffffff, 2.2);
  soleil.position.set(-16, 36, 20);
  scene.add(soleil);

  const contraste = new THREE.DirectionalLight(0x93c5fd, 0.9);
  contraste.position.set(26, 18, -22);
  scene.add(contraste);

  // --- Dalle ----------------------------------------------------------------
  const dalle = new THREE.Mesh(
    new THREE.BoxGeometry(52, 0.4, 42),
    new THREE.MeshStandardMaterial({ color: 0x0c1728, roughness: 0.95 }),
  );
  dalle.position.y = -0.2;
  scene.add(dalle);

  const trame = new THREE.GridHelper(52, 52, 0x1e3a5f, 0x14253d);
  (trame.material as THREE.Material).transparent = true;
  (trame.material as THREE.Material).opacity = 0.4;
  trame.position.y = 0.02;
  scene.add(trame);

  // --- Matériaux ------------------------------------------------------------
  const bois = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.9 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.35 });
  const sombre = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
  const papier = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.95,
    emissive: 0x94a3b8,
    emissiveIntensity: 0.15,
  });
  const verre = new THREE.MeshStandardMaterial({
    color: 0x93c5fd,
    transparent: true,
    opacity: 0.1,
    roughness: 0.2,
    side: THREE.DoubleSide,
  });
  const areteVerre = new THREE.LineBasicMaterial({
    color: 0x60a5fa,
    transparent: true,
    opacity: 0.4,
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

  function personnage(couleur: THREE.Color) {
    const groupe = new THREE.Group();
    const corps = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.27, 0.9, 10),
      new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.7 }),
    );
    corps.position.y = 0.68;
    groupe.add(corps);
    const tete = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xe2c4a8, roughness: 0.8 }),
    );
    tete.position.y = 1.33;
    groupe.add(tete);
    return groupe;
  }

  // --- Mobilier de bureau ---------------------------------------------------
  function posteBureau(groupe: THREE.Group, x: number, z: number, teinte: THREE.Color, id: string) {
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.13, 1.25), bois);
    table.position.set(x, 0.92, z);
    groupe.add(table);
    cliquable(table, id);

    for (const [dx, dz] of [[-1.15, -0.45], [1.15, -0.45], [-1.15, 0.45], [1.15, 0.45]]) {
      const pied = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.92, 0.07), metal);
      pied.position.set(x + dx, 0.46, z + dz);
      groupe.add(pied);
    }

    const ecran = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.5, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x1d4ed8 }),
    );
    ecran.position.set(x - 0.55, 1.26, z - 0.22);
    groupe.add(ecran);

    const chaise = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.7), sombre);
    chaise.position.set(x - 0.2, 0.52, z + 1);
    groupe.add(chaise);
    const dossier = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.09), sombre);
    dossier.position.set(x - 0.2, 0.9, z + 1.35);
    groupe.add(dossier);

    const personne = personnage(teinte);
    personne.position.set(x + 0.45, 0, z + 1.5);
    personne.rotation.y = Math.PI;
    groupe.add(personne);

    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.16, 0.28, 10),
      new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.9 }),
    );
    pot.position.set(x + 1.45, 0.14, z - 1.05);
    groupe.add(pot);
    const feuillage = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 }),
    );
    feuillage.position.set(x + 1.45, 0.5, z - 1.05);
    groupe.add(feuillage);
  }

  // --- Machines d'imprimerie ------------------------------------------------
  function imprimante(groupe: THREE.Group, x: number, z: number, id: string, teinte: THREE.Color) {
    const socle = new THREE.Mesh(new THREE.BoxGeometry(2, 0.85, 1.3), sombre);
    socle.position.set(x, 0.42, z);
    groupe.add(socle);
    cliquable(socle, id);

    const portique = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.16, 0.28), metal);
    portique.position.set(x, 1.15, z + 0.45);
    groupe.add(portique);

    const barre = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.15, 8), metal);
    barre.rotation.z = Math.PI / 2;
    barre.position.set(x, 1.15, z + 0.45);
    groupe.add(barre);

    const rouleau = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.7, 12), papier);
    rouleau.rotation.z = Math.PI / 2;
    rouleau.position.set(x, 0.8, z + 0.95);
    groupe.add(rouleau);

    const voyant = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 10),
      new THREE.MeshBasicMaterial({ color: teinte }),
    );
    voyant.position.set(x + 0.8, 0.95, z + 0.7);
    groupe.add(voyant);

    const lumiere = new THREE.PointLight(teinte, 4, 4, 2);
    lumiere.position.set(x, 1.2, z + 0.6);
    groupe.add(lumiere);
  }

  function tableDecoupe(groupe: THREE.Group, x: number, z: number, id: string) {
    const plateau = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 1.3), bois);
    plateau.position.set(x, 0.9, z);
    groupe.add(plateau);
    cliquable(plateau, id);

    for (const [dx, dz] of [[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]]) {
      const pied = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.9, 0.07), metal);
      pied.position.set(x + dx, 0.45, z + dz);
      groupe.add(pied);
    }

    const bras = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.14), metal);
    bras.position.set(x, 1.02, z - 0.4);
    groupe.add(bras);

    const lame = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.22, 6),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.2 }),
    );
    lame.position.set(x + 0.9, 1.1, z - 0.4);
    groupe.add(lame);
  }

  function machineCNC(groupe: THREE.Group, x: number, z: number, id: string) {
    const bati = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 1.6), sombre);
    bati.position.set(x, 0.1, z);
    groupe.add(bati);
    cliquable(bati, id);

    for (const dx of [-1.1, 1.1]) {
      const montant = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.9, 0.16), metal);
      montant.position.set(x + dx, 1.05, z);
      groupe.add(montant);
      cliquable(montant, id);
    }
    const traverse = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 0.16), metal);
    traverse.position.set(x, 2, z);
    groupe.add(traverse);

    const broche = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 10), metal);
    broche.position.set(x, 1.65, z);
    groupe.add(broche);

    const plateau = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 1.2), papier);
    plateau.position.set(x, 0.75, z);
    groupe.add(plateau);
    cliquable(plateau, id);

    const voyant = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x22c55e }),
    );
    voyant.position.set(x + 1.1, 1.5, z + 0.3);
    groupe.add(voyant);
  }

  // --- Postes d'atelier -----------------------------------------------------
  function posteSoudure(groupe: THREE.Group, x: number, z: number, id: string, teinte: THREE.Color) {
    const etabli = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 1.5), metal);
    etabli.position.set(x, 0.9, z);
    groupe.add(etabli);
    cliquable(etabli, id);

    for (const [dx, dz] of [[-1.25, -0.6], [1.25, -0.6], [-1.25, 0.6], [1.25, 0.6]]) {
      const pied = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), metal);
      pied.position.set(x + dx, 0.45, z + dz);
      groupe.add(pied);
    }

    const cadre = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), metal);
    cadre.position.set(x + 1.6, 1.4, z);
    groupe.add(cadre);
    const montant = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1), metal);
    montant.position.set(x + 2.35, 0.9, z);
    groupe.add(montant);
    cliquable(montant, id);

    const positions = new Float32Array(24 * 3);
    for (let i = 0; i < 24; i++) {
      positions[i * 3] = x - 0.6 + (Math.random() - 0.5) * 0.6;
      positions[i * 3 + 1] = 1.05 + Math.random() * 0.5;
      positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.4;
    }
    const geometrie = new THREE.BufferGeometry();
    geometrie.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const etincelles = new THREE.Points(
      geometrie,
      new THREE.PointsMaterial({ color: teinte, size: 0.07, transparent: true, opacity: 0.9 }),
    );
    groupe.add(etincelles);

    const personne = personnage(teinte);
    personne.position.set(x - 0.6, 0, z + 1.15);
    personne.rotation.y = Math.PI;
    groupe.add(personne);
  }

  function posteDecoration(groupe: THREE.Group, x: number, z: number, id: string, teinte: THREE.Color) {
    const table = new THREE.Mesh(new THREE.BoxGeometry(3, 0.13, 1.6), bois);
    table.position.set(x, 0.9, z);
    groupe.add(table);
    cliquable(table, id);

    for (const [dx, dz] of [[-1.3, -0.6], [1.3, -0.6], [-1.3, 0.6], [1.3, 0.6]]) {
      const pied = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.9, 0.07), metal);
      pied.position.set(x + dx, 0.45, z + dz);
      groupe.add(pied);
    }

    for (const [index, couleur] of [0xf97316, 0x38bdf8, 0x22c55e].entries()) {
      const rouleau = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 1.3, 12),
        new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.5 }),
      );
      rouleau.rotation.x = Math.PI / 2;
      rouleau.position.set(x - 1.1 + index * 0.6, 0.25, z + 1.1);
      groupe.add(rouleau);
    }

    const panneau = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1, 0.07),
      new THREE.MeshBasicMaterial({ color: teinte }),
    );
    panneau.position.set(x + 1.6, 1.5, z);
    panneau.rotation.z = 0.08;
    groupe.add(panneau);
    cliquable(panneau, id);

    const personne = personnage(teinte);
    personne.position.set(x - 0.2, 0, z + 1.3);
    personne.rotation.y = Math.PI;
    groupe.add(personne);
  }

  // --- Construction des salles ---------------------------------------------
  for (const emplacement of EMPLACEMENTS) {
    const salle = salleParId.get(emplacement.id);
    const groupe = new THREE.Group();
    groupe.position.set(emplacement.x, 0, emplacement.z);

    const teinte = couleurDe(emplacement.id);

    const dalleSalle = new THREE.Mesh(
      new THREE.BoxGeometry(LARGEUR, 0.14, PROFONDEUR),
      new THREE.MeshStandardMaterial({ color: teinte, transparent: true, opacity: 0.14, roughness: 0.9 }),
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

    switch (emplacement.type) {
      case 'imprimerie':
        // Trois imprimantes grand format, une découpe, une CNC.
        for (const [index, dx] of [-3, 0, 3].entries()) {
          imprimante(groupe, dx, -1.6, emplacement.id, teinte);
          if (index === 0) {
            const lumiere = new THREE.PointLight(teinte, 6, 8, 2);
            lumiere.position.set(0, 2, -1);
            groupe.add(lumiere);
          }
        }
        tableDecoupe(groupe, -2.4, 2.1, emplacement.id);
        machineCNC(groupe, 2.4, 2.1, emplacement.id);
        break;

      case 'soudure':
        posteSoudure(groupe, -1.6, 0, emplacement.id, teinte);
        posteSoudure(groupe, 2.5, 2.4, emplacement.id, teinte);
        break;

      case 'decoration':
        posteDecoration(groupe, -1.4, -0.6, emplacement.id, teinte);
        posteDecoration(groupe, 2.2, 2.4, emplacement.id, teinte);
        break;

      default:
        posteBureau(groupe, -2.2, -0.6, teinte, emplacement.id);
        posteBureau(groupe, 2.2, -0.6, teinte, emplacement.id);
        break;
    }

    const texture = textureEtiquette(
      emplacement.nom,
      salle?.operations ?? 0,
      salle?.responsables ?? 0,
      salle?.statut ?? 'libre',
    );
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
    );
    sprite.scale.set(5.8, 1.72, 1);
    sprite.position.set(0, 5.4, 0);
    groupe.add(sprite);
    etiquettes.push({ sprite, base: 5.4 });

    const matEtiquette = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 3.5, 6), metal);
    matEtiquette.position.set(0, 2.7, 0);
    groupe.add(matEtiquette);

    scene.add(groupe);
    groupes.set(emplacement.id, groupe);
  }

  // --- Hall central ---------------------------------------------------------
  const hall = new THREE.Group();
  const tapis = new THREE.Mesh(
    new THREE.CircleGeometry(4.4, 48),
    new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.9 }),
  );
  tapis.rotation.x = -Math.PI / 2;
  tapis.position.y = 0.03;
  hall.add(tapis);
  const anneau = new THREE.Mesh(
    new THREE.RingGeometry(4.3, 4.55, 48),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  );
  anneau.rotation.x = -Math.PI / 2;
  anneau.position.y = 0.05;
  hall.add(anneau);
  const comptoir = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 1), bois);
  comptoir.position.set(0, 0.55, 0.4);
  hall.add(comptoir);
  const logo = new THREE.Mesh(
    new THREE.CircleGeometry(1, 32),
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
    groupe.position.y = selection === id ? 0.3 : 0;
    groupe.scale.setScalar(selection === id ? 1.03 : 1);
    groupe.traverse((objet) => {
      const mesh = objet as THREE.Mesh;
      const materiau = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (materiau && materiau.transparent && materiau.opacity <= 0.2) {
        materiau.opacity = actif ? 0.26 : 0.1;
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
      camera.position.lerpVectors(new THREE.Vector3(48, 42, 52), new THREE.Vector3(34, 28, 38), ease);
    } else if (rotationActive && !survol) {
      const rayon = Math.hypot(camera.position.x, camera.position.z);
      const angle = Math.atan2(camera.position.z, camera.position.x) + dt * 0.025;
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
      camera.position.set(position.x + 23, 25, position.z + 23);
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
