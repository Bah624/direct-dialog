// Pôles de l'atelier : opérations, imprimerie, soudure, décoration.
// Ce module est partagé par la vue « Siège » (l'atelier y est un seul grand
// espace) et par la vue « Atelier » (le même espace, vu de plus près).

import * as THREE from 'three';

export type PoleId = 'operations' | 'imprimerie' | 'soudure' | 'decoration';
export type StatutPole = 'active' | 'attente' | 'alerte' | 'libre';

export type PoleInfo = {
  id: PoleId;
  nom: string;
  operations: number;
  responsables: number;
  statut: StatutPole;
};

export type ContextePole = {
  cliquable: (objet: THREE.Object3D, id: string) => void;
  etiquettes: { sprite: THREE.Sprite; base: number }[];
  animer?: (sprite: THREE.Sprite) => void;
};

export const COULEURS_POLE: Record<StatutPole, number> = {
  active: 0xf97316,
  attente: 0xfacc15,
  alerte: 0xef4444,
  libre: 0x38bdf8,
};

export const NOMS_POLES: Record<PoleId, string> = {
  operations: 'Opérations',
  imprimerie: 'Imprimerie',
  soudure: 'Soudure',
  decoration: 'Décoration',
};

/** Position des pôles dans le grand espace atelier (repère local). */
export const DISPOSITION_POLES: Record<PoleId, { x: number; z: number }> = {
  imprimerie: { x: -4.5, z: -6 },
  operations: { x: 3.5, z: 0.5 },
  soudure: { x: -5.5, z: 7 },
  decoration: { x: 6, z: 7 },
};

export const LARGEUR_ATELIER = 20;
export const PROFONDEUR_ATELIER = 22;

const metal = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.35 });
const sombre = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
const bois = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.9 });
const papier = new THREE.MeshStandardMaterial({
  color: 0xe2e8f0,
  roughness: 0.95,
  emissive: 0x94a3b8,
  emissiveIntensity: 0.15,
});

function textureEtiquette(nom: string, operations: number, statut: StatutPole): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 560;
  canvas.height = 150;
  const ctx = canvas.getContext('2d')!;
  const teinte = `#${COULEURS_POLE[statut].toString(16).padStart(6, '0')}`;

  ctx.fillStyle = 'rgba(8, 16, 30, 0.93)';
  ctx.beginPath();
  ctx.roundRect(0, 0, 560, 150, 22);
  ctx.fill();
  ctx.strokeStyle = teinte;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = teinte;
  ctx.beginPath();
  ctx.roundRect(18, 20, 7, 110, 4);
  ctx.fill();

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.fillText(nom.slice(0, 20), 42, 62);

  ctx.fillStyle = operations > 0 ? teinte : '#64748b';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillText(
    operations === 0 ? 'aucune opération' : `${operations} opération${operations > 1 ? 's' : ''}`,
    42,
    112,
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
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

function bureau(groupe: THREE.Group, x: number, z: number, id: string, teinte: THREE.Color, ctx: ContextePole) {
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.13, 1.25), bois);
  table.position.set(x, 0.92, z);
  groupe.add(table);
  ctx.cliquable(table, id);

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

  const personne = personnage(teinte);
  personne.position.set(x + 0.45, 0, z + 1.5);
  personne.rotation.y = Math.PI;
  groupe.add(personne);
}

function imprimante(groupe: THREE.Group, x: number, z: number, id: string, teinte: THREE.Color, ctx: ContextePole) {
  const socle = new THREE.Mesh(new THREE.BoxGeometry(2, 0.85, 1.3), sombre);
  socle.position.set(x, 0.42, z);
  groupe.add(socle);
  ctx.cliquable(socle, id);

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
}

function decoupe(groupe: THREE.Group, x: number, z: number, id: string, ctx: ContextePole) {
  const plateau = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 1.3), bois);
  plateau.position.set(x, 0.9, z);
  groupe.add(plateau);
  ctx.cliquable(plateau, id);

  for (const [dx, dz] of [[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]]) {
    const pied = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.9, 0.07), metal);
    pied.position.set(x + dx, 0.45, z + dz);
    groupe.add(pied);
  }

  const bras = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.14), metal);
  bras.position.set(x, 1.02, z - 0.4);
  groupe.add(bras);
}

function cnc(groupe: THREE.Group, x: number, z: number, id: string, ctx: ContextePole) {
  const bati = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 1.5), sombre);
  bati.position.set(x, 0.1, z);
  groupe.add(bati);
  ctx.cliquable(bati, id);

  for (const dx of [-1, 1]) {
    const montant = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.9, 0.15), metal);
    montant.position.set(x + dx, 1.05, z);
    groupe.add(montant);
  }
  const traverse = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 0.15), metal);
  traverse.position.set(x, 2, z);
  groupe.add(traverse);

  const broche = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 10), metal);
  broche.position.set(x, 1.65, z);
  groupe.add(broche);

  const plateau = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 1.1), papier);
  plateau.position.set(x, 0.75, z);
  groupe.add(plateau);
  ctx.cliquable(plateau, id);
}

