'use client';

import { Suspense } from 'react';
import RecettesClient from './RecettesClient';
import Breadcrumb from '@/components/layout/Breadcrumb/Breadcrumb';
import '@/components/layout/Breadcrumb/Breadcrumb.css';
import type { RecipeCardData, RecipesPage } from '@/lib/server/listings';

// Les anciennes URL /recettes?id=… sont redirigées côté serveur (app/recettes/page.tsx).
interface RecettesWrapperProps {
	initialPage?: RecipesPage;
	newRecipes: RecipeCardData[];
	seed: number;
}

export default function RecettesWrapper({ initialPage, newRecipes, seed }: RecettesWrapperProps) {
	return (
		<div>
			<Breadcrumb />
			<Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>}>
				<RecettesClient initialPage={initialPage} newRecipes={newRecipes} seed={seed} />
			</Suspense>
		</div>
	);
}
