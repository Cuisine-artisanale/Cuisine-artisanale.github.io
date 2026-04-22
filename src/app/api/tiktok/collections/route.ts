import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/config/firebase-admin';
import {
  computeExpiresAt,
  decryptToken,
  encryptToken,
  fetchTikTokVideos,
  getTikTokVideoCollectionInfo,
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

export async function GET(request: NextRequest) {
  try {
    const uid = await getAuthenticatedUid(request);
    const db = getFirebaseAdminDb();
    const connectionRef = db.doc(`users/${uid}/socialConnections/tiktok`);
    const connectionSnap = await connectionRef.get();

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

    // MVP: on regarde la première page des vidéos et on en déduit les collections/playlist disponibles.
    const { videos } = await fetchTikTokVideos(accessToken, 0, 20);

    const map = new Map<string, { id: string; name: string; count: number }>();
    map.set('all', { id: 'all', name: 'Toutes mes vidéos', count: videos.length });

    for (const video of videos) {
      const info = getTikTokVideoCollectionInfo(video);
      if (info.id === 'all') continue;

      const existing = map.get(info.id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(info.id, { id: info.id, name: info.name, count: 1 });
      }
    }

    return NextResponse.json({
      success: true,
      collections: Array.from(map.values()),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Impossible de récupérer les collections TikTok',
      },
      { status: 500 },
    );
  }
}

