import React, { Suspense } from 'react';
import ActualitesClient from './ActualitesClient';
import PostsClient from './PostsClient';
import { TrendingRecipes } from '@/components/features';

export const metadata = {
	title: 'Accueil | Cuisine artisanale',
	description: 'Actualités et derniers posts sur la cuisine artisanale.',
};

export default function Page() {
	return (
		<div className="Home">
			<ActualitesClient />
			<TrendingRecipes />
			<PostsClient />
		</div>
	);
}


