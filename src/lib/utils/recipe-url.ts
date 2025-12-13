import { slugify, getRecipeUrlFromTitle } from './slug';

/**
 * Génère l'URL d'une recette à partir de son ID ou de son titre
 * Si la recette a un champ `url` (slug), l'utilise, sinon génère un slug à partir du titre
 */
export function getRecipeUrl(recipe: { id?: string; url?: string; title?: string }): string {
  // Si la recette a un slug/url, l'utiliser
  if (recipe.url) {
    return `/recettes/${recipe.url}`;
  }

  // Sinon, générer un slug à partir du titre
  if (recipe.title) {
    return getRecipeUrlFromTitle(recipe.title);
  }

  // Fallback : utiliser l'ID si disponible (pour compatibilité)
  if (recipe.id) {
    return `/recettes?id=${recipe.id}`;
  }

  return '/recettes';
}

