'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/utils/service-worker';

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

	// Gérer l'événement "beforeinstallprompt" (bouton d'installation)
	let deferredPrompt: any;

	const handleBeforeInstallPrompt = (e: Event) => {
	  // Empêcher l'affichage automatique
	  e.preventDefault();
	  deferredPrompt = e;

	  console.log('[PWA] App installable');

	  // Optionnel: Afficher un bouton d'installation personnalisé
	  // Pour l'instant, on laisse le navigateur gérer
	};

	window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

	// Détecter quand l'app est installée
	window.addEventListener('appinstalled', () => {
	  console.log('[PWA] App installée avec succès !');
	  deferredPrompt = null;
	});

	return () => {
	  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
	};
  }, []);

  // Ce composant ne rend rien
  return null;
}
