import { unstable_cache } from 'next/cache';
import { getFirebaseAdminDb } from '@/lib/config/firebase-admin';
import { getRecipeStats, popularityOf, type RecipeStats } from '@/lib/utils/recipe-stats';
import { weightedShuffle } from '@/lib/utils/weighted-shuffle';
import { toPostCard, type PostCardData } from '@/lib/utils/post-card';

export type { PostCardData };

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
  stats?: RecipeStats;
  /** Temps total (préparation + cuisson), en minutes */
  time?: number;
}

export interface RecipesPage {
  recettes: RecipeCardData[];
  hasMore: boolean;
  /** Graine du mélange : les pages suivantes la réutilisent pour prolonger le même ordre */
  seed: number;
}

/** Carte recette avec ce qu'il faut pour le mélange et le bandeau « Nouveautés » */
interface ListedRecipe extends RecipeCardData {
  popularity: number;
  /** Date de publication, en millisecondes (0 si inconnue) */
  createdAt: number;
}

/** Bandeau « Nouveautés » : recettes publiées depuis moins de NEW_RECIPES_DAYS jours, NEW_RECIPES_MAX au plus */
const NEW_RECIPES_DAYS = 30;
const NEW_RECIPES_MAX = 4;

export const RECIPES_PAGE_SIZE = 12;

/** Étiquette des listes de recettes en cache (liste, régions) : invalidée à chaque publication ou suppression. */
export const RECIPE_LISTS_TAG = 'recipe-lists';

function toCard(id: string, data: FirebaseFirestore.DocumentData): RecipeCardData {
  return {
    recetteId: id,
    title: data.title || '',
    type: data.type || '',
    position: data.position || '',
    images: Array.isArray(data.images) ? data.images.filter((i: unknown) => typeof i === 'string') : [],
    url: data.url || undefined,
    cookingTime: typeof data.cookingTime === 'number' ? data.cookingTime : Number(data.cookingTime) || undefined,
    stats: getRecipeStats(data),
    time: (Number(data.preparationTime) || 0) + (Number(data.cookingTime) || 0) || undefined,
  };
}

function toMillis(value: unknown): number {
  if (value && typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  const parsed = value ? new Date(value as string).getTime() : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Toutes les recettes, avec les seuls champs utiles aux cartes (lu une fois toutes les 10 min au plus). */
async function fetchListedRecipes(): Promise<ListedRecipe[]> {
  const snapshot = await getFirebaseAdminDb()
    .collection('recipes')
    .select('title', 'type', 'position', 'images', 'url', 'cookingTime', 'preparationTime',
      'likesCount', 'ratingCount', 'ratingAverage', 'viewsCount', 'popularity', 'createdAt')
    .get();
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      ...toCard(d.id, data),
      // Recette sans score calculé : on le déduit des compteurs
      popularity: Number(data.popularity) || popularityOf(data.viewsCount, data.likesCount),
      createdAt: toMillis(data.createdAt),
    };
  });
}

const getListedRecipes = unstable_cache(fetchListedRecipes, ['listed-recipes'], { revalidate: 600, tags: [RECIPE_LISTS_TAG] });

/** Carte seule (sans les champs internes), pour l'envoyer au navigateur */
function toPublicCard(recipe: ListedRecipe): RecipeCardData {
  const card: RecipeCardData & Partial<Pick<ListedRecipe, 'popularity' | 'createdAt'>> = { ...recipe };
  delete card.popularity;
  delete card.createdAt;
  return card;
}

function pickNewRecipes(recipes: ListedRecipe[]): ListedRecipe[] {
  const since = Date.now() - NEW_RECIPES_DAYS * 24 * 60 * 60 * 1000;
  return recipes
    .filter((recipe) => recipe.createdAt >= since)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, NEW_RECIPES_MAX);
}

/** Bandeau « Nouveautés » de la liste des recettes : les dernières publiées, de la plus récente à la plus ancienne. */
export async function getNewRecipes(): Promise<RecipeCardData[]> {
  return pickNewRecipes(await getListedRecipes()).map(toPublicCard);
}

