'use client';

import { Suspense } from 'react';
import RecettesClient from './RecettesClient';
import Breadcrumb from '@/components/layout/Breadcrumb/Breadcrumb';
import '@/components/layout/Breadcrumb/Breadcrumb.css';
import type { RecipesPage } from '@/lib/server/listings';

// Les anciennes URL /recettes?id=… sont redirigées côté serveur (app/recettes/page.tsx).
export default function RecettesWrapper({ initialPage }: { initialPage?: RecipesPage }) {
	return (
		<div>
			<Breadcrumb />
			<Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>}>
				<RecettesClient initialPage={initialPage} />
			</Suspense>
		</div>
	);
}
