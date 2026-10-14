import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdminDb } from '@/lib/config/firebase-admin';
import type { LandingPage, TrafficEvent, TrafficSource } from '@/lib/analytics/traffic';

type TrafficRecord =
  | { type: 'visit'; source: TrafficSource; page: LandingPage }
  | { type: 'event'; event: TrafficEvent; source: TrafficSource };

/** Jour en cours à Paris, "2026-10-14" */
function parisDay(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(new Date());
}

/**
 * Totaux d'audience par jour, dans "trafficStats/{jour}" (écrit uniquement par le serveur) :
 *  - visits.{canal} : arrivées sur le site
 *  - landings.{page} : type de page d'arrivée
 *  - events.{événement}.{canal} : actions, selon le canal de première visite
 * Aucune donnée par visiteur. Les erreurs sont seulement journalisées.
 */
export async function recordTraffic(record: TrafficRecord): Promise<void> {
  const day = parisDay();
  const increment = FieldValue.increment(1);
  const data =
    record.type === 'visit'
      ? { visits: { [record.source]: increment }, landings: { [record.page]: increment } }
      : { events: { [record.event]: { [record.source]: increment } } };

  try {
    await getFirebaseAdminDb().doc(`trafficStats/${day}`).set({ date: day, ...data }, { merge: true });
  } catch (error) {
    console.error('Statistiques de trafic indisponibles :', error);
  }
}
