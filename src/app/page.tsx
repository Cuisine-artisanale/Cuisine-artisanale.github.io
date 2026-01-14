import React, { Suspense } from 'react';
import PostsClient from './PostsClient';
import { TrendingRecipes, WeeklyRecipe } from '@/components/features';

export const metadata = {
	title: 'Accueil',
	description: 'Découvrez les dernières actualités culinaires, les recettes tendances et la recette de la semaine sur Cuisine Artisanale. Explorez la gastronomie française traditionnelle.',
	openGraph: {
		title: 'Accueil | Cuisine Artisanale',
		description: 'Découvrez les dernières actualités culinaires, les recettes tendances et la recette de la semaine sur Cuisine Artisanale.',
		url: 'https://www.cuisine-artisanale.fr/',
		images: [
			{
				url: 'https://www.cuisine-artisanale.fr/icon.png',
				width: 512,
				height: 512,
				alt: 'Cuisine Artisanale - Logo',
			},
		],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Accueil | Cuisine Artisanale',
		description: 'Découvrez les dernières actualités culinaires, les recettes tendances et la recette de la semaine sur Cuisine Artisanale.',
		images: ['https://www.cuisine-artisanale.fr/icon.png'],
	},
};

export default function Page() {
	return (
		<div className="Home">
			<WeeklyRecipe />
			<TrendingRecipes />
			<PostsClient />
		</div>
	);
}


