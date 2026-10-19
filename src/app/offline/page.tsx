import type { Metadata } from 'next';
import './offline.css';

export const metadata: Metadata = {
	title: 'Hors ligne',
	description: 'Pas de connexion : les recettes déjà consultées restent disponibles.',
	alternates: { canonical: '/offline' },
	robots: { index: false, follow: false },
};

/**
 * Liste des recettes gardées par le service worker (cache « pages »).
 * Script en ligne, sans React : hors ligne, le JavaScript de la page peut manquer au cache.
 */
const LIST_CACHED_RECIPES = `
(async function () {
	var list = document.getElementById('offline-recipes');
	var empty = document.getElementById('offline-empty');
	if (!list || !('caches' in window)) return;
	try {
		var names = (await caches.keys()).filter(function (n) { return n.indexOf('-pages-') !== -1; });
		var seen = {};
		var items = [];
		for (var i = 0; i < names.length; i++) {
			var cache = await caches.open(names[i]);
			var keys = await cache.keys();
			for (var j = keys.length - 1; j >= 0; j--) {
				var path = new URL(keys[j].url).pathname;
				if (!/^\\/recettes\\/[^/]+$/.test(path) || path === '/recettes/add-recipe' || path === '/recettes/edit' || seen[path]) continue;
				seen[path] = true;
				var html = await (await cache.match(keys[j])).text();
				var match = html.match(/<title>([^<]*)<\\/title>/i);
				var title = match ? match[1].replace(/\\s*\\|\\s*Cuisine Artisanale\\s*$/, '') : path.split('/').pop();
				var holder = document.createElement('textarea');
				holder.innerHTML = title;
				items.push({ path: path, title: holder.value });
			}
		}
		if (items.length === 0) return;
		items.forEach(function (item) {
			var li = document.createElement('li');
			var a = document.createElement('a');
			a.href = item.path;
			a.textContent = item.title;
			li.appendChild(a);
			list.appendChild(li);
		});
		list.hidden = false;
		if (empty) empty.hidden = true;
	} catch (e) {}
})();
// Servie à la place d'une autre page : « Réessayer » recharge la page demandée
var retry = document.querySelector('.offline-retry');
if (retry && location.pathname !== '/offline') retry.href = location.href;
window.addEventListener('online', function () { location.reload(); });
`;

export default function OfflinePage() {
	return (
		<div className="offline-page">
			<span className="pi pi-wifi offline-icon" aria-hidden="true"></span>
			<h1>Vous êtes hors ligne</h1>
			<p>Cette page n&apos;est pas disponible sans connexion. Elle s&apos;affichera dès que le réseau reviendra.</p>

			<section aria-labelledby="offline-recipes-title">
				<h2 id="offline-recipes-title">Recettes disponibles hors ligne</h2>
				<ul id="offline-recipes" className="offline-recipes" hidden></ul>
				<p id="offline-empty" className="offline-empty">
					Aucune recette pour l&apos;instant : celles que vous ouvrez avec une connexion restent ensuite consultables ici.
				</p>
			</section>

			{/* eslint-disable-next-line @next/next/no-html-link-for-pages -- hors ligne, un vrai chargement passe par le service worker */}
			<a href="/" className="offline-retry">
				<span className="pi pi-refresh" aria-hidden="true"></span> Réessayer
			</a>
			<script dangerouslySetInnerHTML={{ __html: LIST_CACHED_RECIPES }} />
		</div>
	);
}
