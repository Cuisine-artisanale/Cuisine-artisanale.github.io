'use client';

import React, { useSyncExternalStore } from 'react';
import './OfflineIndicator.css';

function subscribe(listener: () => void) {
	window.addEventListener('online', listener);
	window.addEventListener('offline', listener);
	return () => {
		window.removeEventListener('online', listener);
		window.removeEventListener('offline', listener);
	};
}

/** Pastille discrète quand le réseau est coupé : le carnet reste consultable, les modifications attendent */
const OfflineIndicator: React.FC = () => {
	const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
	if (online) return null;

	return (
		<div className="offline-indicator" role="status" title="Vos modifications seront envoyées au retour du réseau">
			<span className="pi pi-wifi" aria-hidden="true"></span>
			Hors ligne
		</div>
	);
};

export default OfflineIndicator;
