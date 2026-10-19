import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import Providers from './providers';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import '@/styles/theme.css';
import '@/styles/mobile.css';
import '@/styles/accessibility.css';
import '@/index.css';
import Navbar from '@/components/layout/Navbar/Navbar';
import LegalMention from '@/components/layout/LegalMention/LegalMention';
import SkipToMain from '@/components/layout/SkipToMain/SkipToMain';
import PWAProvider from '@/components/ui/PWAProvider/PWAProvider';
import DeferredWidgets from '@/components/ui/DeferredWidgets/DeferredWidgets';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Police du site, hébergée avec le site (aucun appel à Google depuis le navigateur du visiteur)
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export const metadata = {
	title: {
		default: 'Cuisine Artisanale - Recettes Traditionnelles',
		template: '%s | Cuisine Artisanale',
	},
	description: 'Découvrez des recettes artisanales françaises authentiques, des actualités culinaires et une carte interactive des spécialités régionales. Partagez vos recettes traditionnelles et explorez la gastronomie française.',
	keywords: [
		'recettes françaises',
		'cuisine artisanale',
		'recettes traditionnelles',
		'gastronomie française',
		'recettes régionales',
		'cuisine française',
		'recettes de cuisine',
		'cuisine authentique',
		'spécialités françaises',
		'recettes par département',
	],
	authors: [{ name: 'Cuisine Artisanale' }],
	creator: 'Cuisine Artisanale',
	publisher: 'Cuisine Artisanale',
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			'max-video-preview': -1,
			'max-image-preview': 'large',
			'max-snippet': -1,
		},
	},
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
			{ url: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png' },
			{ url: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png' },
		],
		apple: [
			{ url: '/pwa/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
		],
	},
	openGraph: {
		type: 'website',
		locale: 'fr_FR',
		url: 'https://www.cuisine-artisanale.fr/',
		siteName: 'Cuisine Artisanale',
		title: 'Cuisine Artisanale - Recettes Traditionnelles',
		description: 'Découvrez des recettes artisanales authentiques, des actualités culinaires et une carte interactive des spécialités régionales.',
		images: [
			{
				url: 'https://www.cuisine-artisanale.fr/screenshot-wide.png',
				width: 1280,
				height: 720,
				alt: 'Cuisine Artisanale - Aperçu du site',
			},
		],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Cuisine Artisanale - Recettes Traditionnelles',
		description: 'Découvrez des recettes artisanales françaises authentiques, des actualités culinaires et une carte interactive des spécialités régionales.',
		images: ['https://www.cuisine-artisanale.fr/screenshot-wide.png'],
	},
	category: 'food',
	// Validation du compte AdSense (le script lui-même n'est chargé qu'après consentement)
	other: { 'google-adsense-account': 'ca-pub-7548588175760841' },
	metadataBase: new URL('https://www.cuisine-artisanale.fr'),
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
		<html lang="fr" className={inter.variable}>
			<head>
				{/* Structured Data (JSON-LD) pour le référencement */}
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify({
							'@context': 'https://schema.org',
							'@type': 'WebSite',
							name: 'Cuisine Artisanale',
							description: 'Découvrez des recettes artisanales françaises authentiques, des actualités culinaires et une carte interactive des spécialités régionales.',
							url: 'https://www.cuisine-artisanale.fr',
							image: 'https://www.cuisine-artisanale.fr/screenshot-wide.png',
							potentialAction: {
								'@type': 'SearchAction',
								target: {
									'@type': 'EntryPoint',
									urlTemplate: 'https://www.cuisine-artisanale.fr/recettes?keywords={search_term_string}',
								},
								'query-input': 'required name=search_term_string',
							},
							publisher: {
								'@type': 'Organization',
								name: 'Cuisine Artisanale',
								url: 'https://www.cuisine-artisanale.fr',
							},
						}),
					}}
				/>
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify({
							'@context': 'https://schema.org',
							'@type': 'Organization',
							name: 'Cuisine Artisanale',
							url: 'https://www.cuisine-artisanale.fr',
							logo: 'https://www.cuisine-artisanale.fr/icon.png',
							sameAs: [],
							description: 'Plateforme de partage de recettes artisanales françaises traditionnelles',
						}),
					}}
				/>
			</head>
			<body>
				<Providers>
					<PWAProvider />
					<SkipToMain />
					<Navbar />
					<div className="wrapper" id="main-content" tabIndex={-1}>
						{children}
					</div>
					<LegalMention />
					<DeferredWidgets />
					<ToastContainer />
				</Providers>
			</body>
		</html>
	);
}


