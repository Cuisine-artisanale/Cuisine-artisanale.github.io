"use client";

import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/layout";
import "@/components/layout/Breadcrumb/Breadcrumb.css";

export default function RecetteMapWrapper() {
	const [RecetteMap, setRecetteMap] = useState(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		// Only import on client side
		import("@/pages-legacy/RecetteMap/RecetteMap").then((module) => {
			setRecetteMap(() => module.default);
			setIsLoading(false);
		});
	}, []);

	if (isLoading) {
		return <div style={{ padding: "2rem", textAlign: "center" }}>Chargement de la carte...</div>;
	}

	if (!RecetteMap) {
		return <div>Erreur lors du chargement de la carte</div>;
	}

	return (
		<div>
			<Breadcrumb />
			<RecetteMap />
		</div>
	);
}
