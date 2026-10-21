// Génère les icônes PNG de l'application (aucune dépendance).
// Dessin : panneau publicitaire orange sur fond sombre, avec son pied.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return (buffer) => {
    let crc = 0xffffffff;
    for (const octet of buffer) crc = table[(crc ^ octet) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(data.length);
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(corps));
  return Buffer.concat([longueur, corps, crc]);
}

function png(largeur, hauteur, pixels) {
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(largeur, 0);
  entete.writeUInt32BE(hauteur, 4);
  entete[8] = 8; // bits par canal
  entete[9] = 6; // RGBA
  const lignes = [];
  for (let y = 0; y < hauteur; y++) {
    lignes.push(Buffer.from([0]));
    lignes.push(pixels.subarray(y * largeur * 4, (y + 1) * largeur * 4));
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', entete),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(lignes), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function melanger(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function dessiner(taille, { marge = 0 } = {}) {
  const px = Buffer.alloc(taille * taille * 4);
  const fond = [11, 18, 32];
  const orange = [249, 115, 22];
  const blanc = [255, 255, 255];

  const echelle = (taille * (1 - marge * 2)) / 1024;
  const decalage = taille * marge;

  const dansRect = (x, y, x0, y0, x1, y1, rayon) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = Math.min(Math.max(x, x0 + rayon), x1 - rayon);
    const cy = Math.min(Math.max(y, y0 + rayon), y1 - rayon);
    return (x - cx) ** 2 + (y - cy) ** 2 <= rayon ** 2;
  };

  const X = (v) => decalage + v * echelle;
  const Y = (v) => decalage + v * echelle;

  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      const i = (y * taille + x) * 4;
      let couleur = fond;

      // Panneau
      if (dansRect(x, y, X(232), Y(268), X(792), Y(560), 34 * echelle)) {
        couleur = orange;
      }
      // Bande blanche du panneau
      if (dansRect(x, y, X(286), Y(322), X(738), Y(370), 12 * echelle)) {
        couleur = blanc;
      }
      // Pied
      if (dansRect(x, y, X(492), Y(560), X(532), Y(742), 8 * echelle)) {
        couleur = orange;
      }
      // Base
      if (dansRect(x, y, X(410), Y(742), X(614), Y(778), 16 * echelle)) {
        couleur = orange;
      }

      px[i] = couleur[0];
      px[i + 1] = couleur[1];
      px[i + 2] = couleur[2];
      px[i + 3] = 255;
    }
  }
  return px;
}

const sortie = path.resolve('apps/adcampaign-manager/public');
fs.mkdirSync(sortie, { recursive: true });

for (const [nom, taille, marge] of [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 0.12],
  ['apple-touch-icon.png', 180, 0],
  ['icon-1024.png', 1024, 0],
]) {
  const fichier = path.join(sortie, nom);
  fs.writeFileSync(fichier, png(taille, taille, dessiner(taille, { marge })));
  console.log('écrit', path.relative(process.cwd(), fichier));
}

// Icône source pour Capacitor (1024)
fs.copyFileSync(path.join(sortie, 'icon-1024.png'), path.resolve('apps/adcampaign-manager/resources/icon.png'));
console.log('écrit apps/adcampaign-manager/resources/icon.png');
