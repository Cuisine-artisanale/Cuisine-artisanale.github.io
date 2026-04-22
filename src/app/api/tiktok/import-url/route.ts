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

function extractIngredientsFromText(text: string) {
  const cleaned = normalizeTextForParsing(text);
  const ingredientRegex =
    /\b(\d+(?:[.,]\d+)?|1\/2|1\/3|1\/4|2\/3|3\/4)?\s*(g|kg|ml|l|cl|cas|cac|c\.?à\.?s|c\.?à\.?c|cuill[eè]re?s?|tasse?s?|pinc[ée]e?s?)?\s*([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ' -]{1,45})/gi;

  const seen = new Set<string>();
  const ingredients: ParsedIngredient[] = [];

  // 1) Tentative prioritaire: section "ingredients"
  const sectionMatch = cleaned.match(
    /(?:ingredients?|ingr[eé]dients?)\s*[:\-]?\s*(.+?)(?:\b(?:preparation|etapes?|cuisson|m[eé]thode)\b|$)/i,
  );
  const candidateSource = sectionMatch?.[1] || cleaned;

  let match: RegExpExecArray | null = ingredientRegex.exec(candidateSource);
  while (match) {
    const quantity = (match[1] || '').replace(',', '.').trim();
    const unit = (match[2] || '').trim();
    const rawName = (match[3] || '').trim().toLowerCase();

    // Filtre des faux positifs trop verbeux
    if (
      rawName.length < 2 ||
      /\b(?:recette|video|tiktok|preparation|cuisson|minute|facile|rapide)\b/i.test(rawName)
    ) {
      match = ingredientRegex.exec(candidateSource);
      continue;
    }

    const key = `${quantity}|${unit}|${rawName}`;
    if (!seen.has(key)) {
      seen.add(key);
      ingredients.push({
        id: `${rawName}-${ingredients.length + 1}`.replace(/\s+/g, '-'),
        name: toTitleCase(rawName),
        quantity: quantity || '1',
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
      quantity,
      unit,
    });
  }

  return out.slice(0, 20);
}

function extractJsonObjectFromText(text: string) {
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) return null;
  return text.slice(first, last + 1);
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
      const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
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
          providerErrors.push('GEMINI_EMPTY_CONTENT');
        }
      } else {
        const errorText = await geminiResponse.text().catch(() => 'GEMINI_HTTP_ERROR');
        providerErrors.push(`GEMINI_HTTP_${geminiResponse.status}: ${errorText.slice(0, 200)}`);
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
    const videoUrl = normalizeUrl(rawVideoUrl);

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
    const heuristicIngredients = extractIngredientsFromText(caption);
    const heuristicTitle = buildRecipeTitleFromCaption(oembed?.title || 'Recette TikTok importee');
    const aiResult = await enrichRecipeWithAi(caption);
    const aiEnrichment = aiResult.enrichment;
    const aiIngredients = sanitizeAiIngredients(aiEnrichment?.ingredients);
    const extractedIngredients = aiIngredients.length > 0 ? aiIngredients : heuristicIngredients;
    const aiTitleCandidate = cleanCaption(String(aiEnrichment?.title || '')).slice(0, 70);
    const title =
      aiTitleCandidate && aiTitleCandidate.length >= 4 ? toTitleCase(aiTitleCandidate) : heuristicTitle;
    const titleKeywords = title.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 20);
    const steps = buildStepsFromCaption(caption);

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
      ...(process.env.NODE_ENV !== 'production' && { aiError: aiResult.error }),
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

