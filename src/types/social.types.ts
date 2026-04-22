/**
 * Types liés aux intégrations sociales (MVP TikTok)
 */

export type SocialProvider = 'tiktok';

export interface TikTokTokenPayload {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  refreshExpiresAt?: string;
  scope?: string;
  tokenType?: string;
}

export interface TikTokConnection {
  provider: SocialProvider;
  connected: boolean;
  tiktokOpenId?: string;
  displayName?: string;
  avatarUrl?: string;
  token: TikTokTokenPayload;
  updatedAt: Date;
}

export interface TikTokImportState {
  uid: string;
  lastCursor: string | number;
  lastSyncAt?: Date;
  lastImportedCount?: number;
  enabled: boolean;
}

export interface TikTokVideoItem {
  id: string;
  title?: string;
  video_description?: string;
  share_url?: string;
  cover_image_url?: string;
  create_time?: number;
}

