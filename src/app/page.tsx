import type { Metadata } from 'next';
import PostsClient from './PostsClient';
import TrendingRecipes from '@/components/features/TrendingRecipes/TrendingRecipes';
import WeeklyRecipe from '@/components/features/WeeklyRecipe/WeeklyRecipe';
import { getRecentPosts, getTrendingRecipes, getWeeklyRecipe } from '@/lib/server/listings';

// Page générée côté serveur et mise en cache, régénérée au plus toutes les 10 minutes
export const revalidate = 600;

export const metadata: Metadata = {
	// Titre complet (sans le suffixe du layout)
	title: { absolute: 'Cuisine Artisanale - Recettes traditionnelles françaises' },
	description: 'Recettes artisanales françaises authentiques : recette de la semaine, recettes populaires, actualités culinaires et carte des spécialités régionales.',
	alternates: { canonical: '/' },
	openGraph: {
		url: '/',
		title: 'Cuisine Artisanale - Recettes traditionnelles françaises',
		description: 'Recette de la semaine, recettes populaires et spécialités régionales françaises.',
	},
};

export default async function Page() {
	const [weekly, trending, posts] = await Promise.all([
		getWeeklyRecipe().catch((error) => {
			console.error('Recette de la semaine indisponible :', error);
			return null;
		}),
		getTrendingRecipes(4).catch((error) => {
			console.error('Recettes populaires indisponibles :', error);
			return [];
		}),
		getRecentPosts(30).catch((error) => {
			console.error('Posts indisponibles :', error);
			return [];
		}),
	]);

	return (
		<div className="Home">
			<h1 className="sr-only">Cuisine Artisanale : recettes traditionnelles françaises</h1>
			<WeeklyRecipe recipe={weekly} />
			<TrendingRecipes recipes={trending} />
			<PostsClient initialPosts={posts} />
		</div>
	);
}


