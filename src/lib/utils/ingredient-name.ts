/**
 * Noms d'ingrédients : comparaison et mise en forme, communes au navigateur et au serveur.
 */

/**
 * Clé de comparaison d'un nom : minuscules, sans accents, espaces, points ni ligatures
 * (« Œufs » = « oeuf »), pluriel simple ignoré. Deux noms de même clé désignent le même ingrédient.
 */
export function ingredientNameKey(name: string | undefined | null): string {
	return (name || '')
		.toLowerCase()
		.replace(/œ/g, 'oe')
		.replace(/æ/g, 'ae')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[\s.'’-]/g, '')
		.replace(/s$/, '');
}

/**
 * Mise en forme d'un nom pour le catalogue : espaces superflus retirés, article de liaison
 * initial supprimé (« de farine » → « Farine »), première lettre en majuscule.
 */
export function formatIngredientName(name: string): string {
	const cleaned = name
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^(?:de\s+la\s+|de\s+l['’]\s*|de\s+|du\s+|des\s+|d['’]\s*)/i, '')
		.replace(/[\s.,;:]+$/, '')
		.trim();
	return cleaned ? cleaned.charAt(0).toLocaleUpperCase('fr-FR') + cleaned.slice(1) : '';
}
