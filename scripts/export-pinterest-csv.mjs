/**
 * Exporte une épingle par recette dans un fichier CSV, pour la création d'épingles en masse
 * sur Pinterest (Créer > Créer des épingles en masse) ou dans un outil de programmation.
 *
 *   npm run export:pinterest              tableau = région de la recette, sinon son type
 *   npm run export:pinterest -- --par-type   tableau = type de plat pour toutes les recettes
 *
 * Fichier produit : docs/pinterest-epingles.csv (docs/ est ignoré par git).
 * Les tableaux doivent exister sur le compte Pinterest, avec exactement le même nom
 * (la liste est affichée à la fin). 200 lignes au plus par fichier côté Pinterest.
 *
 * Identifiants : variable FIREBASE_SERVICE_ACCOUNT_KEY (JSON) ou src/firebase/serviceAccountKey.json.
 */
import fs from 'fs';
import path from 'path';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const SITE_URL = 'https://www.cuisine-artisanale.fr';

// Même découpage que src/constants/regions.ts
const REGIONS = [
  { nom: 'Auvergne-Rhône-Alpes', de: "d'Auvergne-Rhône-Alpes", departements: ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'] },
  { nom: 'Bourgogne-Franche-Comté', de: 'de Bourgogne-Franche-Comté', departements: ['21', '25', '39', '58', '70', '71', '89', '90'] },
  { nom: 'Bretagne', de: 'de Bretagne', departements: ['22', '29', '35', '56'] },
  { nom: 'Centre-Val de Loire', de: 'du Centre-Val de Loire', departements: ['18', '28', '36', '37', '41', '45'] },
  { nom: 'Corse', de: 'de Corse', departements: ['2A', '2B'] },
  { nom: 'Grand Est', de: 'du Grand Est', departements: ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'] },
  { nom: 'Hauts-de-France', de: 'des Hauts-de-France', departements: ['02', '59', '60', '62', '80'] },
  { nom: 'Île-de-France', de: "d'Île-de-France", departements: ['75', '77', '78', '91', '92', '93', '94', '95'] },
  { nom: 'Normandie', de: 'de Normandie', departements: ['14', '27', '50', '61', '76'] },
  { nom: 'Nouvelle-Aquitaine', de: 'de Nouvelle-Aquitaine', departements: ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'] },
  { nom: 'Occitanie', de: "d'Occitanie", departements: ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'] },
  { nom: 'Pays de la Loire', de: 'des Pays de la Loire', departements: ['44', '49', '53', '72', '85'] },
  { nom: "Provence-Alpes-Côte d'Azur", de: "de Provence-Alpes-Côte d'Azur", departements: ['04', '05', '06', '13', '83', '84'] },
  { nom: 'Outre-mer', de: "d'Outre-mer", departements: ['971', '972', '973', '974', '976'] },
];

const TYPE_BOARDS = { 'Entrée': 'Entrées', 'Plat': 'Plats', 'Dessert': 'Desserts', 'Boisson': 'Boissons' };

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  }
  const file = path.join(process.cwd(), 'src', 'firebase', 'serviceAccountKey.json');
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  throw new Error('Aucun identifiant Firebase Admin (FIREBASE_SERVICE_ACCOUNT_KEY ou src/firebase/serviceAccountKey.json)');
}

/** Image verticale de la recette : même URL que le bouton « Épingler » (src/lib/services/share.service.ts). */
function pinImageUrl(recipe) {
  const params = new URLSearchParams({ format: 'pin', title: recipe.title, type: recipe.type || 'Recette' });
  const photo = (Array.isArray(recipe.images) ? recipe.images : []).find(
    (image) => typeof image === 'string' && image.startsWith('https://firebasestorage.googleapis.com/'),
  );
  if (photo) params.set('image', photo);
  return `${SITE_URL}/api/og-image?${params.toString()}`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const byType = process.argv.includes('--par-type');

const serviceAccount = loadServiceAccount();
initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });

const snapshot = await getFirestore().collection('recipes').orderBy('title').get();

const rows = [['Title', 'Media URL', 'Pinterest board', 'Description', 'Link', 'Keywords']];
const boards = new Map();

for (const doc of snapshot.docs) {
  const recipe = doc.data();
  if (!recipe.title) continue;

  const region = REGIONS.find((r) => r.departements.includes(recipe.position));
  const typeBoard = TYPE_BOARDS[recipe.type] || 'Recettes';
  const board = !byType && region ? `Recettes ${region.de}` : typeBoard;
  boards.set(board, (boards.get(board) || 0) + 1);

  const minutes = (Number(recipe.preparationTime) || 0) + (Number(recipe.cookingTime) || 0);
  const description = [
    `${recipe.title} : la recette traditionnelle pas à pas`,
    region ? `, une spécialité ${region.de}` : '',
    minutes ? `. Prête en ${minutes} min` : '',
    '. Ingrédients, étapes et liste de courses sur Cuisine Artisanale.',
  ].join('');

  rows.push([
    recipe.title.slice(0, 100),
    pinImageUrl(recipe),
    board,
    description.slice(0, 500),
    // Paramètres UTM : les visites venues des épingles sont attribuées à Pinterest (page admin Trafic)
    `${SITE_URL}/recettes/${encodeURIComponent(recipe.url || doc.id)}?utm_source=pinterest&utm_medium=pin`,
    ['recette', recipe.type, region?.nom, 'cuisine française', 'fait maison'].filter(Boolean).join(', '),
  ]);
}

const output = path.join(process.cwd(), 'docs', 'pinterest-epingles.csv');
fs.mkdirSync(path.dirname(output), { recursive: true });
// BOM : Excel ouvre le fichier en UTF-8 (accents)
fs.writeFileSync(output, `﻿${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`, 'utf8');

console.log(`${rows.length - 1} épingle(s) écrite(s) dans ${path.relative(process.cwd(), output)}`);
console.log('Tableaux à créer sur Pinterest (même nom, à la lettre près) :');
for (const [board, count] of [...boards].sort((a, b) => a[0].localeCompare(b[0], 'fr'))) {
  console.log(`  - ${board} (${count})`);
}
