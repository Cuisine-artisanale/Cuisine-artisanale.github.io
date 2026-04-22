import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/config/firebase-admin';

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

    const [connectionSnap, importSnap] = await Promise.all([
      db.doc(`users/${uid}/socialConnections/tiktok`).get(),
      db.doc(`tiktokImports/${uid}`).get(),
    ]);

    if (!connectionSnap.exists) {
      return NextResponse.json({
        success: true,
        connected: false,
      });
    }

    const connectionData = connectionSnap.data() || {};
    const importData = importSnap.exists ? importSnap.data() || {} : {};

    return NextResponse.json({
      success: true,
      connected: Boolean(connectionData.connected),
      displayName: connectionData.displayName || null,
      lastSyncAt: importData.lastSyncAt?.toDate?.()?.toISOString?.() || null,
      lastImportedCount:
        typeof importData.lastImportedCount === 'number' ? importData.lastImportedCount : null,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Impossible de récupérer le statut TikTok',
      },
      { status: 401 },
    );
  }
}

