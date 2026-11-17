/**
 * Réglages du site modifiables depuis l'administration (page « Réglages »).
 * Stockés dans un seul document Firestore : settings/site.
 */
export const SITE_SETTINGS_COLLECTION = 'settings';
export const SITE_SETTINGS_DOC = 'site';

export interface SiteSettings {
	/** Publicités Google AdSense affichées (après consentement du visiteur). */
	adsEnabled: boolean;
}

/** Valeurs utilisées tant que le document n'existe pas : tout est désactivé. */
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
	adsEnabled: false,
};
