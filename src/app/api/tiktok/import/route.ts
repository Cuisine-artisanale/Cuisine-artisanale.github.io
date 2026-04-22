import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/config/firebase-admin';
import {
  computeExpiresAt,
  decryptToken,
  encryptToken,
  fetchTikTokVideos,
  getTikTokVideoCollectionInfo,
  normalizeTikTokVideoToRecipeRequest,
  refreshTikTokAccessToken,
  shouldRefreshToken,
} from '@/lib/services/tiktok.service';

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
    const maxCount = Number.isFinite(body?.maxCount) ? Number(body.maxCount) : 20;
    const selectedCollectionId =
      typeof body?.collectionId === 'string' && body.collectionId.trim()
        ? body.collectionId.trim()
        : 'all';

    const db = getFirebaseAdminDb();
    const connectionRef = db.doc(`users/${uid}/socialConnections/tiktok`);
    const importStateRef = db.doc(`tiktokImports/${uid}`);

    const [connectionSnap, importStateSnap] = await Promise.all([connectionRef.get(), importStateRef.get()]);
    if (!connectionSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Compte TikTok non connecté' },
        { status: 400 },
      );
    }

    const connectionData = connectionSnap.data() || {};
    const tokenData = connectionData.token || {};
    if (!tokenData.accessToken || !tokenData.refreshToken) {
      return NextResponse.json(
        { success: false, error: 'Token TikTok introuvable, reconnectez votre compte' },
        { status: 400 },
      );
    }

    let accessToken = decryptToken(tokenData.accessToken);
    const refreshToken = decryptToken(tokenData.refreshToken);
    let expiresAt = tokenData.expiresAt as string | undefined;

    if (shouldRefreshToken(expiresAt)) {
      const refreshed = await refreshTikTokAccessToken(refreshToken);
      accessToken = refreshed.access_token;
      expiresAt = computeExpiresAt(refreshed.expires_in);

      await connectionRef.set(
        {
          token: {
            accessToken: encryptToken(refreshed.access_token),
            refreshToken: encryptToken(refreshed.refresh_token || refreshToken),
            expiresAt,
            refreshExpiresAt: refreshed.refresh_expires_in
              ? computeExpiresAt(refreshed.refresh_expires_in)
              : tokenData.refreshExpiresAt || null,
            scope: refreshed.scope || tokenData.scope || null,
            tokenType: refreshed.token_type || tokenData.tokenType || null,
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    const cursor = importStateSnap.exists ? importStateSnap.data()?.lastCursor ?? 0 : 0;

    // MVP collections: on filtre les vidéos par playlist/collection quand l'ID est fourni.
    let nextCursor: string | number = cursor;
    let hasMore = false;
    let videos: any[] = [];

    if (selectedCollectionId === 'all') {
      const response = await fetchTikTokVideos(accessToken, cursor, maxCount);
      videos = response.videos;
      nextCursor = response.cursor;
      hasMore = response.hasMore;
    } else {
      let currentCursor: string | number = cursor;
      let currentHasMore = true;
      let page = 0;
      const maxPages = 5;

      while (currentHasMore && videos.length < maxCount && page < maxPages) {
        const response = await fetchTikTokVideos(accessToken, currentCursor, 20);
        const matching = response.videos.filter((video) => {
          const info = getTikTokVideoCollectionInfo(video);
          return info.id === selectedCollectionId;
        });
        videos.push(...matching);
        currentCursor = response.cursor;
        currentHasMore = Boolean(response.hasMore);
        page += 1;
      }

      videos = videos.slice(0, maxCount);
      nextCursor = currentCursor;
      hasMore = currentHasMore;
    }

    let importedCount = 0;
    let skippedCount = 0;

    for (const video of videos) {
      const markerRef = db.doc(`tiktokImports/${uid}/videos/${video.id}`);
      const markerSnap = await markerRef.get();
      if (markerSnap.exists) {
        skippedCount += 1;
        continue;
      }

      const recipeRequest = normalizeTikTokVideoToRecipeRequest(video, uid);
      const recipeRef = await db.collection('recipesRequest').add({
        ...recipeRequest,
        sourceCollectionId: selectedCollectionId,
        createdAt: FieldValue.serverTimestamp(),
      });

      await markerRef.set({
        source: 'tiktok',
        sourceVideoId: video.id,
        recipeRequestId: recipeRef.id,
        importedAt: FieldValue.serverTimestamp(),
      });

      importedCount += 1;
    }

    await importStateRef.set(
      {
        uid,
        enabled: true,
        lastCursor: nextCursor,
        hasMore: Boolean(hasMore),
        selectedCollectionId,
        lastImportedCount: importedCount,
        lastSyncAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({
      success: true,
      importedCount,
      skippedCount,
      fetchedCount: videos.length,
      cursor: nextCursor,
      hasMore: Boolean(hasMore),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Erreur lors de l'import TikTok",
      },
      { status: 500 },
    );
  }
}

