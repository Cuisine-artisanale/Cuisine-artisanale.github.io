/**
 * Mesure d'audience maison : canaux d'arrivée, types de page et événements suivis.
 * Partagé entre le navigateur (classement de la visite) et le serveur (validation).
 * Les valeurs sont des listes fermées : rien d'autre n'est enregistré.
 */

export const TRAFFIC_SOURCES = [
  'google', 'bing', 'autre-moteur', 'pinterest', 'tiktok', 'instagram', 'facebook', 'youtube', 'newsletter', 'direct', 'autre',
] as const;
export type TrafficSource = (typeof TRAFFIC_SOURCES)[number];

export const SOURCE_LABELS: Record<TrafficSource, string> = {
  google: 'Google',
  bing: 'Bing',
  'autre-moteur': 'Autres moteurs',
  pinterest: 'Pinterest',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  newsletter: 'Newsletter',
  direct: 'Accès direct',
  autre: 'Autres sites',
};

export const LANDING_PAGES = [
  'accueil', 'recette', 'liste', 'regions', 'region', 'departement', 'import-tiktok', 'carnet', 'autre',
] as const;
export type LandingPage = (typeof LANDING_PAGES)[number];

export const PAGE_LABELS: Record<LandingPage, string> = {
  accueil: 'Accueil',
  recette: 'Fiche recette',
  liste: 'Liste des recettes',
  regions: 'Index des régions',
  region: 'Page région',
  departement: 'Page département',
  'import-tiktok': 'Présentation import TikTok',
  carnet: 'Carnet / compte',
  autre: 'Autres pages',
};

/** Événements envoyés par le navigateur */
export const CLIENT_EVENTS = ['signup', 'pin_click'] as const;
/** Événements enregistrés par le serveur (routes d'import) */
export const SERVER_EVENTS = ['import_analyzed', 'import_saved'] as const;
export type TrafficEvent = (typeof CLIENT_EVENTS)[number] | (typeof SERVER_EVENTS)[number];

export const EVENT_LABELS: Record<TrafficEvent, string> = {
  signup: 'Inscriptions',
  pin_click: 'Clics « Épingler »',
  import_analyzed: 'Vidéos analysées',
  import_saved: 'Recettes importées',
};

export function isTrafficSource(value: unknown): value is TrafficSource {
  return typeof value === 'string' && (TRAFFIC_SOURCES as readonly string[]).includes(value);
}

export function isLandingPage(value: unknown): value is LandingPage {
  return typeof value === 'string' && (LANDING_PAGES as readonly string[]).includes(value);
}

/** Canal correspondant à un paramètre utm_source ("Pinterest", "tiktok_bio"…). */
export function sourceFromUtm(utmSource: string): TrafficSource {
  const value = utmSource.toLowerCase();
  const match = TRAFFIC_SOURCES.find((source) => source !== 'direct' && source !== 'autre' && value.includes(source));
  if (match) return match;
  if (value.includes('fb') || value.includes('meta')) return 'facebook';
  if (value.includes('mail')) return 'newsletter';
  return 'autre';
}

/** Canal correspondant au site d'où vient le visiteur (document.referrer). */
export function sourceFromReferrer(referrer: string, ownHost: string): TrafficSource | null {
  if (!referrer) return 'direct';
  let host: string;
  try {
    const url = new URL(referrer);
    // Applications Android : android-app://com.pinterest/
    host = url.protocol === 'android-app:' ? url.hostname || url.pathname.replace(/^\/+/, '') : url.hostname;
  } catch {
    return 'autre';
  }
  host = host.toLowerCase().replace(/^www\./, '');
  if (host === ownHost.toLowerCase().replace(/^www\./, '')) return null; // navigation interne

  if (/(^|\.)google\.|googlequicksearchbox/.test(host)) return 'google';
  if (/(^|\.)bing\.com$/.test(host)) return 'bing';
  if (/duckduckgo|qwant|ecosia|yahoo|yandex|brave|lilo/.test(host)) return 'autre-moteur';
  if (/pinterest|(^|\.)pin\.it$/.test(host)) return 'pinterest';
  if (/tiktok/.test(host)) return 'tiktok';
  if (/instagram/.test(host)) return 'instagram';
  if (/facebook|(^|\.)fb\.(com|me)$|com\.facebook/.test(host)) return 'facebook';
  if (/youtube|youtu\.be/.test(host)) return 'youtube';
  if (/mail|outlook|gmail/.test(host)) return 'newsletter';
  return 'autre';
}

/** Type de la page d'arrivée, d'après son chemin. */
export function landingPageOf(pathname: string): LandingPage {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return 'accueil';
  const [first, second, third] = segments;
  if (first === 'recettes') {
    if (!second) return 'liste';
    return second === 'add-recipe' || second === 'edit' ? 'autre' : 'recette';
  }
  if (first === 'regions') return third ? 'departement' : second ? 'region' : 'regions';
  if (first === 'import-tiktok') return 'import-tiktok';
  if (first === 'carnet' || first === 'account') return 'carnet';
  return 'autre';
}
