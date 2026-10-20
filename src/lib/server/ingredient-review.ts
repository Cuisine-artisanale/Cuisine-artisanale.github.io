/**
 * Vérification du catalogue d'ingrédients (collection "ingredients"), lancée chaque semaine.
 *
 * Trois contrôles :
 *  - mise en forme des noms (majuscule, espaces, « de farine » → « Farine ») ;
 *  - doublons (même nom à l'accent ou au pluriel près) ;
 *  - orthographe, par l'IA quand elle est disponible.
 *
 * Rien n'est modifié dans le catalogue : chaque anomalie devient une proposition dans
 * "ingredientSuggestions", que l'admin applique ou ignore depuis la page Ingrédients.
 * Une proposition déjà traitée (appliquée ou ignorée) n'est jamais reproposée.
 */
import { createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdminDb } from '@/lib/config/firebase-admin';
import { askAiForJson } from '@/lib/server/ai';
import { formatIngredientName, ingredientNameKey } from '@/lib/utils/ingredient-name';

export type IngredientSuggestionType = 'rename' | 'duplicate';

interface NewSuggestion {
	type: IngredientSuggestionType;
	/** D'où vient la proposition */
	source: 'format' | 'duplicate' | 'ai';
	/** Fiche à renommer, ou fiche conservée pour un doublon */
	ingredientId: string;
	currentName: string;
	/** Nouveau nom proposé (type "rename") */
	suggestedName?: string;
	/** Fiches à fusionner dans `ingredientId` (type "duplicate") */
	duplicates?: { id: string; name: string }[];
	reason: string;
}

export interface IngredientReviewResult {
	checked: number;
	/** Nouvelles propositions enregistrées */
	created: number;
	/** Propositions en attente au total */
	pending: number;
	aiUsed: boolean;
	aiError: string | null;
}

/** Distance d'édition entre deux textes (nombre de caractères à changer). */
function editDistance(a: string, b: string): number {
	const row = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		let previous = row[0];
		row[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const current = row[j];
			row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
			previous = current;
		}
	}
	return row[b.length];
}

function suggestionId(suggestion: NewSuggestion): string {
	const target = suggestion.type === 'rename'
		? suggestion.suggestedName
		: (suggestion.duplicates || []).map((d) => d.id).sort().join(',');
	return createHash('sha1').update(`${suggestion.type}|${suggestion.ingredientId}|${target}`).digest('hex').slice(0, 32);
}

interface AiCorrections {
	corrections?: { id?: string; correction?: string; reason?: string }[];
}

/** Fautes d'orthographe relevées par l'IA, par lots de 150 noms. */
async function findSpellingMistakes(ingredients: { id: string; name: string }[]) {
	const suggestions: NewSuggestion[] = [];
	let aiUsed = false;
	let aiError: string | null = null;

	const system = "Tu es correcteur orthographique pour un site de recettes de cuisine en français. Réponds uniquement en JSON valide.";

	for (let start = 0; start < ingredients.length; start += 150) {
		const batch = ingredients.slice(start, start + 150);
		const user = [
			"Voici des noms d'ingrédients, un par ligne, au format « id | nom ».",
			"Relève UNIQUEMENT ceux qui contiennent une faute d'orthographe, d'accent ou de frappe certaine.",
			"Ne change ni le sens, ni le singulier/pluriel, ni la formulation. Ignore les noms corrects, les marques et les mots étrangers usuels (cheddar, mozzarella, curry…).",
			'Format de réponse : {"corrections":[{"id":"…","correction":"nom corrigé","reason":"explication courte"}]}',
			'Si tout est correct : {"corrections":[]}',
			'',
			...batch.map((ingredient) => `${ingredient.id} | ${ingredient.name}`),
		].join('\n');

		const result = await askAiForJson<AiCorrections>(system, user, 3000);
		if (!result.data) {
			aiError = result.error;
			break; // IA indisponible : inutile d'envoyer les lots suivants
		}
		aiUsed = true;

		const byId = new Map(batch.map((ingredient) => [ingredient.id, ingredient]));
		for (const item of result.data.corrections || []) {
			const ingredient = item?.id ? byId.get(item.id) : undefined;
			const correction = formatIngredientName(String(item?.correction || ''));
			if (!ingredient || !correction || correction === ingredient.name) continue;

			// Garde-fou : une correction d'orthographe reste proche du nom d'origine
			const distance = editDistance(ingredient.name.toLowerCase(), correction.toLowerCase());
			if (distance === 0 || distance > Math.max(2, Math.ceil(ingredient.name.length * 0.3))) continue;

			suggestions.push({
				type: 'rename',
				source: 'ai',
				ingredientId: ingredient.id,
				currentName: ingredient.name,
				suggestedName: correction,
				reason: String(item?.reason || 'Faute probable').slice(0, 200),
			});
		}
	}

	return { suggestions, aiUsed, aiError };
}

