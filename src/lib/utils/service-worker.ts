/**
 * ENREGISTREMENT DU SERVICE WORKER
 *
 * Une nouvelle version du service worker reste « en attente » : la bannière de mise à jour
 * (UpdateBanner) la signale et ne l'active qu'à la demande, puis la page se recharge.
 */

let waitingWorker: ServiceWorker | null = null;
const listeners = new Set<() => void>();
// Rechargement seulement après un clic sur « Mettre à jour » (jamais en pleine saisie)
let reloadOnControllerChange = false;

function setWaitingWorker(worker: ServiceWorker | null) {
  waitingWorker = worker;
  listeners.forEach((listener) => listener());
}

export function getWaitingWorker() {
  return waitingWorker;
}

export function subscribeWaitingWorker(listener: () => void) {
  listeners.add(listener);
  return () => {
	listeners.delete(listener);
  };
}

/** Active la version en attente ; la page se recharge quand elle prend le contrôle. */
export function applyUpdate() {
  if (!waitingWorker) return;
  reloadOnControllerChange = true;
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}

function watchInstalling(registration: ServiceWorkerRegistration) {
  const worker = registration.installing;
  if (!worker) return;
  worker.addEventListener('statechange', () => {
	// Sans contrôleur, c'est la toute première installation : rien à proposer
	if (worker.state === 'installed' && navigator.serviceWorker.controller) {
	  setWaitingWorker(worker);
	}
  });
}

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
	return;
  }

  const register = () => {
	navigator.serviceWorker
	  .register('/sw.js')
	  .then((registration) => {
		// Version déjà téléchargée lors d'une visite précédente
		if (registration.waiting && navigator.serviceWorker.controller) {
		  setWaitingWorker(registration.waiting);
		}
		registration.addEventListener('updatefound', () => watchInstalling(registration));

		// Vérifier les mises à jour toutes les heures
		setInterval(() => {
		  registration.update().catch(() => {});
		}, 60 * 60 * 1000);
	  })
	  .catch((error) => {
		console.error('[SW] Erreur lors de l\'enregistrement du Service Worker:', error);
	  });

	navigator.serviceWorker.addEventListener('controllerchange', () => {
	  if (!reloadOnControllerChange) return;
	  reloadOnControllerChange = false;
	  window.location.reload();
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
