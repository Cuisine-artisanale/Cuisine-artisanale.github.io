/**
 * Service de partage de recettes
 * Gère le partage natif avec Web Share API et fallback clipboard
 */

import type { ShareOptions } from '@/types';
import { isOptimizableImage } from '@/lib/utils/image';

export type { ShareOptions };

interface PinOptions {
  /** URL canonique de la recette (destination de l'épingle) */
  pageUrl: string;
  /** Origine du site, pour l'URL absolue de l'image */
  origin: string;
  title: string;
  type?: string;
  images?: string[];
}

/** Image verticale (1000 × 1500) d'une recette, générée par /api/og-image?format=pin. */
export function buildPinImagePath({ title, type, images }: Pick<PinOptions, 'title' | 'type' | 'images'>): string {
  const params = new URLSearchParams({ format: 'pin', title, type: type || 'Recette' });
  const photo = (images || []).find((image) => isOptimizableImage(image));
  if (photo) params.set('image', photo);
  return `/api/og-image?${params.toString()}`;
}

/** Lien « Enregistrer sur Pinterest » : épingle pré-remplie (image verticale, titre, lien vers la recette). */
export function buildPinterestUrl({ pageUrl, origin, title, type, images }: PinOptions): string {
  // Paramètres UTM : les visites venues de l'épingle sont attribuées à Pinterest
  const link = new URL(pageUrl);
  link.searchParams.set('utm_source', 'pinterest');
  link.searchParams.set('utm_medium', 'pin');
  const params = new URLSearchParams({
    url: link.toString(),
    media: `${origin}${buildPinImagePath({ title, type, images })}`,
    description: `${title} : la recette pas à pas sur Cuisine Artisanale`,
  });
  return `https://www.pinterest.com/pin/create/button/?${params.toString()}`;
}

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

