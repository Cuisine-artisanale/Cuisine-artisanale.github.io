/**
 * ENREGISTREMENT DU SERVICE WORKER
 *
 * Ce fichier gère l'enregistrement du Service Worker pour la PWA
 */

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
	console.log('[SW] Service Worker non supporté');
	return;
  }

  window.addEventListener('load', () => {
	const swUrl = `/sw.js`;

	navigator.serviceWorker
	  .register(swUrl)
	  .then((registration) => {
		console.log('[SW] Service Worker enregistré avec succès:', registration.scope);

		// Vérifier les mises à jour toutes les heures
		setInterval(() => {
		  registration.update();
		}, 60 * 60 * 1000);

		// Écouter les mises à jour du SW
		registration.addEventListener('updatefound', () => {
		  const newWorker = registration.installing;

		  if (newWorker) {
			newWorker.addEventListener('statechange', () => {
			  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
				console.log('[SW] Nouvelle version disponible !');

				// Optionnel: Afficher une notification à l'utilisateur
				if (confirm('Une nouvelle version est disponible. Recharger la page ?')) {
				  newWorker.postMessage({ type: 'SKIP_WAITING' });
				  window.location.reload();
				}
			  }
			});
		  }
		});
	  })
	  .catch((error) => {
		console.error('[SW] Erreur lors de l\'enregistrement du Service Worker:', error);
	  });

	// Recharger la page quand un nouveau SW prend le contrôle
	let refreshing = false;
	navigator.serviceWorker.addEventListener('controllerchange', () => {
	  if (!refreshing) {
		refreshing = true;
		window.location.reload();
	  }
	});
  });
}

/**
 * Désinstaller le Service Worker (utile pour le debug)
 */
export async function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
	const registrations = await navigator.serviceWorker.getRegistrations();
	for (const registration of registrations) {
	  await registration.unregister();
	  console.log('[SW] Service Worker désinstallé');
	}

	// Vider les caches
	const cacheNames = await caches.keys();
	for (const name of cacheNames) {
	  await caches.delete(name);
	  console.log('[SW] Cache supprimé:', name);
	}
  }
}
