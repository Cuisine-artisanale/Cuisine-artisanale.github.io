import type { Metadata } from 'next';
import PostsClient from './PostsClient';
import TrendingRecipes from '@/components/features/TrendingRecipes/TrendingRecipes';
import WeeklyRecipe from '@/components/features/WeeklyRecipe/WeeklyRecipe';

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

export default function Page() {
	return (
		<div className="Home">
			<h1 className="sr-only">Cuisine Artisanale : recettes traditionnelles françaises</h1>
			<WeeklyRecipe />
			<TrendingRecipes />
			<PostsClient />
		</div>
	);
}


