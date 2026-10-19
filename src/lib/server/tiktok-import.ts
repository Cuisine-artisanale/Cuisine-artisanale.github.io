/**
 * Import d'une recette depuis une vidéo TikTok, en deux temps :
 *  1. analyzeTikTokVideo : lit la légende de la vidéo (oEmbed) et en extrait un brouillon
 *     de recette (IA si disponible, sinon règles simples). Rien n'est enregistré.
 *  2. saveTikTokDraft : enregistre le brouillon relu par l'utilisateur dans "recipesRequest"
 *     (modération), avec une copie de la miniature dans le stockage du site.
 */
import { randomUUID } from 'crypto';
import { unstable_cache } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdminBucket, getFirebaseAdminDb } from '@/lib/config/firebase-admin';
import { getUnits } from '@/lib/server/units';
import { slugify } from '@/lib/utils/slug';
import { buildUnitIndex, normalizeUnitKey, resolveUnit, type UnitIndex } from '@/lib/utils/units';
import { ingredientNameKey as ingredientKey } from '@/lib/utils/ingredient-name';
import type { ImportDraft, ImportDraftIngredient } from '@/types/import.types';

export const RECIPE_TYPES = ['Entrée', 'Plat', 'Dessert', 'Boisson'];
const FALLBACK_STEP = 'Voir la vidéo TikTok pour la préparation détaillée.';

type TikTokOEmbedResponse = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
};

type ParsedIngredient = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
};

type AiIngredient = {
  name?: string;
  quantity?: string | number;
  unit?: string;
};

type AiRecipeEnrichment = {
  title?: string;
  slugTitle?: string;
  type?: string;
  preparationTime?: number | string;
  cookingTime?: number | string;
  servings?: number | string;
  ingredients?: AiIngredient[];
  steps?: string[];
};

export function isValidTikTokUrl(url: string) {
  return /^(https?:\/\/)?(www\.)?(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)\/.+$/i.test(url);
}

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

function extractTikTokVideoId(url: string) {
  const match = url.match(/\/video\/(\d+)/i);
  return match?.[1] || null;
}

