import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/config/firebase-admin';

type TikTokOEmbedResponse = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
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
  const ingredients: Array<{ id: string; name: string; quantity: string; unit: string }> = [];

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
    const extractedIngredients = extractIngredientsFromText(caption);
    const title = buildRecipeTitleFromCaption(oembed?.title || 'Recette TikTok importee');
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

