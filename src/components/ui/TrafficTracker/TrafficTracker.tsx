"use client";
import { useEffect } from 'react';
import { trackVisit } from '@/lib/analytics/track';

/** Compte l'arrivée sur le site (mesure d'audience sans cookie, voir src/lib/analytics/track.ts). */
export default function TrafficTracker() {
	useEffect(() => {
		trackVisit();
	}, []);

	return null;
}
