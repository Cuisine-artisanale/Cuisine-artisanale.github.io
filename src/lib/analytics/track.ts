/**
 * Côté navigateur : enregistre l'arrivée sur le site et quelques actions, sans cookie ni
 * identifiant. Seuls le canal d'arrivée et le type de page sont envoyés (/api/track),
 * et le serveur n'en garde que des totaux par jour.
 *
 * Le canal de la première visite est retenu dans le navigateur (13 mois au plus, comme
 * l'exige la CNIL pour la mesure d'audience exemptée de consentement), pour savoir d'où
 * viennent les gens qui s'inscrivent ou importent, même s'ils reviennent plus tard.
 */
import {
  type TrafficSource,
  isTrafficSource,
  landingPageOf,
  sourceFromReferrer,
  sourceFromUtm,
} from '@/lib/analytics/traffic';

const FIRST_SOURCE_KEY = 'ca_first_source';
const SESSION_KEY = 'ca_visit_tracked';
const FIRST_SOURCE_MAX_AGE = 395 * 24 * 60 * 60 * 1000; // 13 mois

function send(payload: Record<string, string>) {
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'application/json' }))) return;
    fetch('/api/track', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
  } catch {
    // La mesure ne doit jamais gêner la navigation
  }
}

/** Canal de la visite en cours : utm_source s'il est présent, sinon le site d'origine. */
function currentSource(): TrafficSource | null {
  const utm = new URLSearchParams(window.location.search).get('utm_source');
  if (utm) return sourceFromUtm(utm);
  return sourceFromReferrer(document.referrer, window.location.hostname);
}

/** Canal de la toute première visite (ou de la visite en cours si rien n'est retenu). */
export function getFirstSource(): TrafficSource {
  try {
    const stored = JSON.parse(localStorage.getItem(FIRST_SOURCE_KEY) || 'null');
    if (stored && isTrafficSource(stored.source) && Date.now() - Number(stored.at) < FIRST_SOURCE_MAX_AGE) {
      return stored.source;
    }
  } catch {
    // Stockage indisponible (navigation privée…)
  }
  return currentSource() ?? 'direct';
}

/** À appeler une fois par chargement : compte l'arrivée sur le site (une fois par session). */
export function trackVisit() {
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // Sans sessionStorage, chaque chargement complet compte comme une arrivée
  }

  const source = currentSource();
  if (!source) return; // arrivée depuis une autre page du site

  try {
    const stored = JSON.parse(localStorage.getItem(FIRST_SOURCE_KEY) || 'null');
    if (!stored || Date.now() - Number(stored.at) >= FIRST_SOURCE_MAX_AGE) {
      localStorage.setItem(FIRST_SOURCE_KEY, JSON.stringify({ source, at: Date.now() }));
    }
  } catch {
    // Stockage indisponible
  }

  send({ type: 'visit', source, page: landingPageOf(window.location.pathname) });
}

/** Action à compter, rattachée au canal de la première visite. */
export function trackEvent(event: 'signup' | 'pin_click') {
  send({ type: 'event', event, source: getFirstSource() });
}
