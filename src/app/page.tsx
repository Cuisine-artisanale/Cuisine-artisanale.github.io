import React, { Suspense } from 'react';
import PostsClient from './PostsClient';
import { TrendingRecipes, WeeklyRecipe } from '@/components/features';

export const metadata = {
	title: 'Accueil | Cuisine artisanale',
	description: 'Actualités et derniers posts sur la cuisine artisanale.',
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


