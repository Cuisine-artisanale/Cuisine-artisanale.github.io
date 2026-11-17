"use client";
import { useEffect, useState } from 'react';
import Script from 'next/script';
import { loadFirestore } from '@/lib/config/firestore-lazy';
import { SITE_SETTINGS_COLLECTION, SITE_SETTINGS_DOC } from '@/lib/config/site-settings';

export const COOKIE_CONSENT_EVENT = 'cookie-consent-updated';

interface ConsentChoices {
	analytics: boolean;
	ads: boolean;
}

function readConsent(): ConsentChoices {
	try {
		const stored = localStorage.getItem('cookieConsent');
		if (!stored) return { analytics: false, ads: false };
		const parsed = JSON.parse(stored);
		return { analytics: !!parsed.analytics, ads: !!parsed.ads };
	} catch {
		return { analytics: false, ads: false };
	}
}

/**
 * Scripts tiers chargés uniquement après consentement (bannière cookies),
 * et en différé pour ne pas ralentir l'affichage de la page.
 */
export default function ThirdPartyScripts() {
	const [consent, setConsent] = useState<ConsentChoices>({ analytics: false, ads: false });
	const [adsEnabled, setAdsEnabled] = useState(false);

	useEffect(() => {
		setConsent(readConsent());
		const onUpdate = () => setConsent(readConsent());
		window.addEventListener(COOKIE_CONSENT_EVENT, onUpdate);
		return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onUpdate);
	}, []);

	// Interrupteur « Publicités » de l'administration : lu seulement si le visiteur a accepté
	// les cookies publicitaires, pour ne pas télécharger Firestore pour rien.
	useEffect(() => {
		if (!consent.ads) return;
		let cancelled = false;
		(async () => {
			try {
				const { db, doc, getDoc } = await loadFirestore();
				const snap = await getDoc(doc(db, SITE_SETTINGS_COLLECTION, SITE_SETTINGS_DOC));
				if (!cancelled) setAdsEnabled(snap.data()?.adsEnabled === true);
			} catch {
				// Réglage illisible : pas de publicité
			}
		})();
		return () => { cancelled = true; };
	}, [consent.ads]);

	return (
		<>
			{consent.analytics && (
				<Script id="hotjar" strategy="lazyOnload">
					{`(function(h,o,t,j,a,r){
						h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
						h._hjSettings={hjid:6600202,hjsv:6};
						a=o.getElementsByTagName('head')[0];
						r=o.createElement('script');r.async=1;
						r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
						a.appendChild(r);
					})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`}
				</Script>
			)}
			{consent.ads && adsEnabled && (
				<Script
					id="adsense"
					strategy="lazyOnload"
					src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7548588175760841"
					crossOrigin="anonymous"
				/>
			)}
		</>
	);
}
