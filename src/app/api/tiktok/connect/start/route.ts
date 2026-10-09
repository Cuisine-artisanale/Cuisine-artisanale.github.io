import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/config/firebase-admin';
import {
  buildSignedOAuthState,
  buildTikTokAuthUrlWithPkce,
  generatePkceChallenge,
  generatePkceVerifier,
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
    const { searchParams } = new URL(request.url);
    const requestedReturnTo = searchParams.get('returnTo');
    const returnTo = requestedReturnTo && requestedReturnTo.startsWith('/')
      ? requestedReturnTo
      : `/profil?id=${uid}`;

    const state = buildSignedOAuthState(uid, returnTo);
    const codeVerifier = generatePkceVerifier();
    const codeChallenge = generatePkceChallenge(codeVerifier);
    const authUrl = buildTikTokAuthUrlWithPkce(state, codeChallenge);

    const response = NextResponse.json({ success: true, authUrl });
    response.cookies.set('tiktok_pkce_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 15,
      path: '/',
    });
    return response;
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Impossible de démarrer la connexion TikTok',
      },
      { status: 401 },
    );
  }
}

