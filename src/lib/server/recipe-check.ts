/**
 * Relecture d'une recette importée par Claude (Anthropic), avant de la proposer à l'utilisateur.
 * Claude compare le brouillon au texte source (légende TikTok + texte collé), corrige les erreurs
 * évidentes et signale ce qui reste à vérifier.
 *
 * Configuration : ANTHROPIC_API_KEY (sans clé, la relecture est simplement ignorée),
 * ANTHROPIC_MODEL facultatif (claude-haiku-5-5 par défaut).
 */
import Anthropic from '@anthropic-ai/sdk';
import type { ImportDraft } from '@/types/import.types';

const RECIPE_TYPES = ['Entrée', 'Plat', 'Dessert', 'Boisson'];

/** Valeurs brutes renvoyées par Claude, normalisées ensuite par l'appelant. */
export interface RecipeCheckResult {
	title: string;
	type: string;
	preparationTime: number;
	cookingTime: number;
	/** 0 si le nombre de personnes est inconnu */
	servings: number;
	ingredients: { name: string; quantity: string; unit: string }[];
	steps: string[];
	/** Corrections appliquées, en une phrase chacune */
	corrections: string[];
	/** Points que l'utilisateur doit vérifier lui-même */
	warnings: string[];
}

const SCHEMA = {
	type: 'object',
	properties: {
		title: { type: 'string' },
		type: { type: 'string', enum: RECIPE_TYPES },
		preparationTime: { type: 'integer' },
		cookingTime: { type: 'integer' },
		servings: { type: 'integer' },
		ingredients: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					quantity: { type: 'string' },
					unit: { type: 'string' },
				},
				required: ['name', 'quantity', 'unit'],
				additionalProperties: false,
			},
		},
		steps: { type: 'array', items: { type: 'string' } },
		corrections: { type: 'array', items: { type: 'string' } },
		warnings: { type: 'array', items: { type: 'string' } },
	},
	required: ['title', 'type', 'preparationTime', 'cookingTime', 'servings', 'ingredients', 'steps', 'corrections', 'warnings'],
	additionalProperties: false,
} as const;

const SYSTEM = `Tu relis des recettes de cuisine extraites automatiquement d'une vidéo TikTok, avant qu'un utilisateur ne les vérifie.
On te donne le texte source (légende de la vidéo, éventuellement complétée par l'utilisateur) et le brouillon extrait.

Renvoie le brouillon corrigé :
- Corrige uniquement les erreurs évidentes au regard du texte source : quantité ou unité mal lue, ingrédient oublié alors qu'il figure dans le texte ou dans les étapes, ingrédient en double, étape coupée ou en double, temps de préparation/cuisson incohérent avec les étapes, type de plat erroné, faute d'orthographe dans un nom d'ingrédient ou le titre.
- N'invente rien : si une information n'est pas dans le texte source, laisse la valeur du brouillon (0 ou vide si inconnue). Ne rajoute pas d'ingrédient « de bon sens » absent du texte.
- Garde le français, les unités françaises courtes (g, kg, ml, cl, l, c. à s., c. à c., pincée…) et la formulation de l'utilisateur quand elle est correcte.
- servings : nombre de personnes, 0 si inconnu. Temps en minutes.

Dans « corrections », décris chaque modification en une courte phrase (ex. « Quantité de farine corrigée : 250 g au lieu de 25 g »). Liste vide si rien n'a changé.
Dans « warnings », signale en une courte phrase ce que l'utilisateur devrait vérifier car le texte source ne permet pas de trancher (quantité manquante, temps de cuisson absent…). Trois points au maximum, liste vide si tout est clair.`;

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
	if (!process.env.ANTHROPIC_API_KEY) return null;
	// Relecture rapide : l'utilisateur attend la fin de l'analyse, inutile d'insister longtemps
	client ??= new Anthropic({ timeout: 25_000, maxRetries: 1 });
	return client;
}

export async function checkImportedRecipe(
	draft: ImportDraft,
	sourceText: string,
): Promise<{ result: RecipeCheckResult | null; error: string | null }> {
	const anthropic = getClient();
	if (!anthropic) return { result: null, error: 'MISSING_ANTHROPIC_API_KEY' };

	const extracted = {
		title: draft.title,
		type: draft.type,
		preparationTime: draft.preparationTime,
		cookingTime: draft.cookingTime,
		servings: draft.servings ?? 0,
		ingredients: draft.ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
		steps: draft.steps,
	};

	try {
		const response = await anthropic.messages.create({
			model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
			max_tokens: 8000,
			system: SYSTEM,
			output_config: {
				effort: 'low',
				format: { type: 'json_schema', schema: SCHEMA },
			},
			messages: [{
				role: 'user',
				content: `<texte_source>\n${sourceText.slice(0, 6000)}\n</texte_source>\n\n<brouillon>\n${JSON.stringify(extracted)}\n</brouillon>`,
			}],
		});

		if (response.stop_reason !== 'end_turn') {
			return { result: null, error: `ANTHROPIC_STOP_${response.stop_reason}` };
		}
		const text = response.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
		return { result: JSON.parse(text) as RecipeCheckResult, error: null };
	} catch (error) {
		if (error instanceof Anthropic.APIError) {
			return { result: null, error: `ANTHROPIC_HTTP_${error.status}: ${error.message.slice(0, 160)}` };
		}
		if (error instanceof SyntaxError) return { result: null, error: 'ANTHROPIC_INVALID_JSON' };
		return { result: null, error: 'ANTHROPIC_FETCH_FAILED' };
	}
}
