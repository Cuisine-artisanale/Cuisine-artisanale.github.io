import crypto from 'crypto';
import type { RecipeRequest, TikTokVideoItem } from '@/types';
import { slugify } from '@/lib/utils/slug';

const TIKTOK_AUTH_BASE_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const TIKTOK_USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';
const TIKTOK_VIDEO_LIST_URL = 'https://open.tiktokapis.com/v2/video/list/';

type TikTokEnv = {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  stateSecret: string;
  tokenEncryptionKey: string;
};

type OAuthStatePayload = {
  uid: string;
  nonce: string;
  returnTo: string;
  createdAt: number;
};

type TokenResponse = {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_token: string;
  refresh_expires_in?: number;
  scope?: string;
  token_type?: string;
};

type TikTokUserInfo = {
  open_id?: string;
  display_name?: string;
  avatar_url?: string;
};

function ensureEnv(): TikTokEnv {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;
  const stateSecret = process.env.TIKTOK_OAUTH_STATE_SECRET;
  const tokenEncryptionKey = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY;

  if (!clientKey || !clientSecret || !redirectUri || !stateSecret || !tokenEncryptionKey) {
    throw new Error(
      'Variables TikTok manquantes. Requis: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI, TIKTOK_OAUTH_STATE_SECRET, TIKTOK_TOKEN_ENCRYPTION_KEY',
    );
  }

  return { clientKey, clientSecret, redirectUri, stateSecret, tokenEncryptionKey };
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signValue(value: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function getAesKey(secret: string) {
  return crypto.createHash('sha256').update(secret).digest();
}

export function buildSignedOAuthState(uid: string, returnTo: string) {
  const { stateSecret } = ensureEnv();
  const payload: OAuthStatePayload = {
    uid,
    nonce: crypto.randomBytes(16).toString('hex'),
    returnTo,
    createdAt: Date.now(),
  };

  const serialized = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(serialized);
  const signature = signValue(payloadB64, stateSecret);
  return `${payloadB64}.${signature}`;
}

export function parseAndVerifyOAuthState(state: string): OAuthStatePayload {
  const { stateSecret } = ensureEnv();
  const [payloadB64, signature] = state.split('.');
  if (!payloadB64 || !signature) {
    throw new Error('State OAuth invalide');
  }

  const expectedSignature = signValue(payloadB64, stateSecret);
  if (signature !== expectedSignature) {
    throw new Error('Signature state OAuth invalide');
  }

  const payload = JSON.parse(base64UrlDecode(payloadB64)) as OAuthStatePayload;
  if (!payload.uid || !payload.createdAt) {
    throw new Error('Payload state OAuth invalide');
  }

  // 15 minutes max
  if (Date.now() - payload.createdAt > 15 * 60 * 1000) {
    throw new Error('State OAuth expiré');
  }

  return payload;
}

export function buildTikTokAuthUrl(state: string) {
  return buildTikTokAuthUrlWithPkce(state);
}

export function generatePkceVerifier() {
  return crypto.randomBytes(64).toString('base64url');
}

export function generatePkceChallenge(verifier: string) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function buildTikTokAuthUrlWithPkce(state: string, codeChallenge?: string) {
  const { clientKey, redirectUri } = ensureEnv();
  const params = new URLSearchParams({
    client_key: clientKey,
    response_type: 'code',
    scope: 'user.info.basic,video.list',
    redirect_uri: redirectUri,
    state,
  });
  if (codeChallenge) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }

  return `${TIKTOK_AUTH_BASE_URL}?${params.toString()}`;
}

async function requestTikTokToken(params: Record<string, string>) {
  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error_description || data.error || 'Erreur lors de la récupération du token TikTok');
  }

  return data as TokenResponse;
}

export async function exchangeCodeForToken(code: string, codeVerifier?: string) {
  const { clientKey, clientSecret, redirectUri } = ensureEnv();
  const payload: Record<string, string> = {
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  };

  if (codeVerifier) {
    payload.code_verifier = codeVerifier;
  }

  return requestTikTokToken(payload);
}