/**
 * Une page de la liste des recettes, en mélange aléatoire pondéré : tout est mélangé, mais une
 * recette populaire a plus de chances d'arriver en haut. Poids = 1 + √(popularité), popularité =
 * vues + 10 × likes : la racine carrée évite que les recettes les plus vues occupent toujours
 * le haut de la liste, et le « 1 + » laisse sa chance à une recette encore sans vue.
 *
 * Sans filtre, les recettes du bandeau « Nouveautés » sont retirées du mélange (déjà affichées).
 */
export async function getShuffledRecipesPage({
  seed,
  page = 0,
  type = '',
  position = '',
}: { seed: number; page?: number; type?: string; position?: string }): Promise<RecipesPage> {
  const recipes = await getListedRecipes();
  const shownAsNew = type || position ? new Set<string>() : new Set(pickNewRecipes(recipes).map((r) => r.recetteId));

  const candidates = recipes.filter(
    (recipe) =>
      !shownAsNew.has(recipe.recetteId) &&
      (!type || recipe.type === type) &&
      (!position || recipe.position === position)
  );
  const shuffled = weightedShuffle(candidates, (recipe) => 1 + Math.sqrt(recipe.popularity), seed);
  const start = page * RECIPES_PAGE_SIZE;

  return {
    recettes: shuffled.slice(start, start + RECIPES_PAGE_SIZE).map(toPublicCard),
    hasMore: shuffled.length > start + RECIPES_PAGE_SIZE,
    seed,
  };
}

/**
 * Recettes les plus likées, via le compteur likesCount stocké sur chaque recette.
 * Repli (compteurs pas encore calculés) : une lecture de la collection "likes".
 */
export async function getTrendingRecipes(count = 4): Promise<RecipeCardData[]> {
  const db = getFirebaseAdminDb();

  const byCounter = await db.collection('recipes').orderBy('likesCount', 'desc').limit(count).get();
  if (!byCounter.empty) {
    return byCounter.docs
      .map((d) => {
        const card = toCard(d.id, d.data());
        return { ...card, likesCount: card.stats?.likesCount ?? 0 };
      })
      .filter((r) => (r.likesCount ?? 0) > 0);
  }

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

/** Recettes d'un ensemble de départements (30 codes au plus : limite de l'opérateur "in"), triées par titre. */
async function fetchRecipesByDepartements(codes: string[]): Promise<RecipeCardData[]> {
  if (codes.length === 0) return [];
  const snapshot = await getFirebaseAdminDb().collection('recipes').where('position', 'in', codes).get();
  return snapshot.docs
    .map((d) => toCard(d.id, d.data()))
    .sort((a, b) => a.title.localeCompare(b.title, 'fr'));
}

/** Recettes d'une région, en cache 10 min. */
export const getRecipesByDepartements = unstable_cache(fetchRecipesByDepartements, ['recipes-by-departements'], { revalidate: 600, tags: [RECIPE_LISTS_TAG] });

/** Nombre de recettes par code de département (une lecture du seul champ "position"). */
async function fetchRecipeCountsByDepartement(): Promise<Record<string, number>> {
  const snapshot = await getFirebaseAdminDb().collection('recipes').select('position').get();
  const counts: Record<string, number> = {};
  for (const doc of snapshot.docs) {
    const position = doc.get('position');
    if (typeof position === 'string' && position) counts[position] = (counts[position] || 0) + 1;
  }
  return counts;
}

export const getRecipeCountsByDepartement = unstable_cache(fetchRecipeCountsByDepartement, ['recipe-counts-by-departement'], { revalidate: 600, tags: [RECIPE_LISTS_TAG] });

/** Slug d'une recette à partir de son id (redirection des anciennes URL /recettes?id=…). */
export async function getRecipeSlugById(id: string): Promise<string | null> {
  const snap = await getFirebaseAdminDb().collection('recipes').doc(id).get();
  if (!snap.exists) return null;
  return (snap.get('url') as string) || snap.id;
}

/** Derniers posts visibles pour l'accueil (les admins rechargent la liste complète côté client). */
export async function getRecentPosts(count = 30): Promise<PostCardData[]> {
  const snapshot = await getFirebaseAdminDb()
    .collection('posts')
    .orderBy('createdAt', 'desc')
    .limit(count * 2)
    .get();
  return snapshot.docs
    .map((d) => toPostCard(d.id, d.data()))
    .filter((p) => p.visible)
    .slice(0, count);
}
