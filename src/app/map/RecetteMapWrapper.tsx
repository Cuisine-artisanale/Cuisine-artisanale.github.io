"use client";

import { Breadcrumb } from "@/components/layout";
import "@/components/layout/Breadcrumb/Breadcrumb.css";
import 'leaflet/dist/leaflet.css';
import RecetteMapClient from "./RecetteMapClient";

export default function RecetteMapWrapper() {
	return (
		<div>
			<Breadcrumb />
			<RecetteMapClient />
		</div>
	);
}
