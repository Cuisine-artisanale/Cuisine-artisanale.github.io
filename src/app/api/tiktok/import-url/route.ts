import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/config/firebase-admin';

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
  ingredients?: AiIngredient[];
};

function isValidTikTokUrl(url: string) {
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
  let title = sanitizeRecipeTitle(titleMatch?.[1] || '');

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
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
    'gemini-1.5-pro-latest',
  ]);
}

function getGeminiApiVersions() {
  return uniqueStrings([process.env.GEMINI_API_VERSION, 'v1', 'v1beta']);
}

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
    '- ingredients: tableau de {name, quantity, unit}.',
    'Si ingredient absent du texte, renvoie ingredients: [].',
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
        const geminiModels = uniqueStrings([...getGeminiModelCandidates(), ...discoveredModels]);
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
                  maxOutputTokens: 500,
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
          max_tokens: 400,
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
    return ['Voir la video TikTok pour la preparation detaillee.'];
  }

  const numbered = clean
    .split(/(?:\d+\)|\d+\.|->|•|-)/g)
    .map((step) => step.trim())
    .filter((step) => step.length > 10);

  if (numbered.length > 1) {
    return numbered.slice(0, 8);
  }

  return [clean, 'Voir la video TikTok pour la preparation detaillee.'];
}

async function fetchTikTokOEmbed(videoUrl: string): Promise<TikTokOEmbedResponse | null> {
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
    const response = await fetch(oembedUrl);
    if (!response.ok) return null;
    const data = (await response.json()) as TikTokOEmbedResponse;
    return data;
  } catch {
    return null;
  }
}

async function getAuthenticatedUid(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) {
    throw new Error('Token Firebase manquant');
  }

  const auth = getFirebaseAdminAuth();
  const decoded = await auth.verifyIdToken(token);
  return decoded.uid;
}

export async function POST(request: NextRequest) {
  try {
    const uid = await getAuthenticatedUid(request);
    const body = await request.json().catch(() => ({}));
    const rawVideoUrl = typeof body?.videoUrl === 'string' ? body.videoUrl : '';
    const rawSupplementalText =
      typeof body?.supplementalText === 'string' ? body.supplementalText : '';
    const videoUrl = normalizeUrl(rawVideoUrl);
    const supplementalText = cleanCaption(rawSupplementalText).slice(0, 3000);

    if (!videoUrl || !isValidTikTokUrl(videoUrl)) {
      return NextResponse.json(
        { success: false, error: 'Veuillez fournir une URL TikTok valide.' },
        { status: 400 },
      );
    }

    const videoId = extractTikTokVideoId(videoUrl);
    const fallbackSourceId = `url_${Buffer.from(videoUrl).toString('base64url').slice(0, 40)}`;
    const sourceVideoId = videoId || fallbackSourceId;
    const db = getFirebaseAdminDb();
    const oembed = await fetchTikTokOEmbed(videoUrl);
    const caption = cleanCaption(oembed?.title || '');
    const parsingText = [caption, supplementalText].filter(Boolean).join(' \n ');
    const heuristicIngredients = extractIngredientsFromText(parsingText);
    const heuristicTitle = buildRecipeTitleFromCaption(oembed?.title || 'Recette TikTok importee');
    const aiResult = await enrichRecipeWithAi(parsingText);
    const aiEnrichment = aiResult.enrichment;
    const aiIngredients = sanitizeAiIngredients(aiEnrichment?.ingredients);
    const extractedIngredients = aiIngredients.length > 0 ? aiIngredients : heuristicIngredients;
    const aiTitleCandidate = cleanCaption(String(aiEnrichment?.title || '')).slice(0, 70);
    const sanitizedAiTitle = sanitizeRecipeTitle(aiTitleCandidate);
    const title = selectBestRecipeTitle(
      sanitizedAiTitle && sanitizedAiTitle.length >= 4 ? sanitizedAiTitle : '',
      heuristicTitle,
    );
    const titleKeywords = title.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 20);
    const steps = buildStepsFromCaption(parsingText || caption);

    const duplicateQuery = await db
      .collection('recipesRequest')
      .where('createdBy', '==', uid)
      .where('source', '==', 'tiktok')
      .where('sourceVideoId', '==', sourceVideoId)
      .limit(1)
      .get();

    if (!duplicateQuery.empty) {
      return NextResponse.json({
        success: true,
        imported: false,
        duplicate: true,
        message: 'Cette vidéo TikTok est déjà importée.',
      });
    }

    const recipePayload = {
      title,
      type: 'Plat',
      preparationTime: 0,
      cookingTime: 0,
      position: 'none',
      recipeParts: [
        {
          title,
          steps,
          ingredients: extractedIngredients,
        },
      ],
      images: oembed?.thumbnail_url ? [oembed.thumbnail_url] : [],
      video: videoUrl,
      createdBy: uid,
      importedBy: uid,
      source: 'tiktok',
      sourceVideoId,
      sourceCollectionId: 'manual-url',
      titleKeywords: titleKeywords.length > 0 ? titleKeywords : ['recette', 'tiktok', 'import'],
      externalAuthor: oembed?.author_name || null,
      supplementalText: supplementalText || null,
      createdAt: FieldValue.serverTimestamp(),
    };

    const recipeRef = await db.collection('recipesRequest').add(recipePayload);

    await db.doc(`tiktokImports/${uid}/videos/${sourceVideoId}`).set({
      source: 'tiktok',
      sourceVideoId,
      recipeRequestId: recipeRef.id,
      importedAt: FieldValue.serverTimestamp(),
      via: 'manual-url',
    });

    await db.doc(`tiktokImports/${uid}`).set(
      {
        uid,
        enabled: true,
        lastImportedCount: 1,
        lastSyncAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({
      success: true,
      imported: true,
      duplicate: false,
      recipeRequestId: recipeRef.id,
      aiUsed: Boolean(aiEnrichment),
      aiProvider: aiResult.provider,
      titleSource: aiTitleCandidate ? 'ai' : 'heuristic',
      ingredientsSource: aiIngredients.length > 0 ? 'ai' : 'heuristic',
      extractedIngredientsCount: extractedIngredients.length,
      captionLength: caption.length,
      supplementalLength: supplementalText.length,
      ...((process.env.NODE_ENV !== 'production' || process.env.AI_DEBUG === 'true') && {
        aiError: aiResult.error,
      }),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erreur lors de l'import TikTok par URL",
      },
      { status: 500 },
    );
  }
}

