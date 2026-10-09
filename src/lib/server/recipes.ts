import { cache } from 'react';
import type { Recipe, RecipePart } from '@/types';
import { getFirebaseAdminDb } from '@/lib/config/firebase-admin';

export const SITE_URL = 'https://www.cuisine-artisanale.fr';

export interface RecipeRating {
  average: number;
  count: number;
}

export interface ServerRecipe {
  recipe: Recipe;
  authorName: string | null;
  rating: RecipeRating | null;
}

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
    new Set(parts.flatMap((part) => (part.ingredients || []).map((ing) => ing?.id).filter(Boolean)))
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
      .map((ing) => {
        const ref = ingredientsById.get(ing.id);
        if (!ref) return null;
        return {
          id: ing.id,
          name: ref.name || ing.name || '',
          quantity: ing.quantity,
          unit: ref.unit,
        };
      })
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

  const [authorSnap, reviewsSnap] = await Promise.all([
    recipe.createdBy ? db.collection('publicProfiles').doc(recipe.createdBy).get() : Promise.resolve(null),
    db.collection('reviews').where('recipeId', '==', snap.id).get(),
  ]);

  const ratings = reviewsSnap.docs
    .map((d) => Number(d.data().rating))
    .filter((r) => r >= 1 && r <= 5);

  return {
    recipe,
    authorName: authorSnap?.exists ? (authorSnap.data()?.displayName as string) || null : null,
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

function formatIngredient(ing: { name: string; quantity?: string; unit?: string }): string {
  const qty = ing.quantity && ing.quantity !== '0' ? ing.quantity : '';
  return [qty, qty ? ing.unit : '', ing.name].filter(Boolean).join(' ');
}

/** Données structurées schema.org/Recipe (résultats enrichis Google). */
export function buildRecipeJsonLd({ recipe, authorName, rating }: ServerRecipe, canonicalUrl: string) {
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
    recipeIngredient: recipe.recipeParts.flatMap((p) => p.ingredients.map(formatIngredient)),
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
