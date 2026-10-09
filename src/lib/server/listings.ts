import { unstable_cache } from 'next/cache';
import { FieldPath } from 'firebase-admin/firestore';
import { getFirebaseAdminDb } from '@/lib/config/firebase-admin';

/** Données minimales d'une carte recette (sérialisables, passées aux composants client). */
export interface RecipeCardData {
  recetteId: string;
  title: string;
  type: string;
  position: string;
  images: string[];
  url?: string;
  cookingTime?: number;
  likesCount?: number;
}

export interface RecipesPage {
  recettes: RecipeCardData[];
  hasMore: boolean;
  /** Curseur de pagination : titre et id de la dernière recette affichée */
  cursor: { title: string; id: string } | null;
}

export const RECIPES_PAGE_SIZE = 12;

function toCard(id: string, data: FirebaseFirestore.DocumentData): RecipeCardData {
  return {
    recetteId: id,
    title: data.title || '',
    type: data.type || '',
    position: data.position || '',
    images: Array.isArray(data.images) ? data.images.filter((i: unknown) => typeof i === 'string') : [],
    url: data.url || undefined,
    cookingTime: typeof data.cookingTime === 'number' ? data.cookingTime : Number(data.cookingTime) || undefined,
  };
}

/** Première page de la liste des recettes (tri par titre), rendue côté serveur. */
async function fetchFirstRecipesPage(): Promise<RecipesPage> {
  const snapshot = await getFirebaseAdminDb()
    .collection('recipes')
    .orderBy('title')
    .orderBy(FieldPath.documentId())
    .limit(RECIPES_PAGE_SIZE + 1)
    .get();

  const docs = snapshot.docs.slice(0, RECIPES_PAGE_SIZE);
  const last = docs[docs.length - 1];

  return {
    recettes: docs.map((d) => toCard(d.id, d.data())),
    hasMore: snapshot.docs.length > RECIPES_PAGE_SIZE,
    cursor: last ? { title: last.data().title || '', id: last.id } : null,
  };
}

/**
 * Recettes les plus likées. Une seule lecture de la collection "likes"
 * (au lieu d'une requête par recette côté navigateur), puis lecture des recettes gagnantes.
 */
export async function getTrendingRecipes(count = 4): Promise<RecipeCardData[]> {
  const db = getFirebaseAdminDb();
  const likes = await db.collection('likes').select('recetteId').get();

  const counts = new Map<string, number>();
  for (const like of likes.docs) {
    const id = like.get('recetteId');
    if (typeof id === 'string' && id) counts.set(id, (counts.get(id) || 0) + 1);
  }

  const topIds = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, count * 2) // marge si certaines recettes ont été supprimées
    .map(([id]) => id);

  if (topIds.length === 0) return [];

  const docs = await db.getAll(...topIds.map((id) => db.collection('recipes').doc(id)));
  return docs
    .filter((d) => d.exists)
    .map((d) => ({ ...toCard(d.id, d.data()!), likesCount: counts.get(d.id) || 0 }))
    .slice(0, count);
}

export interface WeeklyRecipeData extends RecipeCardData {
  preparationTime?: number;
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  averageRating: number | null;
  reviewsCount: number;
  likesCount: number;
}

/** Recette de la semaine, avec note moyenne et nombre de likes. */
export async function getWeeklyRecipe(): Promise<WeeklyRecipeData | null> {
  const db = getFirebaseAdminDb();
  const weekly = await db.collection('weeklyRecipe').doc('current').get();
  if (!weekly.exists) return null;

  const weeklyData = weekly.data()!;
  const recipeId: string | undefined = weeklyData.id || weeklyData.recetteId;

  // Données à jour de la recette (slug, images…) si elle existe encore
  const recipeSnap = recipeId ? await db.collection('recipes').doc(recipeId).get() : null;
  const data = recipeSnap?.exists ? { ...weeklyData, ...recipeSnap.data() } : weeklyData;
  const id = recipeSnap?.exists ? recipeSnap.id : recipeId || weekly.id;

  const [likesAgg, reviews] = await Promise.all([
    db.collection('likes').where('recetteId', '==', id).count().get(),
    db.collection('reviews').where('recipeId', '==', id).select('rating').get(),
  ]);

  const ratings = reviews.docs.map((r) => Number(r.get('rating'))).filter((r) => r >= 1 && r <= 5);

  return {
    ...toCard(id, data),
    preparationTime: Number(data.preparationTime) || undefined,
    servings: typeof data.servings === 'number' ? data.servings : undefined,
    difficulty: data.difficulty || undefined,
    likesCount: likesAgg.data().count,
    reviewsCount: ratings.length,
    averageRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
  };
}

/** Première page mise en cache 10 min (partagée entre toutes les requêtes). */
export const getFirstRecipesPage = unstable_cache(fetchFirstRecipesPage, ['recipes-first-page'], { revalidate: 600 });

/** Slug d'une recette à partir de son id (redirection des anciennes URL /recettes?id=…). */
export async function getRecipeSlugById(id: string): Promise<string | null> {
  const snap = await getFirebaseAdminDb().collection('recipes').doc(id).get();
  if (!snap.exists) return null;
  return (snap.get('url') as string) || snap.id;
}