export async function runIngredientReview(options: { dryRun?: boolean } = {}): Promise<IngredientReviewResult & { preview?: NewSuggestion[] }> {
	const db = getFirebaseAdminDb();

	const [ingredientsSnap, recipesSnap, requestsSnap] = await Promise.all([
		db.collection('ingredients').select('name').get(),
		db.collection('recipes').select('recipeParts').get(),
		db.collection('recipesRequest').select('recipeParts').get(),
	]);

	const ingredients = ingredientsSnap.docs
		.map((d) => ({ id: d.id, name: String(d.get('name') || '') }))
		.filter((ingredient) => ingredient.name.trim());

	// Nombre de recettes utilisant chaque fiche : pour un doublon, on garde la plus utilisée
	const usage = new Map<string, number>();
	for (const doc of [...recipesSnap.docs, ...requestsSnap.docs]) {
		const parts = doc.get('recipeParts');
		for (const part of Array.isArray(parts) ? parts : []) {
			for (const ingredient of Array.isArray(part?.ingredients) ? part.ingredients : []) {
				if (typeof ingredient?.id === 'string') usage.set(ingredient.id, (usage.get(ingredient.id) || 0) + 1);
			}
		}
	}

	const suggestions: NewSuggestion[] = [];

	// 1. Mise en forme
	const formatted = ingredients.map((ingredient) => ({ ...ingredient, formatted: formatIngredientName(ingredient.name) }));
	for (const ingredient of formatted) {
		if (ingredient.formatted && ingredient.formatted !== ingredient.name) {
			suggestions.push({
				type: 'rename',
				source: 'format',
				ingredientId: ingredient.id,
				currentName: ingredient.name,
				suggestedName: ingredient.formatted,
				reason: 'Mise en forme du nom (majuscule, espaces, article initial)',
			});
		}
	}

	// 2. Doublons
	const groups = new Map<string, { id: string; name: string }[]>();
	for (const ingredient of ingredients) {
		const key = ingredientNameKey(formatIngredientName(ingredient.name));
		if (!key) continue;
		groups.set(key, [...(groups.get(key) || []), ingredient]);
	}
	for (const group of groups.values()) {
		if (group.length < 2) continue;
		const [kept, ...duplicates] = [...group].sort((a, b) => (usage.get(b.id) || 0) - (usage.get(a.id) || 0) || a.id.localeCompare(b.id));
		suggestions.push({
			type: 'duplicate',
			source: 'duplicate',
			ingredientId: kept.id,
			currentName: kept.name,
			duplicates,
			reason: `Même ingrédient enregistré ${group.length} fois`,
		});
	}

	// 3. Orthographe (IA), sur les noms déjà mis en forme
	const spelling = await findSpellingMistakes(formatted.map((ingredient) => ({ id: ingredient.id, name: ingredient.formatted || ingredient.name })));
	suggestions.push(...spelling.suggestions);

	// Essai à blanc : les propositions sont renvoyées sans être enregistrées
	if (options.dryRun) {
		return { checked: ingredients.length, created: 0, pending: 0, aiUsed: spelling.aiUsed, aiError: spelling.aiError, preview: suggestions };
	}

	// Enregistrement : seules les propositions jamais vues sont créées
	let created = 0;
	for (const suggestion of suggestions) {
		const ref = db.collection('ingredientSuggestions').doc(suggestionId(suggestion));
		try {
			await ref.create({ ...suggestion, status: 'pending', createdAt: FieldValue.serverTimestamp() });
			created += 1;
		} catch (error) {
			// Code 6 (ALREADY_EXISTS) : proposition déjà en attente, appliquée ou ignorée
			if ((error as { code?: number })?.code !== 6) throw error;
		}
	}

	const pending = await db.collection('ingredientSuggestions').where('status', '==', 'pending').count().get();

	return {
		checked: ingredients.length,
		created,
		pending: pending.data().count,
		aiUsed: spelling.aiUsed,
		aiError: spelling.aiError,
	};
}
