/**
 * Dépose un lot de recettes en modération (collection "recipesRequest").
 * Rien n'est publié : chaque recette reste à relire et à valider dans le panneau d'admin.
 *
 *   node scripts/import-recipes.mjs                      essai à blanc : contrôle le fichier, n'écrit rien
 *   node scripts/import-recipes.mjs --write --uid=<uid>  écrit les demandes au nom de ce compte
 *   node scripts/import-recipes.mjs --file=<chemin>      autre fichier que scripts/data/recettes-lancement.json
 *
 * - Les recettes dont l'adresse (slug) existe déjà dans "recipes" ou "recipesRequest" sont ignorées :
 *   le script peut être relancé sans créer de doublon.
 * - Les ingrédients sont rattachés aux fiches du catalogue quand le nom correspond ; les autres
 *   reçoivent un id libre et entrent au catalogue à la validation, comme avec le formulaire.
 * - La photo et son crédit viennent de scripts/data/photos-recettes.json (voir scripts/import-photos.mjs).
 * - Les demandes sont créées en une seule écriture, titre compris : aucun email d'alerte n'est envoyé.
 *
 * Identifiants : variable FIREBASE_SERVICE_ACCOUNT_KEY (JSON) ou src/firebase/serviceAccountKey.json.
 */
import fs from 'fs';
import path from 'path';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const RECIPE_TYPES = ['Entrée', 'Plat', 'Dessert', 'Boisson'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  const file = path.join(process.cwd(), 'src', 'firebase', 'serviceAccountKey.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  throw new Error('Aucun identifiant Firebase Admin (FIREBASE_SERVICE_ACCOUNT_KEY ou src/firebase/serviceAccountKey.json)');
}

// Mêmes règles que src/lib/utils/slug.ts et src/lib/utils/ingredient-name.ts
const stripAccents = (v) => v.replace(/œ/gi, 'oe').replace(/æ/gi, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '');
const slugify = (title) =>
  stripAccents(title.replace(/^\s*(?:les|le|la|des|du|de)\s+/i, ' ').trim())
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
const ingredientNameKey = (name) => stripAccents((name || '').toLowerCase()).replace(/[\s.'’-]/g, '').replace(/s$/, '');

// Mots de recherche : la liste des recettes interroge "titleKeywords" mot par mot
function toKeywords(recipe) {
  const words = [recipe.title, ...(recipe.keywords || [])]
    .flatMap((text) => text.toLowerCase().split(/[\s'’-]+/))
    .filter((word) => word.length > 2);
  return [...new Set(words.flatMap((word) => [word, stripAccents(word)]))].slice(0, 30);
}

const args = process.argv.slice(2);
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const write = args.includes('--write');
const uid = option('uid');
const file = option('file') || path.join('scripts', 'data', 'recettes-lancement.json');

if (write && !uid) {
  console.error('❌ --write demande --uid=<uid> : le compte au nom duquel les recettes sont proposées.');
  process.exit(1);
}

const recipes = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
const units = new Map(
  JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'constants', 'default-units.json'), 'utf8')).map((u) => [u.id, u])
);
const departements = new Set(
  [...fs.readFileSync(path.join(process.cwd(), 'src', 'constants', 'departements.ts'), 'utf8').matchAll(/code:\s*"([^"]+)"/g)].map((m) => m[1])
);

// Photos sous licence libre déjà envoyées dans le stockage, par titre de recette
const photosFile = path.join(process.cwd(), 'scripts', 'data', 'photos-recettes.json');
const photos = new Map(
  (fs.existsSync(photosFile) ? JSON.parse(fs.readFileSync(photosFile, 'utf8')) : [])
    .filter((photo) => photo.imageUrl)
    .map((photo) => [photo.title, photo])
);

// ---- Contrôle du fichier ----
const errors = [];
const slugs = new Set();
for (const recipe of recipes) {
  const where = `« ${recipe.title || '?'} »`;
  const slug = slugify(recipe.title || '');
  if (!slug) errors.push(`${where} : titre manquant`);
  if (slugs.has(slug)) errors.push(`${where} : titre en double dans le fichier`);
  slugs.add(slug);
  if (!RECIPE_TYPES.includes(recipe.type)) errors.push(`${where} : type inconnu (${recipe.type})`);
  if (recipe.position !== 'none' && !departements.has(recipe.position)) errors.push(`${where} : département inconnu (${recipe.position})`);
  if (!DIFFICULTIES.includes(recipe.difficulty)) errors.push(`${where} : difficulté inconnue (${recipe.difficulty})`);
  for (const field of ['preparationTime', 'cookingTime', 'servings']) {
    if (!Number.isInteger(recipe[field]) || recipe[field] < 0) errors.push(`${where} : ${field} invalide`);
  }
  if (!Array.isArray(recipe.parts) || recipe.parts.length === 0) errors.push(`${where} : aucune partie`);
  for (const part of recipe.parts || []) {
    if (!part.steps?.length || !part.ingredients?.length) errors.push(`${where} / ${part.title} : étapes ou ingrédients manquants`);
    for (const [name, , unitId] of part.ingredients || []) {
      if (unitId && !units.has(unitId)) errors.push(`${where} / ${name} : unité inconnue (${unitId})`);
    }
  }
}
if (errors.length > 0) {
  console.error(`❌ ${errors.length} erreur(s) dans ${file} :\n - ${errors.join('\n - ')}`);
  process.exit(1);
}

// ---- Lecture de l'existant ----
const serviceAccount = loadServiceAccount();
initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore();

const [catalogSnap, publishedSnap, pendingSnap] = await Promise.all([
  db.collection('ingredients').select('name').get(),
  db.collection('recipes').select('url').get(),
  db.collection('recipesRequest').select('url').get(),
]);
const catalogByKey = new Map();
for (const doc of catalogSnap.docs) {
  const key = ingredientNameKey(doc.get('name'));
  if (key && !catalogByKey.has(key)) catalogByKey.set(key, { id: doc.id, name: doc.get('name') });
}
const published = new Set(publishedSnap.docs.map((doc) => doc.get('url')));
const pending = new Set(pendingSnap.docs.map((doc) => doc.get('url')));

// ---- Construction des demandes ----
const newIngredients = new Set();
const requests = [];
for (const recipe of recipes) {
  const url = slugify(recipe.title);
  if (published.has(url) || pending.has(url)) {
    console.log(`⏭️  ${recipe.title} : déjà ${published.has(url) ? 'publiée' : 'en attente'}, ignorée`);
    continue;
  }

  let rank = 0;
  const recipeParts = recipe.parts.map((part) => ({
    // Recette en une seule partie : elle porte le titre de la recette
    title: recipe.parts.length === 1 ? recipe.title : part.title,
    steps: part.steps,
    ingredients: part.ingredients.map(([name, quantity, unitId]) => {
      rank += 1;
      const known = catalogByKey.get(ingredientNameKey(name));
      if (!known) newIngredients.add(name);
      const unit = unitId ? units.get(unitId) : null;
      return {
        id: known?.id || `${slugify(name) || 'ingredient'}-${rank}`,
        name: known?.name || name,
        quantity,
        unit: unit ? unit.abbreviation || unit.name : '',
        ...(unit ? { unitId } : {}),
      };
    }),
  }));

  const photo = photos.get(recipe.title);
  requests.push({
    title: recipe.title,
    type: recipe.type,
    preparationTime: recipe.preparationTime,
    cookingTime: recipe.cookingTime,
    servings: recipe.servings,
    difficulty: recipe.difficulty,
    position: recipe.position,
    recipeParts,
    images: photo ? [photo.imageUrl] : [],
    ...(photo
      ? {
          imageCredit: {
            author: photo.author,
            license: photo.license,
            sourceUrl: photo.sourceUrl,
            ...(photo.licenseUrl ? { licenseUrl: photo.licenseUrl } : {}),
          },
        }
      : {}),
    video: '',
    titleKeywords: toKeywords(recipe),
    url,
    source: 'manual',
  });
}

console.log(`\n${requests.length} recette(s) à déposer sur ${recipes.length} :`);
for (const request of requests) {
  const count = request.recipeParts.reduce((n, part) => n + part.ingredients.length, 0);
  console.log(` - ${request.title} (${request.type}, ${request.position === 'none' ? 'sans département' : request.position}) → /recettes/${request.url}, ${count} ingrédients${request.images.length ? '' : ', SANS PHOTO'}`);
}
if (newIngredients.size > 0) {
  console.log(`\n${newIngredients.size} ingrédient(s) absents du catalogue, créés à la validation :\n ${[...newIngredients].sort((a, b) => a.localeCompare(b, 'fr')).join(', ')}`);
}

if (!write) {
  console.log('\nEssai à blanc : rien n\'a été écrit. Relancer avec --write --uid=<uid> pour déposer les demandes.');
  process.exit(0);
}

const batch = db.batch();
for (const request of requests) {
  const ref = db.collection('recipesRequest').doc();
  batch.set(ref, { ...request, id: ref.id, createdBy: uid, createdAt: FieldValue.serverTimestamp() });
}
await batch.commit();
console.log(`\n✅ ${requests.length} recette(s) déposée(s) en modération. Ajouter une photo à celles qui n'en ont pas avant de les valider.`);
