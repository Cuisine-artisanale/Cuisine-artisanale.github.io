import dynamic from 'next/dynamic';

// Désactiver le SSR pour cette page car Leaflet nécessite le navigateur
const RecetteMapWrapper = dynamic(() => import('./RecetteMapWrapper'), {
	ssr: false,
	loading: () => <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement de la carte...</div>
});

export const metadata = {
	title: "Carte des recettes | Cuisine artisanale",
	description: "Explorez les recettes sur la carte par département et type.",
};

// Désactiver le prerendering car Leaflet nécessite window
export const dynamic = 'force-dynamic';

export default function Page() {
	return <RecetteMapWrapper />;
}


