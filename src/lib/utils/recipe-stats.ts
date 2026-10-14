/**
 * Compteurs stockés sur chaque recette (maintenus par les Cloud Functions
 * syncRecipeLikesCount / syncRecipeRatingStats).
 */
export interface RecipeStats {
  likesCount: number;
  ratingCount: number;
  /** Note moyenne sur 5, arrondie au dixième ; null s'il n'y a aucun avis */
  ratingAverage: number | null;
}

export function getRecipeStats(data: Record<string, unknown> | undefined | null): RecipeStats {
  const likesCount = Number(data?.likesCount);
  const ratingCount = Number(data?.ratingCount);
  const ratingAverage = Number(data?.ratingAverage);
  return {
    likesCount: Number.isFinite(likesCount) && likesCount > 0 ? likesCount : 0,
    ratingCount: Number.isFinite(ratingCount) && ratingCount > 0 ? ratingCount : 0,
    ratingAverage: Number.isFinite(ratingAverage) && ratingAverage > 0 ? ratingAverage : null,
  };
}

/**
 * Popularité d'une recette, qui ordonne la liste des recettes : vues + LIKE_WEIGHT × likes.
 * Un like pèse autant que 10 vues : il est bien plus rare et dit davantage que la recette plaît.
 * Même valeur dans functions/src/index.ts (recalcul à chaque like) et scripts/backfill-recipe-counters.mjs.
 */
export const LIKE_WEIGHT = 10;

export function popularityOf(viewsCount: number, likesCount: number): number {
  return (Number(viewsCount) || 0) + LIKE_WEIGHT * (Number(likesCount) || 0);
}
