import { loadFirestore } from '@/lib/config/firestore-lazy';

/**
 * Photos des recettes publiées issues du carnet, par vidéo TikTok d'origine.
 *
 * Une recette importée existe en deux exemplaires : le carnet (users/{uid}/carnet) et, une fois
 * validée, la recette publiée (recipes, nouvel identifiant) qui garde createdBy et sourceVideoId.
 * Quand la photo de la recette publiée est changée, le carnet affiche la même.
 */
export async function getPublishedImagesByVideo(uid: string): Promise<Map<string, string[]>> {
	const images = new Map<string, string[]>();
	try {
		const { db, collection, getDocs, query, where } = await loadFirestore();
		const snapshot = await getDocs(query(
			collection(db, 'recipes'),
			where('createdBy', '==', uid),
			where('source', '==', 'tiktok'),
		));
		snapshot.forEach((recipe) => {
			const data = recipe.data();
			if (typeof data.sourceVideoId === 'string' && Array.isArray(data.images) && data.images.length > 0) {
				images.set(data.sourceVideoId, data.images);
			}
		});
	} catch (error) {
		// Sans cette information, le carnet garde ses propres photos
		console.error('Photos des recettes publiées indisponibles :', error);
	}
	return images;
}

/** Photos à afficher pour une recette du carnet : celles de sa version publiée, sinon les siennes. */
export function carnetImages(data: { sourceVideoId?: unknown; images?: unknown }, published: Map<string, string[]>): string[] {
	const own = Array.isArray(data.images) ? data.images : [];
	return (typeof data.sourceVideoId === 'string' && published.get(data.sourceVideoId)) || own;
}
