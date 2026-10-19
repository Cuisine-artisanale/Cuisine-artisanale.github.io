/**
 * Invite d'installation de la PWA (événement `beforeinstallprompt`, Chrome/Android).
 * PWAProvider la capte au chargement ; un bouton « Installer » peut la déclencher plus tard.
 */
export interface InstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export function setInstallPrompt(event: InstallPromptEvent | null) {
	deferredPrompt = event;
	listeners.forEach((listener) => listener());
}

export function getInstallPrompt() {
	return deferredPrompt;
}

export function subscribeInstallPrompt(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** Affiche l'invite du navigateur ; l'invite ne sert qu'une fois. */
export async function promptInstall() {
	const event = deferredPrompt;
	if (!event) return false;
	setInstallPrompt(null);
	await event.prompt();
	const { outcome } = await event.userChoice;
	return outcome === 'accepted';
}
