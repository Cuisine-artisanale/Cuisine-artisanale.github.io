/**
 * Service de partage de recettes
 * Gère le partage natif avec Web Share API et fallback clipboard
 */

import type { ShareOptions } from '@/types';

export type { ShareOptions };

/**
 * Partage la recette via l'API Web Share (natif sur mobile/certains navigateurs)
 * Fallback : copie l'URL actuelle dans le presse-papiers
 */
export const shareRecipe = async (options: ShareOptions): Promise<void> => {
  const { title, description } = options;
  const shareUrl = window.location.href;

  // Vérifier si l'API Web Share est disponible
  if (navigator.share) {
	try {
	  await navigator.share({
		title,
		text: description,
		url: shareUrl,
	  });
	  return;
	} catch (error: any) {
	  // L'utilisateur a annulé le partage
	  if (error.name !== "AbortError") {
		console.error("Erreur lors du partage:", error);
	  }
	}
  }

  // Fallback : copier le lien actuel dans le presse-papiers
  try {
	await navigator.clipboard.writeText(shareUrl);
  } catch (error) {
	console.error("Erreur lors de la copie du lien:", error);
	throw new Error("Impossible de partager la recette");
  }
};

