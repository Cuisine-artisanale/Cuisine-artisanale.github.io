import { cache } from 'react';
import type { Recipe, RecipePart } from '@/types';
import { getFirebaseAdminDb } from '@/lib/config/firebase-admin';
import { mergeIngredientDetails } from '@/lib/utils/recipe-ingredients';
import { getRecipeStats } from '@/lib/utils/recipe-stats';
import { buildUnitIndex, formatAmount, type UnitDef } from '@/lib/utils/units';

export const SITE_URL = 'https://www.cuisine-artisanale.fr';

export interface RecipeRating {
  average: number;
  count: number;
}

/** Avis affiché sur la fiche recette (sérialisable). */
export interface RecipeReview {
  id: string;
  userId: string;
  userName: string;
  message: string;
  rating: number;
  /** Date ISO */
  createdAt?: string;
}

/** Carte « recette similaire » (sérialisable). */
export interface SimilarRecipe {
  id: string;
  title: string;
  type: string;
  url?: string;
  images: string[];
  cookingTime?: number;
}

export interface ServerRecipe {
  recipe: Recipe;
  authorName: string | null;
  rating: RecipeRating | null;
  /** Compteur stocké sur la recette (Cloud Function syncRecipeLikesCount) */
  likesCount: number;
  /** Avis les plus récents d'abord */
  reviews: RecipeReview[];
  similar: SimilarRecipe[];
}

/** Nombre maximum d'avis envoyés au navigateur */
const MAX_REVIEWS = 100;
const SIMILAR_COUNT = 3;

/** Convertit un Timestamp Firestore (ou une date) en chaîne ISO sérialisable. */
function toIsoDate(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return undefined;
}

/**
 * Charge une recette côté serveur (Firebase Admin) à partir de son slug,
 * avec les noms / unités d'ingrédients à jour, l'auteur et la note moyenne.
 * Mis en cache pour la durée d'une requête (generateMetadata + page partagent le résultat).
 */
export const getRecipeBySlug = cache(async (slug: string): Promise<ServerRecipe | null> => {
  const db = getFirebaseAdminDb();

  let snap = (await db.collection('recipes').where('url', '==', slug).limit(1).get()).docs[0];

  // Compatibilité : anciennes URL construites avec l'id du document
  if (!snap) {
    const byId = await db.collection('recipes').doc(slug).get();
    if (byId.exists) snap = byId as typeof snap;
  }

  if (!snap) return null;

  const data = snap.data();

  // Noms et unités des ingrédients depuis la collection de référence
  const parts: RecipePart[] = Array.isArray(data.recipeParts) ? data.recipeParts : [];
  const ingredientIds = Array.from(
    new Set(parts.flatMap((part) => (part.ingredients || []).map((ing) => ing?.id).filter((id) => typeof id === 'string' && id && !id.includes('/'))))
  ) as string[];

  const ingredientDocs = ingredientIds.length
    ? await db.getAll(...ingredientIds.map((id) => db.collection('ingredients').doc(id)))
    : [];
  const ingredientsById = new Map(
    ingredientDocs.filter((d) => d.exists).map((d) => [d.id, d.data() as { name?: string; unit?: string }])
  );

  const recipeParts: RecipePart[] = parts.map((part) => ({
    title: part.title || '',
    steps: Array.isArray(part.steps) ? part.steps : [],
    ingredients: (part.ingredients || [])
      .map((ing) => mergeIngredientDetails(ing, ingredientsById.get(ing.id)))
      .filter((ing): ing is NonNullable<typeof ing> => ing !== null),
  }));

  const recipe: Recipe = {
    id: snap.id,
    title: data.title || '',
    type: data.type || '',
    cookingTime: Number(data.cookingTime) || 0,
    preparationTime: Number(data.preparationTime) || 0,
    recipeParts,
    video: data.video || undefined,
    position: data.position || '',
    images: Array.isArray(data.images) ? data.images : [],
    createdBy: data.createdBy || undefined,
    createdAt: toIsoDate(data.createdAt),
    url: data.url || undefined,
    servings: typeof data.servings === 'number' ? data.servings : undefined,
    difficulty: data.difficulty || undefined,
  };

  const [authorSnap, reviewsSnap, similarSnap] = await Promise.all([
    recipe.createdBy ? db.collection('publicProfiles').doc(recipe.createdBy).get() : Promise.resolve(null),
    db.collection('reviews').where('recipeId', '==', snap.id).get(),
    // Même type et même département (une de plus, au cas où la recette courante en fait partie)
    db.collection('recipes')
      .where('type', '==', data.type || '')
      .where('position', '==', data.position || '')
      .select('title', 'type', 'url', 'images', 'cookingTime')
      .limit(SIMILAR_COUNT + 1)
      .get(),
  ]);

  const reviews: RecipeReview[] = reviewsSnap.docs
    .map((d) => {
      const r = d.data();
      return {
        id: d.id,
        userId: String(r.userId || ''),
        userName: String(r.userName || 'Utilisateur'),
        message: String(r.message || ''),
        rating: Number(r.rating) || 0,
        createdAt: toIsoDate(r.createdAt),
      };
    })
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const ratings = reviews.map((r) => r.rating).filter((r) => r >= 1 && r <= 5);

  const similar: SimilarRecipe[] = similarSnap.docs
    .filter((d) => d.id !== snap.id)
    .slice(0, SIMILAR_COUNT)
    .map((d) => {
      const s = d.data();
      return {
        id: d.id,
        title: s.title || '',
        type: s.type || '',
        url: s.url || undefined,
        images: Array.isArray(s.images) ? s.images.filter((i: unknown) => typeof i === 'string') : [],
        cookingTime: Number(s.cookingTime) || undefined,
      };
    });

  return {
    recipe,
    authorName: authorSnap?.exists ? (authorSnap.data()?.displayName as string) || null : null,
    likesCount: getRecipeStats(data).likesCount,
    reviews: reviews.slice(0, MAX_REVIEWS),
    similar,
    rating: ratings.length
      ? { average: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10, count: ratings.length }
      : null,
  };
});

