/**
 * Brouillon de recette extrait d'une vidéo TikTok : renvoyé par l'analyse, corrigé par
 * l'utilisateur dans l'écran de relecture, puis renvoyé au serveur pour enregistrement.
 */

export interface ImportDraftIngredient {
	name: string;
	/** "250", "1/2", "2-3" ; vide si non précisée */
	quantity: string;
	/** Libellé de l'unité ("g", "c. à s.") ; vide si aucune */
	unit: string;
	/** Unité du catalogue, si elle a été reconnue */
	unitId?: string;
}

export interface ImportDraft {
	videoUrl: string;
	sourceVideoId: string;
	title: string;
	/** "Entrée", "Plat", "Dessert" ou "Boisson" */
	type: string;
	/** Minutes */
	preparationTime: number;
	/** Minutes */
	cookingTime: number;
	/** Nombre de personnes ; null si non précisé */
	servings: number | null;
	ingredients: ImportDraftIngredient[];
	steps: string[];
	/** Miniature TikTok (lien temporaire, pour l'aperçu uniquement) */
	thumbnailUrl: string | null;
	author: string | null;
	/** Vrai si l'IA a pu analyser la légende */
	aiUsed: boolean;
}
