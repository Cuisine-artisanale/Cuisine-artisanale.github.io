import { Suspense } from "react";
import RecettesWrapper from "./RecettesWrapper";
import "./recettes-page.css";

export const metadata = {
	title: "Recettes | Cuisine artisanale",
	description: "Parcourez toutes les recettes par type, mots-clés et département.",
	openGraph: {
		title: "Recettes | Cuisine artisanale",
		description: "Parcourez toutes les recettes par type, mots-clés et département.",
		type: "website",
		url: "https://www.aymeric-sabatier.fr/Cuisine-artisanale/recettes",
	},
	twitter: {
		card: "summary_large_image",
		title: "Recettes | Cuisine artisanale",
		description: "Parcourez toutes les recettes par type, mots-clés et département.",
	},
};

export default function Page() {
	return (
		<Suspense fallback={<div style={{ padding: "2rem", textAlign: "center" }}>Chargement...</div>}>
			<RecettesWrapper />
		</Suspense>
	);
}


