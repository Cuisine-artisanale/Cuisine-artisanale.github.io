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

function extractIngredientsFromText(text: string) {
  // Heuristique simple: "2 oeufs", "150 g farine", etc.
  const ingredientRegex =
    /\b(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|cl|c\.?à\.?s|c\.?à\.?c|cuill[eè]re?s?|tasse?s?)?\s+([a-zA-ZÀ-ÿ][a-zA-ZÀ-ÿ' -]{1,40})/gi;
  const seen = new Set<string>();
  const ingredients: Array<{ id: string; name: string; quantity: string; unit: string }> = [];
  let match: RegExpExecArray | null = ingredientRegex.exec(text);

  while (match) {
    const quantity = (match[1] || '').replace(',', '.');
    const unit = (match[2] || '').trim();
    const name = (match[3] || '').trim().toLowerCase();
    const key = `${quantity}|${unit}|${name}`;

    if (name.length >= 2 && !seen.has(key)) {
      seen.add(key);
      ingredients.push({
        id: `${name}-${ingredients.length + 1}`.replace(/\s+/g, '-'),
        name: toTitleCase(name),
        quantity,
        unit,
      });
    }

    match = ingredientRegex.exec(text);
  }

  return ingredients.slice(0, 15);
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
    const title = cleanCaption(oembed?.title || 'Recette TikTok importee').slice(0, 120);
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

