import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/config/firebase-admin';

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

    const title = 'Recette TikTok importée';
    const recipePayload = {
      title,
      type: 'Plat',
      preparationTime: 0,
      cookingTime: 0,
      position: 'none',
      recipeParts: [
        {
          title,
          steps: ['Voir la vidéo TikTok pour la préparation détaillée.'],
          ingredients: [],
        },
      ],
      images: [],
      video: videoUrl,
      createdBy: uid,
      importedBy: uid,
      source: 'tiktok',
      sourceVideoId,
      sourceCollectionId: 'manual-url',
      titleKeywords: ['recette', 'tiktok', 'import'],
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

