import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
	title: 'Carte des recettes régionales',
	description: 'Explorez la carte de France des recettes artisanales : trouvez les spécialités culinaires de chaque département.',
	alternates: { canonical: '/map' },
	openGraph: {
		url: '/map',
		title: 'Carte des recettes régionales | Cuisine Artisanale',
		description: 'Les spécialités culinaires de chaque département sur une carte interactive.',
	},
};

export default function MapLayout({ children }: { children: ReactNode }) {
	return children;
}