/** Résumé court de la recette pour la meta description (≈ 155 caractères). */
export function buildRecipeDescription(recipe: Recipe): string {
  const totalTime = recipe.preparationTime + recipe.cookingTime;
  const ingredients = recipe.recipeParts.flatMap((p) => p.ingredients.map((i) => i.name)).filter(Boolean);
  const uniqueIngredients = Array.from(new Set(ingredients)).slice(0, 5);

  const parts = [
    `Recette ${recipe.type ? recipe.type.toLowerCase() : ''} : ${recipe.title}`.replace(/\s+/g, ' '),
    totalTime > 0 ? `prête en ${totalTime} min` : '',
    uniqueIngredients.length ? `avec ${uniqueIngredients.join(', ')}` : '',
  ].filter(Boolean);

  const text = `${parts.join(', ')}. Ingrédients, étapes et avis sur Cuisine Artisanale.`;
  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
}

function isoDuration(minutes: number): string | undefined {
  if (!minutes || minutes <= 0) return undefined;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}`;
}

function formatIngredient(ing: { name: string; quantity?: string; unit?: string; unitId?: string }, units: UnitDef[]): string {
  const amount = formatAmount(ing.quantity, buildUnitIndex(units), { unit: ing.unit, unitId: ing.unitId });
  return [amount.text, ing.name].filter(Boolean).join(' ');
}

/** Données structurées schema.org/Recipe (résultats enrichis Google). */
export function buildRecipeJsonLd({ recipe, authorName, rating }: ServerRecipe, canonicalUrl: string, units: UnitDef[]) {
  const description = buildRecipeDescription(recipe);
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.title,
    description,
    url: canonicalUrl,
    image: recipe.images && recipe.images.length ? recipe.images : undefined,
    author: authorName
      ? { '@type': 'Person', name: authorName }
      : { '@type': 'Organization', name: 'Cuisine Artisanale', url: SITE_URL },
    datePublished: recipe.createdAt,
    recipeCategory: recipe.type || undefined,
    recipeCuisine: 'Française',
    prepTime: isoDuration(recipe.preparationTime),
    cookTime: isoDuration(recipe.cookingTime),
    totalTime: isoDuration(recipe.preparationTime + recipe.cookingTime),
    recipeYield: recipe.servings ? `${recipe.servings} personnes` : undefined,
    recipeIngredient: recipe.recipeParts.flatMap((p) => p.ingredients.map((ing) => formatIngredient(ing, units))),
    recipeInstructions: recipe.recipeParts.flatMap((p) =>
      p.steps.filter(Boolean).map((text) => ({ '@type': 'HowToStep', text }))
    ),
    keywords: [recipe.type, 'recette française', 'cuisine artisanale'].filter(Boolean).join(', '),
  };

  if (rating) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: rating.average,
      ratingCount: rating.count,
      bestRating: 5,
      worstRating: 1,
    };
  }

  // Retire les champs vides
  return Object.fromEntries(Object.entries(jsonLd).filter(([, v]) => v !== undefined && v !== ''));
}

/** Sérialise du JSON-LD sans risque d'injection dans une balise <script>. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
