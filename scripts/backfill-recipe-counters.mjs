/**
 * Calcule likesCount, ratingCount et ratingAverage pour toutes les recettes existantes.
 * À lancer une fois après le déploiement des Cloud Functions syncRecipeLikesCount /
 * syncRecipeRatingStats (qui maintiennent ensuite ces compteurs). Peut être relancé sans risque.
 *
 *   npm run backfill:recipe-counters
 *
 * Identifiants : variable FIREBASE_SERVICE_ACCOUNT_KEY (JSON) ou src/firebase/serviceAccountKey.json.
 */
import fs from 'fs';
import path from 'path';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

const serviceAccount = loadServiceAccount();
initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore();

const [recipes, likes, reviews] = await Promise.all([
  db.collection('recipes').select().get(),
  db.collection('likes').select('recetteId').get(),
  db.collection('reviews').select('recipeId', 'rating').get(),
]);

const likesByRecipe = new Map();
for (const like of likes.docs) {
  const id = like.get('recetteId');
  if (id) likesByRecipe.set(id, (likesByRecipe.get(id) || 0) + 1);
}

const ratingsByRecipe = new Map();
for (const review of reviews.docs) {
  const id = review.get('recipeId');
  const rating = Number(review.get('rating'));
  if (!id || !(rating >= 1 && rating <= 5)) continue;
  const current = ratingsByRecipe.get(id) || { sum: 0, count: 0 };
  ratingsByRecipe.set(id, { sum: current.sum + rating, count: current.count + 1 });
}

let batch = db.batch();
let pending = 0;

for (const recipe of recipes.docs) {
  const ratings = ratingsByRecipe.get(recipe.id);
  batch.update(recipe.ref, {
    likesCount: likesByRecipe.get(recipe.id) || 0,
    ratingCount: ratings?.count || 0,
    ratingAverage: ratings ? Math.round((ratings.sum / ratings.count) * 10) / 10 : null,
  });
  pending++;
  if (pending === 400) {
    await batch.commit();
    batch = db.batch();
    pending = 0;
  }
}
if (pending > 0) await batch.commit();

console.log(`✅ Compteurs mis à jour pour ${recipes.size} recette(s) (${likes.size} likes, ${reviews.size} avis).`);
