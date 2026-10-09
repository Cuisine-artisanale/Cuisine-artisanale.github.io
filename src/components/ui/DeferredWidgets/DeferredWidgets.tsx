"use client";
import dynamic from 'next/dynamic';

// Composants non essentiels à l'affichage : chargés après l'hydratation, dans des fichiers séparés
// (la popup newsletter embarque framer-motion, ~110 Ko).
const NewsletterPopup = dynamic(() => import('@/components/ui/NewsletterPopup/NewsletterPopup'), { ssr: false });
const CookieConsent = dynamic(() => import('@/components/ui/CookiesConsent/CookiesConsent'), { ssr: false });
const ThirdPartyScripts = dynamic(() => import('@/components/ui/ThirdPartyScripts/ThirdPartyScripts'), { ssr: false });

export default function DeferredWidgets() {
	return (
		<>
			<NewsletterPopup />
			<CookieConsent />
			<ThirdPartyScripts />
		</>
	);
}
