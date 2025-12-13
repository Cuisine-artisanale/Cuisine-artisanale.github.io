import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Script from 'next/script';
import Providers from './providers';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import '@/styles/theme.css';
import '@/styles/mobile.css';
import '@/styles/accessibility.css';
import '@/index.css';
import { Navbar, LegalMention } from '@/components/layout';
import { PWAProvider } from '@/components/ui';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Lazy-load components that are not critical for FCP
const NewsletterPopupLazy = dynamic(
	() => import('@/components/ui/NewsletterPopup/NewsletterPopup'),
	{ ssr: true, loading: () => null }
);

const CookieConsentLazy = dynamic(
	() => import('@/components/ui/CookiesConsent/CookiesConsent'),
	{ ssr: true, loading: () => null }
);

export const metadata = {
	title: 'Cuisine artisanale',
	description: 'Recettes, actualités et cartes pour la cuisine artisanale.',
	manifest: '/manifest.json',
	appleWebApp: {
		capable: true,
		statusBarStyle: 'default',
		title: 'Cuisine Artisanale',
	},
	applicationName: 'Cuisine Artisanale',
	formatDetection: {
		telephone: false,
	},
	icons: {
		icon: [
			{ url: '/favicon.ico' },
			{ url: '/icon.png', sizes: '192x192', type: 'image/png' },
			{ url: '/icon.png', sizes: '512x512', type: 'image/png' },
		],
		apple: [
			{ url: '/icon.png', sizes: '180x180', type: 'image/png' },
		],
	},
	openGraph: {
		type: 'website',
		locale: 'fr_FR',
		url: 'https://www.cuisine-artisanale.fr/',
		siteName: 'Cuisine Artisanale',
		title: 'Cuisine artisanale',
		description: 'Recettes, actualités et cartes pour la cuisine artisanale.',
		images: [
			{
				url: '/icon.png',
				width: 512,
				height: 512,
				alt: 'Cuisine Artisanale',
			},
		],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Cuisine artisanale',
		description: 'Recettes, actualités et cartes pour la cuisine artisanale.',
		images: ['/icon.png'],
	},
};

export const viewport = {
	width: 'device-width',
	initialScale: 1,
	maximumScale: 5,
	userScalable: true,
	viewportFit: 'cover',
	themeColor: '#8B4513',
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="fr">
			<head>
				{/* Hotjar Tracking Code for site recette */}
				<script
					dangerouslySetInnerHTML={{
						__html: `
							(function(h,o,t,j,a,r){
								h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
								h._hjSettings={hjid:6600202,hjsv:6};
								a=o.getElementsByTagName('head')[0];
								r=o.createElement('script');r.async=1;
								r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
								a.appendChild(r);
							})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
						`,
					}}
				/>
				{/* Google AdSense */}
				<script
					async
					src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7548588175760841"
					crossOrigin="anonymous"
				/>
			</head>
			<body>
				<Providers>
					<PWAProvider />
					<Navbar />
					<div className="wrapper">
						{children}
					</div>
					<LegalMention />
					<NewsletterPopupLazy />
					<CookieConsentLazy />
					<ToastContainer />
				</Providers>
				{/* Pour les scripts, utilisez next/script (recommandé) */}
				{/* Exemple :
				<Script
					src="https://vitals.vercel-insights.com/v1/vitals.js"
					strategy="afterInteractive"
				/>
				*/}
			</body>
		</html>
	);
}


