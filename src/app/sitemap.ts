import type { MetadataRoute } from 'next';
import { getFirebaseAdminDb } from '@/lib/config/firebase-admin';
import { SITE_URL } from '@/lib/server/recipes';

// Régénéré au plus toutes les heures : les nouvelles recettes y apparaissent sans redéploiement
export const revalidate = 3600;

// Next.js n'échappe pas les URL dans le XML du sitemap : les URL Firebase Storage
// contiennent des "&" (…?alt=media&token=…) qui rendraient le fichier invalide.
function xmlEscape(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function toDate(value: unknown): Date | undefined {
	if (!value) return undefined;
	if (value instanceof Date) return value;
	if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
		return (value as { toDate: () => Date }).toDate();
	}
	const parsed = new Date(value as string);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const staticRoutes: MetadataRoute.Sitemap = [
		{ url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1.0 },
		{ url: `${SITE_URL}/recettes`, changeFrequency: 'daily', priority: 0.9 },
		{ url: `${SITE_URL}/map`, changeFrequency: 'weekly', priority: 0.7 },
		{ url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
		{ url: `${SITE_URL}/mentions-legales`, changeFrequency: 'yearly', priority: 0.2 },
		{ url: `${SITE_URL}/politique-confidentialite`, changeFrequency: 'yearly', priority: 0.2 },
	];

	let recipeRoutes: MetadataRoute.Sitemap = [];
	try {
		const snapshot = await getFirebaseAdminDb().collection('recipes').get();

		recipeRoutes = snapshot.docs.map((doc) => {
			const recipe = doc.data();
			const images: string[] = Array.isArray(recipe.images)
				? recipe.images.filter((img: unknown) => typeof img === 'string' && img).slice(0, 3).map(xmlEscape)
				: [];
			return {
				url: xmlEscape(`${SITE_URL}/recettes/${encodeURIComponent(recipe.url || doc.id)}`),
				lastModified: toDate(recipe.updatedAt) || toDate(recipe.createdAt),
				changeFrequency: 'monthly' as const,
				priority: 0.8,
				images: images.length ? images : undefined,
			};
		});
	} catch (error) {
		console.error('Erreur lors de la récupération des recettes pour le sitemap:', error);
	}

	return [...staticRoutes, ...recipeRoutes];
}
