'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import RecettesClient from './RecettesClient';
import RecetteDesc from '@/components/features/RecetteDesc/RecetteDesc';
import Breadcrumb from '@/components/layout/Breadcrumb/Breadcrumb';
import '@/components/layout/Breadcrumb/Breadcrumb.css';
import { db } from '@/lib/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { RecipesPage } from '@/lib/server/listings';

export default function RecettesWrapper({ initialPage }: { initialPage?: RecipesPage }) {
	const searchParams = useSearchParams();
	const recipeId = searchParams?.get('id');
	const router = useRouter();

	// Redirection des anciennes URLs avec query params vers les nouvelles URLs avec slugs
	useEffect(() => {
		const redirectToSlug = async () => {
			if (recipeId) {
				try {
					const recipeRef = doc(db, 'recipes', recipeId);
					const recipeSnap = await getDoc(recipeRef);

					if (recipeSnap.exists()) {
						const recipe = recipeSnap.data();
						const slug = recipe.url || recipeId;
						// Rediriger vers la nouvelle URL avec slug
						router.replace(`/recettes/${slug}`);
					}
				} catch (error) {
					console.error('Error redirecting to slug:', error);
				}
			}
		};

		redirectToSlug();
	}, [recipeId, router]);

	return (
		<div>
			<Breadcrumb />
			<Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>}>
				{recipeId ? <RecetteDesc recipeId={recipeId} /> : <RecettesClient initialPage={initialPage} />}
			</Suspense>
		</div>
	);
}