function soudure(groupe: THREE.Group, x: number, z: number, id: string, teinte: THREE.Color, ctx: ContextePole) {
  const etabli = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 1.5), metal);
  etabli.position.set(x, 0.9, z);
  groupe.add(etabli);
  ctx.cliquable(etabli, id);

  for (const [dx, dz] of [[-1.25, -0.6], [1.25, -0.6], [-1.25, 0.6], [1.25, 0.6]]) {
    const pied = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), metal);
    pied.position.set(x + dx, 0.45, z + dz);
    groupe.add(pied);
  }

  const cadre = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), metal);
  cadre.position.set(x + 1.5, 1.4, z);
  groupe.add(cadre);
  const montant = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1), metal);
  montant.position.set(x + 2.2, 0.9, z);
  groupe.add(montant);
  ctx.cliquable(montant, id);

  const positions = new Float32Array(20 * 3);
  for (let i = 0; i < 20; i++) {
    positions[i * 3] = x - 0.5 + (Math.random() - 0.5) * 0.6;
    positions[i * 3 + 1] = 1.05 + Math.random() * 0.45;
    positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.4;
  }
  const geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  groupe.add(
    new THREE.Points(
      geometrie,
      new THREE.PointsMaterial({ color: teinte, size: 0.07, transparent: true, opacity: 0.9 }),
    ),
  );

  const personne = personnage(teinte);
  personne.position.set(x - 0.6, 0, z + 1.15);
  personne.rotation.y = Math.PI;
  groupe.add(personne);
}

function decoration(groupe: THREE.Group, x: number, z: number, id: string, teinte: THREE.Color, ctx: ContextePole) {
  const table = new THREE.Mesh(new THREE.BoxGeometry(3, 0.13, 1.6), bois);
  table.position.set(x, 0.9, z);
  groupe.add(table);
  ctx.cliquable(table, id);

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
  ctx.cliquable(panneau, id);

  const personne = personnage(teinte);
  personne.position.set(x - 0.2, 0, z + 1.3);
  personne.rotation.y = Math.PI;
  groupe.add(personne);
}

/** Construit les quatre pôles de l'atelier dans un groupe (repère local). */
export function construireAtelier(
  groupe: THREE.Group,
  poles: PoleInfo[],
  ctx: ContextePole,
) {
  for (const pole of poles) {
    const emplacement = DISPOSITION_POLES[pole.id];
    if (!emplacement) continue;
    const sousGroupe = new THREE.Group();
    sousGroupe.position.set(emplacement.x, 0, emplacement.z);
    const teinte = new THREE.Color(COULEURS_POLE[pole.statut]);

    // Dalle du pôle
    const dalle = new THREE.Mesh(
      new THREE.PlaneGeometry(8.4, 6.6),
      new THREE.MeshBasicMaterial({
        color: teinte,
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide,
      }),
    );
    dalle.rotation.x = -Math.PI / 2;
    dalle.position.y = 0.03;
    sousGroupe.add(dalle);

    switch (pole.id) {
      case 'imprimerie':
        for (const dx of [-4.4, 0, 4.4]) {
          imprimante(sousGroupe, dx, 0, pole.id, teinte, ctx);
        }
        decoupe(sousGroupe, -2.6, 3.4, pole.id, ctx);
        cnc(sousGroupe, 2.6, 3.4, pole.id, ctx);
        break;
      case 'operations':
        bureau(sousGroupe, -2.2, 0, pole.id, teinte, ctx);
        bureau(sousGroupe, 2.2, 0, pole.id, teinte, ctx);
        break;
      case 'soudure':
        soudure(sousGroupe, 0, 0, pole.id, teinte, ctx);
        soudure(sousGroupe, 4.4, 2.6, pole.id, teinte, ctx);
        break;
      case 'decoration':
        decoration(sousGroupe, 0, 0, pole.id, teinte, ctx);
        decoration(sousGroupe, -4.4, 2.6, pole.id, teinte, ctx);
        break;
    }

    // Étiquette du pôle
    const texture = textureEtiquette(pole.nom, pole.operations, pole.statut);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
    );
    sprite.scale.set(4.6, 1.23, 1);
    sprite.position.set(0, 3.6, 0);
    sousGroupe.add(sprite);
    ctx.etiquettes.push({ sprite, base: 3.6 });

    groupe.add(sousGroupe);
  }
}

/** Dalle et cloisons d'un espace atelier (20 × 22). */
export function creerSalleAtelier(groupe: THREE.Group, teinte: THREE.Color) {
  const dalle = new THREE.Mesh(
    new THREE.BoxGeometry(LARGEUR_ATELIER, 0.14, PROFONDEUR_ATELIER),
    new THREE.MeshStandardMaterial({ color: teinte, transparent: true, opacity: 0.1, roughness: 0.9 }),
  );
  dalle.position.y = 0.07;
  groupe.add(dalle);

  const bordure = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(LARGEUR_ATELIER, 0.02, PROFONDEUR_ATELIER)),
    new THREE.LineBasicMaterial({ color: teinte, transparent: true, opacity: 0.55 }),
  );
  bordure.position.y = 0.15;
  groupe.add(bordure);

  return dalle;
}
