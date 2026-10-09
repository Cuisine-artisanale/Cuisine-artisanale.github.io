/**
 * SERVICE WORKER - Cuisine Artisanale PWA
 *
 * Ce service worker implémente une stratégie de cache pour améliorer
 * les performances et permettre un fonctionnement offline basique
 */

// Changer la version purge l'ancien cache à l'activation
const CACHE_VERSION = 'v2';
const CACHE_NAME = `cuisine-artisanale-${CACHE_VERSION}`;

// Fichiers à mettre en cache au premier chargement
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon.png',
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');

  event.waitUntil(
	caches.open(CACHE_NAME)
	  .then((cache) => {
		console.log('[SW] Mise en cache des assets statiques');
		return cache.addAll(STATIC_ASSETS);
	  })
	  .then(() => self.skipWaiting())
  );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');

  event.waitUntil(
	caches.keys()
	  .then((cacheNames) => {
		// Supprimer les anciens caches
		return Promise.all(
		  cacheNames
			.filter((name) => name.startsWith('cuisine-artisanale-') && name !== CACHE_NAME)
			.map((name) => {
			  console.log('[SW] Suppression du cache obsolète:', name);
			  return caches.delete(name);
			})
		);
	  })
	  .then(() => self.clients.claim())
  );
});

// Stratégie de cache: Network First, fallback sur Cache
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') return;

  // Ignorer les requêtes vers des domaines externes (sauf fonts/cdn)
  const url = new URL(request.url);
  if (url.origin !== location.origin && !url.hostname.includes('fonts.g')) {
	return;
  }

  // Jamais de cache pour les API, les données de navigation (RSC) et les images redimensionnées :
  // réponses personnelles ou très nombreuses, qui feraient grossir le cache sans limite
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/image') || url.searchParams.has('_rsc')) {
	return;
  }

  event.respondWith(
	fetch(request)
	  .then((response) => {
		// Si la réponse est valide, la mettre en cache
		if (response && response.status === 200) {
		  const responseClone = response.clone();
		  caches.open(CACHE_NAME).then((cache) => {
			cache.put(request, responseClone);
		  });
		}
		return response;
	  })
	  .catch(() => {
		// En cas d'échec réseau, fallback sur le cache
		return caches.match(request).then((cachedResponse) => {
		  if (cachedResponse) {
			console.log('[SW] Réponse depuis le cache:', request.url);
			return cachedResponse;
		  }

		  // Si pas de cache et requête HTML, retourner la page offline
		  if ((request.headers.get('accept') || '').includes('text/html')) {
			return caches.match('/');
		  }
		});
	  })
  );
});

// Gestion des messages depuis l'application
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
	self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
	caches.keys().then((cacheNames) => {
	  return Promise.all(
		cacheNames.map((name) => caches.delete(name))
	  );
	}).then(() => {
	  event.ports[0].postMessage({ success: true });
	});
  }
});
