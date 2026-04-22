import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdminDb } from '@/lib/config/firebase-admin';
import {
  computeExpiresAt,
  encryptToken,
  exchangeCodeForToken,
  fetchTikTokUserInfo,
  parseAndVerifyOAuthState,
} from '@/lib/services/tiktok.service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const oauthError = searchParams.get('error_description') || searchParams.get('error');

  const frontendBaseUrl =
    process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || 'http://localhost:3000';

  try {
    if (oauthError) {
      throw new Error(`Connexion TikTok refusée: ${oauthError}`);
    }

    if (!code || !state) {
      throw new Error('Code OAuth ou state manquant');
    }

    const parsedState = parseAndVerifyOAuthState(state);
    const codeVerifier = request.cookies.get('tiktok_pkce_verifier')?.value;
    if (!codeVerifier) {
      throw new Error('Code verifier PKCE manquant. Relancez la connexion TikTok.');
    }

    const tokenData = await exchangeCodeForToken(code, codeVerifier);
    const userInfo = await fetchTikTokUserInfo(tokenData.access_token);

    const db = getFirebaseAdminDb();
    const socialDocRef = db.doc(`users/${parsedState.uid}/socialConnections/tiktok`);
    const importStateRef = db.doc(`tiktokImports/${parsedState.uid}`);

    await socialDocRef.set(
      {
        provider: 'tiktok',
        connected: true,
        tiktokOpenId: tokenData.open_id || userInfo.open_id || null,
        displayName: userInfo.display_name || null,
        avatarUrl: userInfo.avatar_url || null,
        token: {
          accessToken: encryptToken(tokenData.access_token),
          refreshToken: encryptToken(tokenData.refresh_token),
          expiresAt: computeExpiresAt(tokenData.expires_in),
          refreshExpiresAt: tokenData.refresh_expires_in
            ? computeExpiresAt(tokenData.refresh_expires_in)
            : null,
          scope: tokenData.scope || null,
          tokenType: tokenData.token_type || null,
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    await importStateRef.set(
      {
        uid: parsedState.uid,
        lastCursor: 0,
        enabled: true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const redirectUrl = `${frontendBaseUrl}${parsedState.returnTo}${
      parsedState.returnTo.includes('?') ? '&' : '?'
    }tiktok=connected`;
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete('tiktok_pkce_verifier');
    return response;
  } catch (error: any) {
    const safeReturnTo = '/profil';
    const redirectUrl = `${frontendBaseUrl}${safeReturnTo}?tiktok=error&message=${encodeURIComponent(
      error?.message || 'Erreur de connexion TikTok',
    )}`;
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete('tiktok_pkce_verifier');
    return response;
  }
}

