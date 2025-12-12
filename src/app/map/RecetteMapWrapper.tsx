"use client";

import { Breadcrumb } from "@/components/layout";
import "@/components/layout/Breadcrumb/Breadcrumb.css";
import dynamic from 'next/dynamic';

// Charger le composant de carte uniquement côté client pour éviter les problèmes avec Leaflet
const RecetteMapClient = dynamic(() => import('./RecetteMapClient'), {
	ssr: false,
	loading: () => (
		<div style={{ padding: '2rem', textAlign: 'center', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
			<p>Chargement de la carte...</p>
		</div>
	)
});

export default function RecetteMapWrapper() {
	return (
		<div>
			<Breadcrumb />
			<RecetteMapClient />
		</div>
	);
}
