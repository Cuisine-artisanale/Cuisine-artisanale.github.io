import type { Metadata } from "next";
import { Suspense } from "react";
import RecettesWrapper from "./RecettesWrapper";
import { permanentRedirect } from "next/navigation";
import { getFirstRecipesPage, getRecipeSlugById } from "@/lib/server/listings";
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

interface PageProps {
	searchParams: Promise<{ id?: string; type?: string; position?: string; keywords?: string }>;
}

// Rendu à chaque requête (les filtres sont dans l'URL) ; la première page de recettes est en cache 10 min.
export default async function Page({ searchParams }: PageProps) {
	const { id, type, position, keywords } = await searchParams;

	// Anciennes URL /recettes?id=… : redirection permanente (308) vers /recettes/{slug}
	if (id) {
		const slug = await getRecipeSlugById(id).catch(() => null);
		if (slug) permanentRedirect(`/recettes/${slug}`);
	}

	const hasFilters = Boolean(type || position || keywords);
	const initialPage = hasFilters
		? undefined
		: await getFirstRecipesPage().catch((error) => {
				console.error('Liste des recettes indisponible côté serveur :', error);
				return undefined;
			});

	return (
		<>
		<h1 className="sr-only">Toutes les recettes artisanales françaises</h1>
		<Suspense fallback={<div style={{ padding: "2rem", textAlign: "center" }}>Chargement...</div>}>
			<RecettesWrapper initialPage={initialPage} />
		</Suspense>
		</>
	);
}