function cleanCaption(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function toTitleCase(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeTextForParsing(text: string) {
  return text
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/#[^\s#]+/g, ' ')
    .replace(/@[^\s@]+/g, ' ')
    .replace(/[|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildRecipeTitleFromCaption(rawCaption: string) {
  const cleaned = normalizeTextForParsing(rawCaption)
    .replace(/\b(?:original sound|son original)\b.*$/i, '')
    .replace(/[^\p{L}\p{N}\s'!?.,-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return 'Recette TikTok importee';

  const sentimentCutPatterns = [
    /\bj['’`]?aime\b/i,
    /\b(?:ca|ça)\b/i,
    /\bje\s+vous\s+laisse\b/i,
    /\bdis[-\s]?moi\b/i,
    /\btu\s+valide[s]?\b/i,
    /\bteam\b/i,
    /\babonne[-\s]?toi\b/i,
    /\blike\b/i,
  ];

  let candidate = cleaned;
  for (const pattern of sentimentCutPatterns) {
    const match = candidate.match(pattern);
    if (match && typeof match.index === 'number' && match.index > 8) {
      candidate = candidate.slice(0, match.index).trim();
      break;
    }
  }

  // Garde la partie avant la première grosse ponctuation si elle ressemble à un nom de plat.
  const beforePunctuation = candidate.split(/[!?]/)[0]?.trim() || candidate;
  candidate = beforePunctuation.length >= 6 ? beforePunctuation : candidate;

  candidate = candidate
    .replace(/\b(?:recette|facile|rapide|maison|tiktok)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!candidate) return 'Recette TikTok importee';

  // Limite de longueur UX (titre exploitable dans la liste/admin).
  const shortTitle = candidate.slice(0, 70).trim();
  return toTitleCase(shortTitle);
}

function isLikelyTruncatedTitle(title: string) {
  const words = cleanCaption(title).toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 3) return true;

  const last = words[words.length - 1] || '';
  const prev = words[words.length - 2] || '';
  const connectors = new Set(['a', 'à', 'au', 'aux', 'de', 'du', 'des', 'la', 'le', 'les', 'et', 'ou']);

  if (connectors.has(last)) return true;
  if (last.length <= 2 && connectors.has(prev)) return true;

  return false;
}

function selectBestRecipeTitle(aiTitle: string, heuristicTitle: string) {
  if (!aiTitle) return heuristicTitle;
  if (!isLikelyTruncatedTitle(aiTitle)) return aiTitle;

  // Si l'IA renvoie un titre tronqué ("... a la po"), on préfère l'heuristique.
  if (heuristicTitle && heuristicTitle.length >= aiTitle.length) {
    return heuristicTitle;
  }

  return aiTitle;
}

function sanitizeRecipeTitle(rawTitle: string) {
  const cleaned = cleanCaption(rawTitle)
    .replace(/```(?:json)?/gi, ' ')
    .replace(/^[`'".\s-]+/, '')
    .replace(/\bjson\b[:\s-]*/gi, '')
    .replace(/\s+/g, ' ')
	.replace(/Title": /i, '')
	.replace(/"/g, '')
    .trim();

  if (!cleaned) return '';
  return toTitleCase(cleaned).slice(0, 70).trim();
}

function sanitizeSlugTitle(rawTitle: string) {
  const cleaned = sanitizeRecipeTitle(rawTitle)
    .replace(
      /\b(?:ca|ça|j['’`]?aime|je\s+vous\s+laisse|dis[-\s]?moi|tu\s+valide[s]?|team|abonne[-\s]?toi|like)\b[\s\S]*$/i,
      '',
    )
    .replace(/^\s*(?:les|le|la|des|du|de)\s+/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';
  return toTitleCase(cleaned).slice(0, 60).trim();
}

function extractIngredientsFromText(text: string) {
  const cleaned = normalizeTextForParsing(text);
  const stopwordOnlyPattern =
    /^(les?|la|le|des|de|du|un|une|je|tu|il|elle|on|nous|vous|ils|elles|ou|et|avec|sans|pour|dans|sur|a|au|aux|j|l)$/i;
  const likelyVerbPattern =
    /\b(aime|adore|juge|valide|laisse|croustille|regarde|abonne|like|partage|teste)\b/i;
  const ingredientRegex =
    /\b(\d+(?:[.,]\d+)?|1\/2|1\/3|1\/4|2\/3|3\/4)?\s*(g|kg|ml|l|cl|cas|cac|c\.?à\.?s|c\.?à\.?c|cuill[eè]re?s?|tasse?s?|pinc[ée]e?s?)?\s*([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ' -]{1,45})/gi;

  const seen = new Set<string>();
  const ingredients: ParsedIngredient[] = [];

  // 1) Tentative prioritaire: section "ingredients"
  const sectionMatch = cleaned.match(
    /(?:ingredients?|ingr[eé]dients?)\s*[:\-]?\s*(.+?)(?:\b(?:preparation|etapes?|cuisson|m[eé]thode)\b|$)/i,
  );
  const candidateSource = sectionMatch?.[1] || cleaned;
  const hasExplicitSection = Boolean(sectionMatch?.[1]);

  let match: RegExpExecArray | null = ingredientRegex.exec(candidateSource);
  while (match) {
    const quantity = (match[1] || '').replace(',', '.').trim();
    const unit = (match[2] || '').trim();
    const rawName = (match[3] || '').trim().toLowerCase();
    const tokenWords = rawName.split(/\s+/).filter(Boolean);
    const hasQuantityOrUnit = Boolean(quantity || unit);

    // Filtre des faux positifs trop verbeux
    if (
      rawName.length < 2 ||
      stopwordOnlyPattern.test(rawName) ||
      likelyVerbPattern.test(rawName) ||
      tokenWords.length > 5 ||
      /\b(?:recette|video|tiktok|preparation|cuisson|minute|facile|rapide)\b/i.test(rawName)
    ) {
      match = ingredientRegex.exec(candidateSource);
      continue;
    }

    // Sans section explicite, on exige quantité/unité pour éviter les phrases parasites.
    if (!hasExplicitSection && !hasQuantityOrUnit) {
      match = ingredientRegex.exec(candidateSource);
      continue;
    }

    // Avec section explicite, on accepte nom seul mais on évite les phrases.
    if (hasExplicitSection && !hasQuantityOrUnit && tokenWords.length > 3) {
      match = ingredientRegex.exec(candidateSource);
      continue;
    }

    const key = `${quantity}|${unit}|${rawName}`;
    if (!seen.has(key)) {
      seen.add(key);
      ingredients.push({
        id: `${rawName}-${ingredients.length + 1}`.replace(/\s+/g, '-'),
        name: toTitleCase(rawName),
        quantity: quantity || '',
        unit,
      });
    }

    match = ingredientRegex.exec(candidateSource);
  }

  return ingredients.slice(0, 20);
}

function normalizeUnit(unit: string) {
  const value = unit.toLowerCase().replace(/\s+/g, '');
  const map: Record<string, string> = {
    cas: 'c.à.s',
    'càs': 'c.à.s',
    'c.a.s': 'c.à.s',
    'càs.': 'c.à.s',
    cac: 'c.à.c',
    'càc': 'c.à.c',
    'c.a.c': 'c.à.c',
    cuillere: 'c.à.s',
    cuilleres: 'c.à.s',
    pincee: 'pincée',
    pincees: 'pincée',
  };

  return map[value] || unit.trim();
}

function sanitizeAiIngredients(aiIngredients: AiIngredient[] | undefined): ParsedIngredient[] {
  if (!Array.isArray(aiIngredients)) return [];
  const out: ParsedIngredient[] = [];
  const seen = new Set<string>();

  for (const ingredient of aiIngredients) {
    const rawName = String(ingredient?.name || '').trim().toLowerCase();
    if (!rawName || rawName.length < 2) continue;
    if (/\b(?:recette|video|tiktok|preparation|cuisson)\b/i.test(rawName)) continue;

    const quantity = String(ingredient?.quantity ?? '1').trim();
    const unit = normalizeUnit(String(ingredient?.unit || '').trim());
    const key = `${quantity}|${unit}|${rawName}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      id: `${rawName}-${out.length + 1}`.replace(/\s+/g, '-'),
      name: toTitleCase(rawName),
      quantity: quantity === '1' && !unit ? '' : quantity,
      unit,
    });
  }

  return out.slice(0, 20);
}

function extractJsonObjectFromText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Cas 1: JSON direct
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  // Cas 2: markdown ```json ... ```
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    const fenced = fencedMatch[1].trim();
    if (fenced.startsWith('{') && fenced.endsWith('}')) {
      return fenced;
    }
  }

  // Cas 3: extraction best-effort d'un objet JSON noyé dans du texte
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  return text.slice(first, last + 1);
}

function parseAiEnrichmentFromLooseText(text: string): AiRecipeEnrichment | null {
  const normalized = text
    .replace(/\r/g, '')
    .replace(/```(?:json)?/gi, '')
    .trim();
  if (!normalized) return null;

  // Titre: accepte "title:", "titre:", ou première ligne significative.
  const titleMatch = normalized.match(/(?:^|\n)\s*(?:title|titre)\s*[:\-]\s*(.+)/i);
  const slugTitleMatch = normalized.match(/(?:^|\n)\s*(?:slug[_\s-]?title|slug)\s*[:\-]\s*(.+)/i);
  let title = sanitizeRecipeTitle(titleMatch?.[1] || '');
  const slugTitle = sanitizeSlugTitle(slugTitleMatch?.[1] || '');

  if (!title) {
    const firstLine = normalized
      .split('\n')
      .map((line) => line.trim())
      .find((line) => {
        if (line.length < 6) return false;
        if (/^[-*•\d.)\s]/.test(line)) return false;
        if (/^(json|```)/i.test(line)) return false;
        return true;
      });
    title = sanitizeRecipeTitle(firstLine || '');
  }

  // Ingrédients: lecture des lignes en puces ou numérotées.
  const ingredientLines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*•]\s+/.test(line) || /^\d+[.)]\s+/.test(line))
    .map((line) => line.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '').trim())
    .filter(Boolean);

  const parsedIngredients: AiIngredient[] = ingredientLines.map((line) => {
    const match = line.match(
      /^(\d+(?:[.,]\d+)?|1\/2|1\/3|1\/4|2\/3|3\/4)?\s*(g|kg|ml|l|cl|cas|cac|c\.?à\.?s|c\.?à\.?c|cuill[eè]re?s?|tasse?s?|pinc[ée]e?s?)?\s*(.+)$/i,
    );

    if (!match) {
      return { name: line };
    }

    return {
      quantity: (match[1] || '').trim(),
      unit: (match[2] || '').trim(),
      name: (match[3] || '').trim(),
    };
  });

  if (!title && parsedIngredients.length === 0) return null;
  return {
    title: title || undefined,
    slugTitle: slugTitle || undefined,
    ingredients: parsedIngredients,
  };
}

function uniqueStrings(values: Array<string | undefined | null>) {
  const cleaned = values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
  return Array.from(new Set(cleaned));
}

function getGeminiModelCandidates() {
  return uniqueStrings([
    process.env.GEMINI_MODEL,
    'gemini-2.5-flash',
    'gemini-3.5-flash-lite',
  ]);
}

function getGeminiApiVersions() {
  return uniqueStrings([process.env.GEMINI_API_VERSION, 'v1beta']);
}

/** Erreurs liées au compte (clé refusée, crédit épuisé, quota) : inutile d'essayer un autre modèle. */
function isAccountError(status: number) {
  return status === 401 || status === 402 || status === 403 || status === 429;
}

/** Nombre maximum de modèles essayés par analyse */
const MAX_MODEL_ATTEMPTS = 3;

async function fetchGeminiAvailableModels(apiVersion: string, apiKey: string) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${encodeURIComponent(apiKey)}`,
    );
    if (!response.ok) return [];

    const data = await response.json();
    const models = Array.isArray(data?.models) ? data.models : [];

    return models
      .filter((model: any) => {
        const methods = Array.isArray(model?.supportedGenerationMethods)
          ? model.supportedGenerationMethods
          : [];
        return methods.includes('generateContent');
      })
      .map((model: any) => String(model?.name || '').replace(/^models\//, '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function enrichRecipeWithAi(caption: string): Promise<{
  enrichment: AiRecipeEnrichment | null;
  error: string | null;
  provider: 'gemini' | 'openai' | null;
}> {
  const aiEnabled = process.env.AI_ENABLED === 'true';
  if (!aiEnabled || !caption.trim()) {
    return {
      enrichment: null,
      error: !aiEnabled
        ? 'AI_DISABLED'
        : 'EMPTY_CAPTION',
      provider: null,
    };
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!geminiApiKey && !openAiApiKey) {
    return {
      enrichment: null,
      error: 'MISSING_GEMINI_AND_OPENAI_API_KEYS',
      provider: null,
    };
  }

  const systemPrompt =
    'Tu extrais des donnees de recette depuis une caption TikTok. Reponds uniquement en JSON valide.';
  const userPrompt = [
    'A partir du texte ci-dessous, renvoie un JSON strict avec:',
    '- title: nom court de recette, 3 a 8 mots, sans hashtags ni opinion.',
    '- slugTitle: version encore plus courte et neutre (2 a 6 mots), sans article initial (pas "les/le/la").',
    '- type: une valeur parmi "Entrée", "Plat", "Dessert", "Boisson".',
    '- preparationTime et cookingTime: durees en minutes (nombres), 0 si non precise.',
    '- servings: nombre de personnes (nombre), 0 si non precise.',
    '- ingredients: tableau de {name, quantity, unit}. quantity est un nombre ou une fraction ("1/2"), unit une unite courte (g, kg, ml, cl, l, c. à s., c. à c., pincée, pièce...) ou "" si aucune.',
    "- steps: tableau de phrases, une par etape de preparation, dans l'ordre, en francais.",
    "N'invente rien : si une information est absente du texte, renvoie 0, \"\" ou [].",
    '',
    `Texte: """${caption}"""`,
  ].join('\n');

  const parseAndReturn = (content: string, provider: 'gemini' | 'openai') => {
    const jsonText = extractJsonObjectFromText(content);
    if (!jsonText) {
      const loose = parseAiEnrichmentFromLooseText(content);
      if (loose) {
        return {
          enrichment: loose,
          error: null,
          provider,
        };
      }
      return { enrichment: null, error: `${provider.toUpperCase()}_NO_JSON_OBJECT`, provider: null as null };
    }

    try {
      return {
        enrichment: JSON.parse(jsonText) as AiRecipeEnrichment,
        error: null,
        provider,
      };
    } catch {
      return { enrichment: null, error: `${provider.toUpperCase()}_JSON_PARSE_FAILED`, provider: null as null };
    }
  };

  const providerErrors: string[] = [];

  // 1) GEMINI first
  if (geminiApiKey) {
    try {
      const geminiApiVersions = getGeminiApiVersions();
      let geminiSuccess = false;

      for (const apiVersion of geminiApiVersions) {
        if (geminiSuccess) break;
        const discoveredModels = await fetchGeminiAvailableModels(apiVersion, geminiApiKey);
        const geminiModels = uniqueStrings([...getGeminiModelCandidates(), ...discoveredModels]).slice(0, MAX_MODEL_ATTEMPTS);
        for (const geminiModel of geminiModels) {
          const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(
              geminiModel,
            )}:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
                  },
                ],
                generationConfig: {
                  temperature: 0.1,
                  maxOutputTokens: 4000,
                },
              }),
            },
          );

          if (geminiResponse.ok) {
            const geminiData = await geminiResponse.json();
            const geminiContent =
              geminiData?.candidates?.[0]?.content?.parts
                ?.map((part: any) => part?.text || '')
                .join('\n')
                .trim() || '';

            if (geminiContent) {
              const parsed = parseAndReturn(geminiContent, 'gemini');
              if (parsed.enrichment) {
                return parsed;
              }
              if (parsed.error) providerErrors.push(parsed.error);
            } else {
              providerErrors.push(`GEMINI_EMPTY_CONTENT(${apiVersion}:${geminiModel})`);
            }
            geminiSuccess = true;
            break;
          }
          const errorText = await geminiResponse.text().catch(() => 'GEMINI_HTTP_ERROR');
          providerErrors.push(
            `GEMINI_HTTP_${geminiResponse.status}(${apiVersion}:${geminiModel}): ${errorText.slice(0, 200)}`,
          );
          if (isAccountError(geminiResponse.status)) {
            geminiSuccess = true; // arrête aussi la boucle sur les versions d'API
            break;
          }
        }
      }
    } catch {
      providerErrors.push('GEMINI_FETCH_FAILED');
    }
  }

  // 2) OPENAI fallback
  if (openAiApiKey) {
    try {
      const openAiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: openAiModel,
          temperature: 0.1,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 2000,
        }),
      });

      if (openAiResponse.ok) {
        const openAiData = await openAiResponse.json();
        const openAiContent = openAiData?.choices?.[0]?.message?.content;
        if (openAiContent && typeof openAiContent === 'string') {
          const parsed = parseAndReturn(openAiContent, 'openai');
          if (parsed.enrichment) {
            return parsed;
          }
          if (parsed.error) providerErrors.push(parsed.error);
        } else {
          providerErrors.push('OPENAI_EMPTY_CONTENT');
        }
      } else {
        const errorText = await openAiResponse.text().catch(() => 'OPENAI_HTTP_ERROR');
        providerErrors.push(`OPENAI_HTTP_${openAiResponse.status}: ${errorText.slice(0, 200)}`);
      }
    } catch {
      providerErrors.push('OPENAI_FETCH_FAILED');
    }
  }

  return {
    enrichment: null,
    error: providerErrors.join(' | ') || 'AI_ENRICHMENT_FAILED',
    provider: null,
  };
}

function buildStepsFromCaption(caption: string) {
  const clean = cleanCaption(caption);
  if (!clean) {
    return [FALLBACK_STEP];
  }

  const numbered = clean
    .split(/(?:\d+\)|\d+\.|->|•|-)/g)
    .map((step) => step.trim())
    .filter((step) => step.length > 10);

  if (numbered.length > 1) {
    return numbered.slice(0, 8);
  }

  return [clean, FALLBACK_STEP];
}

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

/**
 * Légende, auteur et miniature lus dans la page de la vidéo (JSON __UNIVERSAL_DATA_FOR_REHYDRATION__).
 * Depuis octobre 2026, l'oEmbed de TikTok ne renvoie plus title, author_name ni thumbnail_url.
 */
async function fetchTikTokPageData(videoUrl: string): Promise<TikTokOEmbedResponse | null> {
  try {
    const response = await fetch(videoUrl, { headers: { 'User-Agent': BROWSER_USER_AGENT } });
    if (!response.ok) return null;
    const html = await response.text();
    const match = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) return null;
    const item = JSON.parse(match[1])?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
    if (!item) return null;
    return {
      title: typeof item.desc === 'string' ? item.desc : undefined,
      author_name: item.author?.nickname || item.author?.uniqueId || undefined,
      thumbnail_url: item.video?.cover || item.video?.originCover || undefined,
    };
  } catch {
    return null;
  }
}

async function fetchTikTokOEmbed(videoUrl: string): Promise<TikTokOEmbedResponse | null> {
  let data: TikTokOEmbedResponse | null = null;
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
    const response = await fetch(oembedUrl);
    if (response.ok) data = (await response.json()) as TikTokOEmbedResponse;
  } catch {
    data = null;
  }
  if (data?.title && data.thumbnail_url) return data;

  // oEmbed incomplet : on complète avec la page de la vidéo
  const page = await fetchTikTokPageData(videoUrl);
  if (!page) return data;
  return {
    title: data?.title || page.title,
    author_name: data?.author_name || page.author_name,
    thumbnail_url: data?.thumbnail_url || page.thumbnail_url,
  };
}


// ---------------------------------------------------------------------------
// Brouillon : normalisation des valeurs (IA ou saisie utilisateur)
// ---------------------------------------------------------------------------

const MAX_INGREDIENTS = 40;
const MAX_STEPS = 30;

function toText(value: unknown, maxLength: number): string {
  return (typeof value === 'string' || typeof value === 'number' ? String(value) : '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

/** Durée en minutes, entière, entre 0 et 24 h ("1h30", "45 min", 20). */
function toMinutes(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.min(1440, Math.max(0, Math.round(value))) : 0;
  const text = toText(value, 20).toLowerCase();
  const hours = text.match(/(\d+(?:[.,]\d+)?)\s*h/);
  const minutes = text.match(/(\d+)\s*(?:m|$)/);
  const total = (hours ? Number(hours[1].replace(',', '.')) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
  return Number.isFinite(total) ? Math.min(1440, Math.max(0, Math.round(total))) : 0;
}

function toServings(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(toText(value, 10).match(/\d+/)?.[0]);
  return Number.isFinite(n) && n >= 1 && n <= 50 ? Math.round(n) : null;
}

function toRecipeType(value: unknown): string {
  const key = normalizeUnitKey(toText(value, 20));
  return RECIPE_TYPES.find((type) => normalizeUnitKey(type) === key) || 'Plat';
}

/** Rattache l'unité au catalogue quand elle est reconnue (libellé normalisé + unitId). */
function toDraftIngredient(raw: { name?: unknown; quantity?: unknown; unit?: unknown; unitId?: unknown }, index: UnitIndex): ImportDraftIngredient | null {
  const name = toText(raw.name, 80);
  if (name.length < 2) return null;
  const rawUnit = toText(raw.unit, 30);
  const unit = resolveUnit(index, typeof raw.unitId === 'string' ? raw.unitId : null, rawUnit);
  const quantity = toText(raw.quantity, 20).replace(/^0$/, '');
  return {
    name: toTitleCase(name),
    quantity,
    unit: unit ? unit.abbreviation || unit.name : rawUnit,
    ...(unit ? { unitId: unit.id } : {}),
  };
}

function toSteps(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((step) => toText(step, 1000).replace(/^(?:\d+[.)]|[-•*])\s*/, ''))
    .filter((step) => step.length > 2)
    .slice(0, MAX_STEPS);
}

// ---------------------------------------------------------------------------
// Lecture d'une légende structurée, sans IA
// ---------------------------------------------------------------------------
// Beaucoup de légendes suivent le même plan : un titre, « Ingrédients » suivi d'une liste à puces,
// puis « Préparation » suivie d'étapes numérotées. Cette lecture suffit alors à remplir la recette.

const EMOJI_REGEX = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]/gu;
const INGREDIENTS_HEADING = /\bingr[ée]dients?\b\s*:?/i;
const STEPS_HEADING = /\b(?:pr[ée]paration|[ée]tapes?|instructions?|r[ée]alisation|recette)\b\s*:?/i;
const QUANTITY_REGEX = /^(\d+(?:[.,]\d+)?(?:\s*(?:-|–|à)\s*\d+(?:[.,]\d+)?)?|\d+\s*\/\s*\d+|[½¼¾⅓⅔])\s*/;

function stripDecorations(text: string) {
  return text.replace(/#[^\s#]+/g, ' ').replace(/@[^\s@]+/g, ' ').replace(EMOJI_REGEX, ' ').replace(/[ \t]+/g, ' ').trim();
}

/** Découpe un bloc en éléments de liste : retours à la ligne, tabulations, puces, numéros. */
function splitListItems(block: string): string[] {
  return block
    .replace(/[\t\r]+/g, '\n')
    .replace(/\s*[•●▪◦✔✅➡→]\s*/g, '\n')
    .replace(/(^|\s)(\d{1,2})[.)]\s+(?=\S)/g, '\n')
    .replace(/(^|\n)\s*[-–*]\s+/g, '\n')
    .split('\n')
    .map((item) => stripDecorations(item))
    .filter(Boolean);
}

/** « 200 g de chocolat noir », « 1 cuillère à café de levure », « 3 œufs » → quantité, unité, nom. */
function parseIngredientLine(line: string, index: UnitIndex): AiIngredient | null {
  // Intertitre collé à la fin de la ligne (« 80 g de farine Pour la pâte à cookie : »)
  let text = line.replace(/\s+\p{Lu}[^:]{2,60}:\s*$/u, '').trim();
  if (!text || /:\s*$/.test(text)) return null;
  // Phrase collée après l'ingrédient (« sel. Pour 4 personnes »)
  text = text.split(/[.!?]\s+/)[0];

  let quantity = '';
  const quantityMatch = text.match(QUANTITY_REGEX);
  if (quantityMatch) {
    quantity = quantityMatch[1].replace(/\s+/g, '');
    text = text.slice(quantityMatch[0].length);
  }

  // Unité : la plus longue suite de mots reconnue par le catalogue (« cuillère à café », « g »)
  let unit = '';
  if (quantity) {
    const words = text.split(/\s+/);
    for (let count = Math.min(4, words.length - 1); count >= 1; count--) {
      const candidate = words.slice(0, count).join(' ');
      if (resolveUnit(index, null, candidate)) {
        unit = candidate;
        text = words.slice(count).join(' ');
        break;
      }
    }
  }

  const name = text.replace(/^(?:de\s+|du\s+|des\s+|d['’]\s*)/i, '').replace(/[.;,]+$/, '').trim();
  if (name.length < 2 || name.length > 80 || name.split(/\s+/).length > 8) return null;
  // Sans quantité, une ligne longue est une phrase, pas un ingrédient
  if (!quantity && name.split(/\s+/).length > 4) return null;
  return { name, quantity, unit };
}

interface StructuredCaption {
  title: string;
  ingredients: AiIngredient[];
  steps: string[];
  servings: number | null;
}

function parseStructuredCaption(text: string, index: UnitIndex): StructuredCaption | null {
  const ingredientsMatch = text.match(INGREDIENTS_HEADING);
  if (!ingredientsMatch || ingredientsMatch.index === undefined) return null;

  const beforeIngredients = text.slice(0, ingredientsMatch.index);
  const afterIngredients = text.slice(ingredientsMatch.index + ingredientsMatch[0].length);
  const stepsMatch = afterIngredients.match(STEPS_HEADING);
  const ingredientsBlock = stepsMatch?.index !== undefined ? afterIngredients.slice(0, stepsMatch.index) : afterIngredients;
  const stepsBlock = stepsMatch?.index !== undefined ? afterIngredients.slice(stepsMatch.index + stepsMatch[0].length) : '';

  const ingredients = splitListItems(ingredientsBlock)
    // Liste écrite sur une ligne : « 4 feuilles de brick, 1 boîte de thon, 2 œufs »
    .flatMap((line) => line.split(/\s*[,;]\s+/))
    .map((line) => parseIngredientLine(line, index))
    .filter((ingredient): ingredient is AiIngredient => ingredient !== null);

  const steps = splitListItems(stepsBlock)
    // Intertitres (« Préparer le brownie : ») et fragments trop courts écartés
    .filter((step) => !/:\s*$/.test(step) && step.length > 8)
    .map((step) => step.replace(/\s+\p{Lu}[^.:]{2,60}:\s*$/u, '').trim())
    .filter(Boolean);

  if (ingredients.length < 2 && steps.length < 2) return null;

  const servingsMatch = text.match(/pour\s+(\d{1,2})\s*(?:personnes?|pers\b|parts?|portions?)/i);

  return {
    title: stripDecorations(beforeIngredients).replace(/[:\-–|]+$/, '').trim(),
    ingredients,
    steps,
    servings: servingsMatch ? toServings(Number(servingsMatch[1])) : null,
  };
}

// ---------------------------------------------------------------------------
// Liens courts
// ---------------------------------------------------------------------------

/**
 * Les liens de partage courts (vm.tiktok.com/…, tiktok.com/t/…) redirigent vers la vidéo :
 * on suit la redirection pour retrouver son adresse complète, seule acceptée par oEmbed.
 */
async function resolveTikTokUrl(videoUrl: string): Promise<string> {
  try {
    const parsed = new URL(videoUrl);
    const isShortLink = /^(?:vm|vt)\.tiktok\.com$/i.test(parsed.hostname) || parsed.pathname.startsWith('/t/');
    if (!isShortLink) {
      parsed.search = '';
      return parsed.toString();
    }

    const response = await fetch(videoUrl, { method: 'GET', redirect: 'manual' });
    const location = response.headers.get('location');
    if (!location) return videoUrl;

    const target = new URL(location, videoUrl);
    if (!/(?:^|\.)tiktok\.com$/i.test(target.hostname)) return videoUrl;
    target.search = '';
    return target.toString();
  } catch {
    return videoUrl;
  }
}

// ---------------------------------------------------------------------------
// 1. Analyse d'une vidéo
// ---------------------------------------------------------------------------

export class TikTokImportError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function getSourceVideoId(videoUrl: string) {
  return extractTikTokVideoId(videoUrl) || `url_${Buffer.from(videoUrl).toString('base64url').slice(0, 40)}`;
}

export async function analyzeTikTokVideo(rawVideoUrl: string, rawSupplementalText: string): Promise<ImportDraft & { aiError?: string | null }> {
  const requestedUrl = normalizeUrl(rawVideoUrl);
  if (!requestedUrl || !isValidTikTokUrl(requestedUrl)) {
    throw new TikTokImportError('Veuillez fournir une URL TikTok valide.');
  }
  const videoUrl = await resolveTikTokUrl(requestedUrl);

  const supplementalText = rawSupplementalText.trim().slice(0, 3000);
  const [oembed, units] = await Promise.all([fetchTikTokOEmbed(videoUrl), getUnits()]);
  const index = buildUnitIndex(units);

  const caption = (oembed?.title || '').trim();
  if (!caption && !supplementalText) {
    throw new TikTokImportError(
      "Impossible de lire la légende de cette vidéo. Vérifiez le lien, ou collez le texte de la recette dans le champ prévu.",
      422,
    );
  }

  // Texte complet (retours à la ligne conservés) pour l'IA ; version aplatie pour les règles simples
  const fullText = [caption, supplementalText].filter(Boolean).join('\n\n');
  const flatText = cleanCaption(fullText);

  const aiResult = await enrichRecipeWithAi(fullText);
  const ai = aiResult.enrichment;

  // Sans IA : lecture de la légende si elle est structurée (dans le texte collé en priorité),
  // sinon règles simples sur le texte aplati
  const structured = parseStructuredCaption(supplementalText, index) || parseStructuredCaption(fullText, index);

  const heuristicTitle = buildRecipeTitleFromCaption(structured?.title || caption || supplementalText);
  const aiTitle = sanitizeRecipeTitle(toText(ai?.title, 70));
  const title = selectBestRecipeTitle(aiTitle.length >= 4 ? aiTitle : '', heuristicTitle);

  const aiIngredients = sanitizeAiIngredients(ai?.ingredients);
  const fallbackIngredients = structured && structured.ingredients.length > 0 ? structured.ingredients : extractIngredientsFromText(flatText);
  const ingredients = (aiIngredients.length > 0 ? aiIngredients : fallbackIngredients)
    .map((ingredient) => toDraftIngredient(ingredient, index))
    .filter((ingredient): ingredient is ImportDraftIngredient => ingredient !== null)
    .slice(0, MAX_INGREDIENTS);

  const aiSteps = toSteps(ai?.steps);

  return {
    videoUrl,
    sourceVideoId: getSourceVideoId(videoUrl),
    title,
    type: toRecipeType(ai?.type),
    preparationTime: toMinutes(ai?.preparationTime),
    cookingTime: toMinutes(ai?.cookingTime),
    servings: toServings(ai?.servings) ?? structured?.servings ?? null,
    ingredients,
    steps: aiSteps.length > 0 ? aiSteps : structured && structured.steps.length > 0 ? structured.steps.slice(0, MAX_STEPS) : buildStepsFromCaption(flatText),
    thumbnailUrl: oembed?.thumbnail_url || null,
    author: oembed?.author_name || null,
    aiUsed: Boolean(ai),
    aiError: aiResult.error,
  };
}

// ---------------------------------------------------------------------------
// 2. Enregistrement du brouillon relu
// ---------------------------------------------------------------------------

/** Noms des ingrédients du catalogue (cache 10 min), pour réutiliser leur fiche quand le nom correspond. */
const getIngredientCatalog = unstable_cache(
  async (): Promise<{ id: string; name: string }[]> => {
    const snapshot = await getFirebaseAdminDb().collection('ingredients').select('name').get();
    return snapshot.docs.map((d) => ({ id: d.id, name: String(d.get('name') || '') })).filter((i) => i.name);
  },
  ['ingredients-names'],
  { revalidate: 600 },
);


const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

/**
 * Copie la miniature de la vidéo dans le stockage du site : le lien fourni par TikTok expire
 * au bout de quelques jours. L'adresse est relue auprès de TikTok (jamais fournie par le client).
 * Renvoie l'URL publique, ou null si la copie échoue (la recette est alors enregistrée sans image).
 */
async function copyThumbnailToStorage(videoUrl: string, uid: string, sourceVideoId: string): Promise<string | null> {
  try {
    const oembed = await fetchTikTokOEmbed(videoUrl);
    const thumbnailUrl = oembed?.thumbnail_url;
    if (!thumbnailUrl || !/^https:\/\//i.test(thumbnailUrl)) return null;

    const response = await fetch(thumbnailUrl);
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.startsWith('image/')) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_THUMBNAIL_BYTES) return null;

    const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const path = `recipes/tiktok/${uid}/${sourceVideoId.replace(/[^\w-]/g, '_')}.${extension}`;
    const token = randomUUID();
    const bucket = getFirebaseAdminBucket();

    await bucket.file(path).save(buffer, {
      resumable: false,
      metadata: {
        contentType,
        cacheControl: 'public, max-age=31536000',
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    // Même format que getDownloadURL côté navigateur (reconnu par next/image)
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  } catch (error) {
    console.error('Copie de la miniature TikTok impossible :', error);
    return null;
  }
}

export interface SaveDraftResult {
  /** Vrai si la vidéo était déjà dans le carnet de l'utilisateur */
  duplicate: boolean;
  /** Identifiant de la recette dans le carnet privé ("users/{uid}/carnet") */
  carnetId: string;
  /** Renseigné si la recette a aussi été proposée à la publication */
  recipeRequestId?: string;
  imageSaved?: boolean;
}

/** Identifiant de la recette du carnet pour une vidéo : une vidéo n'y figure qu'une fois. */
function getCarnetId(sourceVideoId: string) {
  return `tiktok_${sourceVideoId.replace(/[^\w-]/g, '_')}`;
}

/**
 * Enregistre la recette relue dans le carnet privé de l'utilisateur, où elle est disponible
 * aussitôt. Avec `publish`, elle est aussi proposée à la publication sur le site ("recipesRequest").
 */
export async function saveTikTokDraft(uid: string, raw: unknown, { publish = false }: { publish?: boolean } = {}): Promise<SaveDraftResult> {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const requestedUrl = normalizeUrl(toText(input.videoUrl, 500));
  if (!requestedUrl || !isValidTikTokUrl(requestedUrl)) {
    throw new TikTokImportError('URL TikTok invalide.');
  }
  const videoUrl = await resolveTikTokUrl(requestedUrl);

  const title = toTitleCase(toText(input.title, 100));
  if (title.length < 3) {
    throw new TikTokImportError('Le titre de la recette est obligatoire.');
  }

  const [units, catalog] = await Promise.all([getUnits(), getIngredientCatalog().catch((): { id: string; name: string }[] => [])]);
  const index = buildUnitIndex(units);
  const catalogByKey = new Map(catalog.map((ingredient) => [ingredientKey(ingredient.name), ingredient] as const));

  const ingredients = (Array.isArray(input.ingredients) ? input.ingredients : [])
    .map((ingredient) => toDraftIngredient((ingredient || {}) as Record<string, unknown>, index))
    .filter((ingredient): ingredient is ImportDraftIngredient => ingredient !== null)
    .slice(0, MAX_INGREDIENTS)
    .map((ingredient, position) => {
      // Fiche du catalogue si le nom correspond (nom de référence, liste de courses), sinon id libre
      const known = catalogByKey.get(ingredientKey(ingredient.name));
      return {
        id: known?.id || `${slugify(ingredient.name) || 'ingredient'}-${position + 1}`,
        name: known?.name || ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        ...(ingredient.unitId ? { unitId: ingredient.unitId } : {}),
      };
    });

  const steps = toSteps(input.steps);
  const servings = toServings(input.servings);
  const sourceVideoId = getSourceVideoId(videoUrl);
  const db = getFirebaseAdminDb();

  const carnetId = getCarnetId(sourceVideoId);
  const carnetRef = db.doc(`users/${uid}/carnet/${carnetId}`);
  if ((await carnetRef.get()).exists) return { duplicate: true, carnetId };

  const image = await copyThumbnailToStorage(videoUrl, uid, sourceVideoId);

  const payload = {
    type: toRecipeType(input.type),
    preparationTime: toMinutes(input.preparationTime),
    cookingTime: toMinutes(input.cookingTime),
    ...(servings ? { servings } : {}),
    position: 'none',
    recipeParts: [{ title, steps: steps.length > 0 ? steps : [FALLBACK_STEP], ingredients }],
    images: image ? [image] : [],
    video: videoUrl,
    createdBy: uid,
    importedBy: uid,
    source: 'tiktok',
    sourceVideoId,
    sourceCollectionId: 'manual-url',
    titleKeywords: title.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 20),
    url: slugify(title) || slugify(`recette-tiktok-${sourceVideoId}`) || `recette-tiktok-${Date.now()}`,
    externalAuthor: toText(input.author, 80) || null,
    createdAt: FieldValue.serverTimestamp(),
  };

  await carnetRef.set({ ...payload, title, id: carnetId });

  // Proposition à la publication, sauf si la vidéo a déjà été proposée (imports d'avant le carnet)
  let recipeRequestId: string | undefined;
  if (publish) {
    const alreadyRequested = await db
      .collection('recipesRequest')
      .where('createdBy', '==', uid)
      .where('source', '==', 'tiktok')
      .where('sourceVideoId', '==', sourceVideoId)
      .limit(1)
      .get();

    if (alreadyRequested.empty) {
      // Création puis ajout du titre, comme le formulaire : c'est le passage d'un titre vide à un
      // titre renseigné qui déclenche l'email d'alerte à l'admin (Cloud Function sendEmailOnNewRecipeRequest)
      const requestRef = await db.collection('recipesRequest').add({ ...payload, title: '' });
      await requestRef.update({ title, id: requestRef.id });
      recipeRequestId = requestRef.id;
    }
  }

  await Promise.all([
    db.doc(`tiktokImports/${uid}/videos/${sourceVideoId}`).set({
      source: 'tiktok',
      sourceVideoId,
      carnetId,
      ...(recipeRequestId ? { recipeRequestId } : {}),
      importedAt: FieldValue.serverTimestamp(),
      via: 'manual-url',
    }),
    db.doc(`tiktokImports/${uid}`).set(
      { uid, enabled: true, lastImportedCount: 1, lastSyncAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    ),
  ]);

  return { duplicate: false, carnetId, ...(recipeRequestId ? { recipeRequestId } : {}), imageSaved: Boolean(image) };
}
