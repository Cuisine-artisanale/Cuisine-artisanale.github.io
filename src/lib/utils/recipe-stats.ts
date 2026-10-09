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
