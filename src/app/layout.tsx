import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Providers from './providers';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import '@/styles/theme.css';
import '@/styles/mobile.css';
import '@/styles/accessibility.css';
import '@/index.css';
import Navbar from '@/components/Navbar/Navbar';
import LegalMention from '@/components/LegalMention/LegalMention';
import PWAProvider from '@/components/PWAProvider/PWAProvider';
import SkipToMain from '@/components/SkipToMain/SkipToMain';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Lazy-load components that are not critical for FCP
const NewsletterPopup = dynamic(
	() => import('@/components/NewsletterPopup/NewsletterPopup'),
	{ ssr: true, loading: () => null }
);

const CookieConsent = dynamic(
	() => import('@/components/CookiesConsent/CookiesConsent'),
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
	themeColor: '#8B4513',
	viewport: {
		width: 'device-width',
		initialScale: 1,
		maximumScale: 5,
		userScalable: true,
		viewportFit: 'cover',
	},
	icons: {
		icon: [
			{ url: '/favicon.ico' },
			{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
			{ url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
		],
		apple: [
			{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
		],
	},
	openGraph: {
		type: 'website',
		locale: 'fr_FR',
		url: 'https://www.aymeric-sabatier.fr/Cuisine-artisanale/',
		siteName: 'Cuisine Artisanale',
		title: 'Cuisine artisanale',
		description: 'Recettes, actualités et cartes pour la cuisine artisanale.',
		images: [
			{
				url: '/icon-512.png',
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
		images: ['/icon-512.png'],
	},
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="fr">
			<body>
				<Providers>
					<SkipToMain />
					<PWAProvider />
					<Navbar />
					<div className="wrapper">
						{children}
					</div>
					<LegalMention />
					<NewsletterPopup />
					<CookieConsent />
					<ToastContainer />
				</Providers>
			</body>
		</html>
	);
}


