/**
 * Appel d'un modèle de langage (Gemini, puis OpenAI en secours) pour obtenir une réponse en JSON.
 * Configuration : AI_ENABLED=true, GEMINI_API_KEY et/ou OPENAI_API_KEY, GEMINI_MODEL / OPENAI_MODEL facultatifs.
 */

export interface AiJsonResult<T> {
	data: T | null;
	provider: 'gemini' | 'openai' | null;
	/** Raison de l'échec (IA désactivée, clé absente, crédit épuisé…) */
	error: string | null;
}

/** Extrait l'objet JSON d'une réponse, même entourée de texte ou de balises ```json. */
function parseJsonObject<T>(text: string): T | null {
	const first = text.indexOf('{');
	const last = text.lastIndexOf('}');
	if (first === -1 || last <= first) return null;
	try {
		return JSON.parse(text.slice(first, last + 1)) as T;
	} catch {
		return null;
	}
}

async function askGemini(apiKey: string, prompt: string, maxTokens: number): Promise<{ text: string | null; error: string | null }> {
	const models = Array.from(new Set([process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-3.5-flash-lite'].filter(Boolean))) as string[];
	const errors: string[] = [];

	for (const model of models) {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [{ parts: [{ text: prompt }] }],
					generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens },
				}),
			},
		);

		if (response.ok) {
			const data = await response.json();
			const text: string = (data?.candidates?.[0]?.content?.parts || []).map((part: { text?: string }) => part?.text || '').join('\n').trim();
			if (text) return { text, error: null };
			errors.push(`GEMINI_EMPTY(${model})`);
			continue;
		}

		const body = await response.text().catch(() => '');
		errors.push(`GEMINI_HTTP_${response.status}(${model}): ${body.replace(/\s+/g, ' ').slice(0, 160)}`);
		// Clé refusée, crédit épuisé, quota : inutile d'essayer un autre modèle
		if ([401, 402, 403, 429].includes(response.status)) break;
	}

	return { text: null, error: errors.join(' | ') };
}

async function askOpenAi(apiKey: string, system: string, user: string, maxTokens: number): Promise<{ text: string | null; error: string | null }> {
	const response = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
			temperature: 0.1,
			max_tokens: maxTokens,
			messages: [
				{ role: 'system', content: system },
				{ role: 'user', content: user },
			],
		}),
	});

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		return { text: null, error: `OPENAI_HTTP_${response.status}: ${body.replace(/\s+/g, ' ').slice(0, 160)}` };
	}

	const data = await response.json();
	const text = data?.choices?.[0]?.message?.content;
	return typeof text === 'string' && text.trim() ? { text, error: null } : { text: null, error: 'OPENAI_EMPTY' };
}

export async function askAiForJson<T>(system: string, user: string, maxTokens = 2000): Promise<AiJsonResult<T>> {
	if (process.env.AI_ENABLED !== 'true') return { data: null, provider: null, error: 'AI_DISABLED' };

	const geminiKey = process.env.GEMINI_API_KEY;
	const openAiKey = process.env.OPENAI_API_KEY;
	if (!geminiKey && !openAiKey) return { data: null, provider: null, error: 'MISSING_API_KEYS' };

	const errors: string[] = [];

	if (geminiKey) {
		try {
			const { text, error } = await askGemini(geminiKey, `${system}\n\n${user}`, maxTokens);
			const data = text ? parseJsonObject<T>(text) : null;
			if (data) return { data, provider: 'gemini', error: null };
			errors.push(error || 'GEMINI_NO_JSON');
		} catch {
			errors.push('GEMINI_FETCH_FAILED');
		}
	}

	if (openAiKey) {
		try {
			const { text, error } = await askOpenAi(openAiKey, system, user, maxTokens);
			const data = text ? parseJsonObject<T>(text) : null;
			if (data) return { data, provider: 'openai', error: null };
			errors.push(error || 'OPENAI_NO_JSON');
		} catch {
			errors.push('OPENAI_FETCH_FAILED');
		}
	}

	return { data: null, provider: null, error: errors.join(' | ') || 'AI_FAILED' };
}
