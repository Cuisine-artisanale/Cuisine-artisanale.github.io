import type { Metadata } from "next";
import { Suspense } from "react";
import RecettesWrapper from "./RecettesWrapper";
import "./recettes-page.css";

export const metadata: Metadata = {
	title: 'Toutes les recettes',
	description: 'Parcourez toutes les recettes artisanales françaises : entrées, plats, desserts et boissons, à filtrer par type, mots-clés et département.',
	alternates: { canonical: '/recettes' },
	openGraph: {
		url: '/recettes',
		title: 'Toutes les recettes | Cuisine Artisanale',
		description: 'Entrées, plats, desserts et boissons : toutes les recettes artisanales françaises.',
	},
};

export default function Page() {
	return (
		<>
		<h1 className="sr-only">Toutes les recettes artisanales françaises</h1>
		<Suspense fallback={<div style={{ padding: "2rem", textAlign: "center" }}>Chargement...</div>}>
			<RecettesWrapper />
		</Suspense>
		</>
	);
}


