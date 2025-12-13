import { MetadataRoute } from 'next';
import { db } from '@/lib/config/firebase';
import { collection, getDocs } from '@firebase/firestore';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const baseUrl = 'https://www.cuisine-artisanale.fr';

	// Routes statiques
	const staticRoutes: MetadataRoute.Sitemap = [
		{
			url: baseUrl,
			lastModified: new Date(),
			changeFrequency: 'weekly',
			priority: 1.0,
		},
		{
			url: `${baseUrl}/recettes`,
			lastModified: new Date(),
			changeFrequency: 'weekly',
			priority: 0.9,
		},
		{
			url: `${baseUrl}/about`,
			lastModified: new Date(),
			changeFrequency: 'monthly',
			priority: 0.7,
		},
		{
			url: `${baseUrl}/map`,
			lastModified: new Date(),
			changeFrequency: 'weekly',
			priority: 0.8,
		},
		{
			url: `${baseUrl}/mentions-legales`,
			lastModified: new Date(),
			changeFrequency: 'yearly',
			priority: 0.3,
		},
		{
			url: `${baseUrl}/politique-confidentialite`,
			lastModified: new Date(),
			changeFrequency: 'yearly',
			priority: 0.3,
		},
	];

	// Récupération des recettes depuis Firebase
	let recipeRoutes: MetadataRoute.Sitemap = [];
	try {
		const recipesRef = collection(db, 'recipes');
		const querySnapshot = await getDocs(recipesRef);

		recipeRoutes = querySnapshot.docs.map((doc) => {
			const recipe = doc.data();
			const slug = recipe.url || doc.id;

			return {
				url: `${baseUrl}/recettes/${slug}`,
				lastModified: recipe.updatedAt?.toDate() || new Date(),
				changeFrequency: 'weekly' as const,
				priority: 0.9,
			};
		});
	} catch (error) {
		console.error('Erreur lors de la récupération des recettes pour le sitemap:', error);
	}

	return [...staticRoutes, ...recipeRoutes];
}

