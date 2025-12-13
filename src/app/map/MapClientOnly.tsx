"use client";
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Composant qui charge RecetteMapClient uniquement après le montage côté client
export default function MapClientOnly() {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const RecetteMapClient = dynamic(() => import('./RecetteMapClient'), {
		ssr: false,
		loading: () => (
			<div style={{ padding: '2rem', textAlign: 'center', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
				<p>Chargement de la carte...</p>
			</div>
		)
	});

	if (!mounted) {
		return (
			<div style={{ padding: '2rem', textAlign: 'center', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
				<p>Chargement de la carte...</p>
			</div>
		);
	}

	return <RecetteMapClient />;
}