export async function refreshTikTokAccessToken(refreshToken: string) {
  const { clientKey, clientSecret } = ensureEnv();
  return requestTikTokToken({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
}

export async function fetchTikTokUserInfo(accessToken: string) {
  const params = new URLSearchParams({
    fields: 'open_id,display_name,avatar_url',
  });

  const response = await fetch(`${TIKTOK_USER_INFO_URL}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();
  if (!response.ok || (data.error && data.error.code !== 'ok')) {
    throw new Error(data.error?.message || 'Erreur lors de la récupération du profil TikTok');
  }

  return (data.data?.user ?? {}) as TikTokUserInfo;
}

export async function fetchTikTokVideos(accessToken: string, cursor?: string | number, maxCount = 20) {
  const params = new URLSearchParams({
    fields:
      'id,title,video_description,duration,cover_image_url,share_url,create_time,playlist_id,playlist_name',
  });

  const response = await fetch(`${TIKTOK_VIDEO_LIST_URL}?${params.toString()}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cursor: cursor ?? 0,
      max_count: Math.min(Math.max(maxCount, 1), 20),
    }),
  });

  const data = await response.json();
  if (!response.ok || (data.error && data.error.code !== 'ok')) {
    throw new Error(data.error?.message || 'Erreur lors de la récupération des vidéos TikTok');
  }

  return {
    videos: (data.data?.videos ?? []) as TikTokVideoItem[],
    cursor: data.data?.cursor ?? 0,
    hasMore: data.data?.has_more ?? false,
  };
}

export function encryptToken(plainText: string) {
  const { tokenEncryptionKey } = ensureEnv();
  const key = getAesKey(tokenEncryptionKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptToken(encryptedValue: string) {
  const { tokenEncryptionKey } = ensureEnv();
  const [ivB64, tagB64, dataB64] = encryptedValue.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Token chiffré invalide');
  }

  const key = getAesKey(tokenEncryptionKey);
  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const encrypted = Buffer.from(dataB64, 'base64url');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plain.toString('utf8');
}

export function computeExpiresAt(secondsFromNow: number) {
  return new Date(Date.now() + secondsFromNow * 1000).toISOString();
}

export function shouldRefreshToken(expiresAt?: string) {
  if (!expiresAt) return true;
  const expiresAtMs = new Date(expiresAt).getTime();
  return Number.isNaN(expiresAtMs) || expiresAtMs - Date.now() < 60 * 1000;
}

export function normalizeTikTokVideoToRecipeRequest(video: TikTokVideoItem, uid: string): RecipeRequest {
  const titleSource = video.title || video.video_description || 'Recette TikTok';
  const normalizedTitle = titleSource.trim().slice(0, 120) || 'Recette TikTok';
  const recipeSlug = slugify(normalizedTitle) || slugify(`recette-tiktok-${video.id}`) || `recette-tiktok-${Date.now()}`;
  const videoUrl = video.share_url || '';
  const keywords = normalizedTitle.toLowerCase().split(/\s+/).filter(Boolean);

  return {
    title: normalizedTitle,
    url: recipeSlug,
    type: 'Plat',
    preparationTime: 0,
    cookingTime: 0,
    position: 'none',
    recipeParts: [
      {
        title: normalizedTitle,
        steps: ['Voir la vidéo TikTok pour la préparation détaillée.'],
        ingredients: [],
      },
    ],
    images: video.cover_image_url ? [video.cover_image_url] : [],
    video: videoUrl,
    createdBy: uid,
    importedBy: uid,
    source: 'tiktok',
    sourceVideoId: video.id,
    createdAt: new Date(),
    titleKeywords: keywords,
  } as RecipeRequest;
}

export function getTikTokVideoCollectionInfo(video: TikTokVideoItem) {
  const rawCollectionId = (video as any).playlist_id ?? (video as any).collection_id;
  const rawCollectionName = (video as any).playlist_name ?? (video as any).collection_name;

  return {
    id: typeof rawCollectionId === 'string' && rawCollectionId.trim() ? rawCollectionId.trim() : 'all',
    name:
      typeof rawCollectionName === 'string' && rawCollectionName.trim()
        ? rawCollectionName.trim()
        : 'Mes vidéos TikTok',
  };
}

