import { createHash } from 'crypto';
import type { NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getFirebaseAdminDb } from '@/lib/config/firebase-admin';

interface RateLimitOptions {
  /** Nom de l'action limitée ("newsletter", "tiktok-import"…) */
  action: string;
  /** Ce qui identifie l'appelant : adresse IP ou uid */
  identifier: string;
  /** Nombre d'appels autorisés par fenêtre */
  limit: number;
  /** Durée de la fenêtre, en secondes */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Secondes avant la prochaine tentative possible (si refusé) */
  retryAfter: number;
}

/** Adresse IP de l'appelant (en-tête posé par Vercel), ou "unknown". */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

/**
 * Limite de débit à fenêtre fixe, stockée dans Firestore (collection "rateLimits",
 * inaccessible aux clients). Les routes tournent en serverless : un compteur en mémoire
 * ne serait pas partagé entre les instances.
 *
 * L'identifiant est haché : aucune adresse IP n'est conservée en clair.
 * En cas d'erreur Firestore, l'appel est autorisé (la limite ne doit pas bloquer le site).
 */
export async function checkRateLimit({ action, identifier, limit, windowSeconds }: RateLimitOptions): Promise<RateLimitResult> {
  const key = createHash('sha256').update(`${action}:${identifier}`).digest('hex').slice(0, 40);
  const now = Date.now();

  try {
    const db = getFirebaseAdminDb();
    const ref = db.collection('rateLimits').doc(`${action}_${key}`);

    return await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.data();
      const windowStart: number = data?.windowStart ?? 0;
      const windowEnd = windowStart + windowSeconds * 1000;

      if (!snapshot.exists || now >= windowEnd) {
        transaction.set(ref, {
          action,
          count: 1,
          windowStart: now,
          // Permet une règle TTL Firestore sur ce champ pour purger les anciens compteurs
          expiresAt: Timestamp.fromMillis(now + windowSeconds * 1000),
        });
        return { allowed: true, retryAfter: 0 };
      }

      if ((data?.count ?? 0) >= limit) {
        return { allowed: false, retryAfter: Math.max(1, Math.ceil((windowEnd - now) / 1000)) };
      }

      transaction.update(ref, { count: (data?.count ?? 0) + 1 });
      return { allowed: true, retryAfter: 0 };
    });
  } catch (error) {
    console.error(`Limite de débit indisponible (${action}) :`, error);
    return { allowed: true, retryAfter: 0 };
  }
}
