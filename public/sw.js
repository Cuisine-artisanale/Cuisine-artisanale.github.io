/**
 * SERVICE WORKER - Cuisine Artisanale PWA
 *
 * - Fichiers du build (/_next/static) : cache d'abord, leurs noms changent à chaque version
 * - Pages : réseau d'abord, copie des 50 dernières pages visitées pour le hors-ligne
 * - Autres fichiers du site (icônes, images de /public) : réseau d'abord, 60 au plus
 * - Sans réseau ni copie : page /offline (liste des recettes consultables)
 *
 * Une nouvelle version s'active dès son installation, sans recharger la page ouverte :
 * elle sert simplement les requêtes suivantes (aucune saisie en cours n'est perdue).
 */

// Changer la version purge les anciens caches à l'activation
const VERSION = 'v3';
const SHELL_CACHE = `cuisine-artisanale-shell-${VERSION}`;
const STATIC_CACHE = `cuisine-artisanale-static-${VERSION}`;
const PAGES_CACHE = `cuisine-artisanale-pages-${VERSION}`;
const ASSETS_CACHE = `cuisine-artisanale-assets-${VERSION}`;
const IMAGES_CACHE = `cuisine-artisanale-images-${VERSION}`;
const STORAGE_IMAGES_CACHE = `cuisine-artisanale-storage-images-${VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE, PAGES_CACHE, ASSETS_CACHE, IMAGES_CACHE, STORAGE_IMAGES_CACHE];

const OFFLINE_URL = '/offline';
const SHELL_ASSETS = [OFFLINE_URL, '/manifest.json', '/pwa/icon-192.png', '/icon.png'];

const MAX_PAGES = 50;
const MAX_STATIC = 200;
const MAX_ASSETS = 60;
// Photos des recettes (carnet, favoris) : images redimensionnées par Next, puis photos
// Firebase Storage. Ces dernières sont « opaques » (autre domaine) et comptent plus lourd
// dans le quota de stockage du navigateur : on en garde moins.
const MAX_IMAGES = 80;
const MAX_STORAGE_IMAGES = 40;

// Pages jamais copiées : saisies, connexion, administration
const NO_CACHE_PAGES = ['/recettes/add-recipe', '/recettes/edit', '/login', '/admin-panel', '/reset-password', '/verify-email'];

/** Page hors ligne + ses fichiers CSS/JS : sans eux elle s'afficherait sans mise en forme */
async function precacheShell() {
  const shell = await caches.open(SHELL_CACHE);
  await shell.addAll(SHELL_ASSETS);
  const offline = await shell.match(OFFLINE_URL);
  const html = offline ? await offline.text() : '';
  const files = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+\.(?:css|js)/g) || [])];
  // Dans le cache « shell », jamais réduit (le cache static, lui, ne garde que les 200 derniers)
  await Promise.all(files.map((file) => shell.add(file).catch(() => {})));
  // Fichiers d'un build précédent : retirés
  const keep = new Set([...SHELL_ASSETS, ...files]);
  const keys = await shell.keys();
  await Promise.all(keys.filter((key) => !keep.has(new URL(key.url).pathname)).map((key) => shell.delete(key)));
}

self.addEventListener('install', (event) => {
	event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
	caches.keys()
	  .then((names) => Promise.all(
		names
		  .filter((name) => name.startsWith('cuisine-artisanale-') && !CURRENT_CACHES.includes(name))
		  .map((name) => caches.delete(name))
	  ))
	  .then(() => self.clients.claim())
  );
});

/** Garde les `max` entrées les plus récentes (l'ordre des clés est celui d'insertion) */
async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((key) => cache.delete(key)));
}

async function putInCache(cacheName, request, response, max) {
  const cache = await caches.open(cacheName);
  // Supprimer puis remettre : l'entrée repasse en fin de liste (la plus récente)
  await cache.delete(request);
  await cache.put(request, response);
  await trimCache(cacheName, max);
}

async function cacheFirst(request, cacheName, max) {
	const cached = await caches.match(request);
	if (cached) return cached;
	const response = await fetch(request);
	// Réponse « opaque » : image d'un autre domaine chargée sans CORS, son statut n'est pas lisible
	if (response.ok || response.type === 'opaque') putInCache(cacheName, request, response.clone(), max);
	return response;
}

async function networkFirst(request, cacheName, max) {
  try {
	const response = await fetch(request);
	if (response.ok && response.type === 'basic') putInCache(cacheName, request, response.clone(), max);
	return response;
  } catch (error) {
	const cached = await caches.match(request, { ignoreVary: true });
	if (cached) return cached;
	throw error;
  }
}

async function handleNavigation(request, url) {
  const cacheable = !NO_CACHE_PAGES.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`));
  try {
	const response = await fetch(request);
	// Copie sans les paramètres : une recette consultée via ?utm=… reste retrouvable hors ligne
	if (cacheable && response.ok && response.type === 'basic') {
	  putInCache(PAGES_CACHE, new Request(url.origin + url.pathname), response.clone(), MAX_PAGES);
	}
	return response;
  } catch {
	const cached = await caches.match(url.origin + url.pathname, { ignoreVary: true });
	return cached || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);

	// Polices Google : cache d'abord (fichiers versionnés)
	if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
		event.respondWith(cacheFirst(request, STATIC_CACHE, MAX_STATIC));
		return;
	}
	// Photos Firebase Storage (recettes du carnet, miniatures TikTok importées)
	if (url.hostname === 'firebasestorage.googleapis.com' && request.destination === 'image') {
		event.respondWith(cacheFirst(request, STORAGE_IMAGES_CACHE, MAX_STORAGE_IMAGES));
		return;
	}
	if (url.origin !== location.origin) return;

	// Images redimensionnées par Next : même adresse = même image, cache d'abord
	if (url.pathname.startsWith('/_next/image')) {
		event.respondWith(cacheFirst(request, IMAGES_CACHE, MAX_IMAGES));
		return;
	}

	// Jamais de cache pour les API et les données de navigation (RSC) : réponses personnelles
	if (
		url.pathname.startsWith('/api/') ||
		url.searchParams.has('_rsc') ||
		request.headers.get('RSC') === '1'
	) {
		return;
	}

	if (request.mode === 'navigate') {
		event.respondWith(handleNavigation(request, url));
		return;
	}

	if (url.pathname.startsWith('/_next/static/')) {
		event.respondWith(cacheFirst(request, STATIC_CACHE, MAX_STATIC));
		return;
	}

	// Le service worker lui-même est géré par le navigateur
	if (url.pathname === '/sw.js') return;

	event.respondWith(networkFirst(request, ASSETS_CACHE, MAX_ASSETS));
});

self.addEventListener('message', (event) => {
	// Envoyé par les anciennes versions de l'app (bannière de mise à jour retirée)
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}

	if (event.data && event.data.type === 'CLEAR_CACHE') {
		caches.keys()
			.then((names) => Promise.all(names.map((name) => caches.delete(name))))
			.then(() => event.ports[0]?.postMessage({ success: true }));
	}
});
