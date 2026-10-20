'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/utils/service-worker';
import { setInstallPrompt, type InstallPromptEvent } from '@/lib/utils/install-prompt';
import UpdateBanner from '@/components/ui/UpdateBanner/UpdateBanner';

/**
 * PWA PROVIDER
 *
 * Composant client qui enregistre le Service Worker
 * et gère les fonctionnalités PWA
 */
export default function PWAProvider() {
	useEffect(() => {
	// Enregistrer le Service Worker en production uniquement
	if (process.env.NODE_ENV === 'production') {
	  registerServiceWorker();
	}

	// Invite d'installation gardée pour le bouton « Installer » de l'import TikTok
	// (l'app installée apparaît dans le menu Partager de TikTok sur Android)
	const handleBeforeInstallPrompt = (e: Event) => {
	  e.preventDefault();
	  setInstallPrompt(e as InstallPromptEvent);
	};
	const handleAppInstalled = () => setInstallPrompt(null);

	window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
	window.addEventListener('appinstalled', handleAppInstalled);

	return () => {
	  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
	  window.removeEventListener('appinstalled', handleAppInstalled);
	};
	}, []);

	return <UpdateBanner />;
}
