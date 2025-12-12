"use client";
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Désactiver le SSR pour cette page car Leaflet nécessite le navigateur
const RecetteMapWrapper = dynamic(() => import('./RecetteMapWrapper'), {
	ssr: false,
	loading: () => <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement de la carte...</div>
});

export default function Page() {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement de la carte...</div>;
	}

	return <RecetteMapWrapper />;
}


