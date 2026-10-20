/**
 * ENREGISTREMENT DU SERVICE WORKER
 *
 * Une nouvelle version du service worker s'active d'elle-même (skipWaiting dans sw.js),
 * sans recharger la page : aucune saisie en cours n'est perdue.
 */

export function registerServiceWorker() {
	if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
		return;
	}

	const register = () => {
		navigator.serviceWorker
			.register('/sw.js')
			.then((registration) => {
				// Vérifier les mises à jour toutes les heures
				setInterval(() => {
					registration.update().catch(() => {});
				}, 60 * 60 * 1000);
			})
			.catch((error) => {
				console.error('[SW] Erreur lors de l\'enregistrement du Service Worker:', error);
			});
	};

	// L'hydratation peut survenir après l'événement load : enregistrer tout de suite dans ce cas
	if (document.readyState === 'complete') {
		register();
	} else {
		window.addEventListener('load', register, { once: true });
	}
}

/**
 * Désinstaller le Service Worker (utile pour le debug)
 */
export async function unregisterServiceWorker() {
	if ('serviceWorker' in navigator) {
		const registrations = await navigator.serviceWorker.getRegistrations();
		for (const registration of registrations) {
			await registration.unregister();
		}

		// Vider les caches
		const cacheNames = await caches.keys();
		for (const name of cacheNames) {
			await caches.delete(name);
		}
	}
}
