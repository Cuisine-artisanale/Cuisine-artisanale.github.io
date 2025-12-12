"use client";

import { Breadcrumb } from "@/components/layout";
import "@/components/layout/Breadcrumb/Breadcrumb.css";
import MapClientOnly from './MapClientOnly';

export default function RecetteMapWrapper() {
	return (
		<div>
			<Breadcrumb />
			<MapClientOnly />
		</div>
	);
}
