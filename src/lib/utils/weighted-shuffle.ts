/**
 * Mélange aléatoire pondéré : tout est mélangé, mais un élément de poids élevé a plus de chances
 * d'arriver en tête (méthode d'Efraimidis–Spirakis : clé = hasard^(1 / poids), tri décroissant).
 *
 * Le hasard vient d'une graine : la même graine redonne le même ordre. Le serveur tire une graine
 * par affichage de la liste, et les pages suivantes la réutilisent pour prolonger le même mélange.
 */

/** Générateur pseudo-aléatoire déterministe (mulberry32), valeurs dans ]0, 1[. */
function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return (((t ^ (t >>> 14)) >>> 0) + 1) / 4294967297;
	};
}

export function weightedShuffle<T>(items: T[], weightOf: (item: T) => number, seed: number): T[] {
	const random = seededRandom(seed);
	return items
		.map((item) => {
			const weight = Math.max(weightOf(item), 1e-6);
			return { item, key: Math.pow(random(), 1 / weight) };
		})
		.sort((a, b) => b.key - a.key)
		.map(({ item }) => item);
}

/** Nouvelle graine de mélange (entier positif) */
export function newShuffleSeed(): number {
	return Math.floor(Math.random() * 2 ** 31);
}

/**
 * Cookie de session qui garde la graine pendant la visite : la liste des recettes garde le même
 * ordre quand on y revient. Supprimé à la fermeture du navigateur ; ne contient qu'un nombre au hasard.
 */
export const SHUFFLE_SEED_COOKIE = 'ca_shuffle_seed';

/** Graine lue dans le cookie, ou null si absente ou invalide */
export function parseShuffleSeed(value: string | undefined): number | null {
	const n = Number(value);
	return value && Number.isInteger(n) && n >= 0 && n < 2 ** 31 ? n : null;
}
