import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdminDb } from '@/lib/config/firebase-admin';

/** Identifiant de document Firestore généré automatiquement (ou id saisi à la main, sans caractère spécial) */
const RECIPE_ID_REGEX = /^[A-Za-z0-9_-]{1,100}$/;

export function isRecipeId(value: unknown): value is string {
	return typeof value === 'string' && RECIPE_ID_REGEX.test(value);
}

/**
 * Compte une vue de la fiche d'une recette : viewsCount et popularity augmentent de 1
 * (popularity = vues + 10 × likes, voir src/lib/utils/recipe-stats.ts).
 * Recette inexistante : update échoue sans rien créer. Les erreurs sont seulement journalisées.
 */
export async function recordRecipeView(recipeId: string): Promise<void> {
	try {
		await getFirebaseAdminDb()
			.doc(`recipes/${recipeId}`)
			.update({ viewsCount: FieldValue.increment(1), popularity: FieldValue.increment(1) });
	} catch (error) {
		if ((error as { code?: number })?.code !== 5) console.error(`Vue non comptée (${recipeId}) :`, error);
	}
}
