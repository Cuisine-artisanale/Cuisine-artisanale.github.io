import { NextRequest, NextResponse } from 'next/server';
import { CLIENT_EVENTS, isLandingPage, isTrafficSource } from '@/lib/analytics/traffic';
import { checkRateLimit, getClientIp } from '@/lib/server/rate-limit';
import { recordTraffic } from '@/lib/server/traffic-stats';

const BOT_PATTERN = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse/i;

/**
 * Mesure d'audience (src/lib/analytics/track.ts) : arrivée sur le site ou action.
 * Corps : { type: 'visit', source, page } ou { type: 'event', event, source }.
 * Valeurs hors des listes prévues ignorées ; réponse toujours 204 (rien à afficher).
 */
export async function POST(request: NextRequest) {
  const noContent = new NextResponse(null, { status: 204 });
  if (BOT_PATTERN.test(request.headers.get('user-agent') || '')) return noContent;

  const body = await request.json().catch(() => null);
  if (!body || !isTrafficSource(body.source)) return noContent;

  // Limite large : un visiteur normal envoie quelques appels par heure
  const rateLimit = await checkRateLimit({ action: 'track', identifier: getClientIp(request), limit: 30, windowSeconds: 3600 });
  if (!rateLimit.allowed) return noContent;

  if (body.type === 'visit' && isLandingPage(body.page)) {
    await recordTraffic({ type: 'visit', source: body.source, page: body.page });
  } else if (body.type === 'event' && (CLIENT_EVENTS as readonly string[]).includes(body.event)) {
    await recordTraffic({ type: 'event', event: body.event, source: body.source });
  }

  return noContent;
}
