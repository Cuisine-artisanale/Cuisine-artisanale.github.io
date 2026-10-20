'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { getInstallPrompt, promptInstall, subscribeInstallPrompt } from '@/lib/utils/install-prompt';
import './InstallBanner.css';

const VISITS_KEY = 'installBannerVisits';
const VISIT_COUNTED_KEY = 'installBannerVisitCounted';
const DISMISSED_KEY = 'installBannerDismissedAt';
const MIN_VISITS = 3;
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 4000;
// Pas d'interruption pendant une saisie ou une connexion
const HIDDEN_PATHS = ['/recettes/add-recipe', '/recettes/edit', '/login', '/offline'];

type Platform = 'android' | 'ios';

/** Compte une visite par session de navigation ; renvoie le total */
function countVisit(): number {
	try {
		let visits = Number(localStorage.getItem(VISITS_KEY)) || 0;
		if (!sessionStorage.getItem(VISIT_COUNTED_KEY)) {
			visits += 1;
			localStorage.setItem(VISITS_KEY, String(visits));
			sessionStorage.setItem(VISIT_COUNTED_KEY, '1');
		}
		return visits;
	} catch {
		return 0;
	}
}

function isSnoozed(): boolean {
	try {
		const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY)) || 0;
		return Date.now() - dismissedAt < SNOOZE_MS;
	} catch {
		return true;
	}
}

function hasAnsweredCookies(): boolean {
	try {
		return Boolean(localStorage.getItem('cookieConsent'));
	} catch {
		return false;
	}
}

/**
 * Bannière discrète « Installer l'application », sur téléphone et à partir de la 3e visite.
 * Android : bouton d'installation (événement beforeinstallprompt, capté par PWAProvider).
 * iPhone : pas d'installation par script, la bannière indique la marche à suivre.
 */
const InstallBanner: React.FC = () => {
	const pathname = usePathname();
	const installPrompt = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt, () => null);
	const [platform, setPlatform] = useState<Platform | null>(null);
	const [eligible, setEligible] = useState(false);
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		const visits = countVisit();
		const touch = window.matchMedia('(pointer: coarse)').matches;
		const standalone = window.matchMedia('(display-mode: standalone)').matches
			|| (navigator as Navigator & { standalone?: boolean }).standalone === true;
		if (!touch || standalone || visits < MIN_VISITS || isSnoozed()) return;

		setPlatform(/iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'android');
		// Après quelques secondes, et une fois le bandeau cookies traité (pas deux bandeaux à la fois)
		const timer = window.setTimeout(() => setEligible(hasAnsweredCookies()), SHOW_DELAY_MS);
		return () => window.clearTimeout(timer);
	}, []);

	const hiddenHere = HIDDEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
	// Android : sans invite du navigateur (déjà installée, navigateur non compatible), rien à proposer
	const canShow = eligible && !dismissed && !hiddenHere && (platform === 'ios' || (platform === 'android' && installPrompt));
	if (!canShow) return null;

	const dismiss = () => {
		setDismissed(true);
		try {
			localStorage.setItem(DISMISSED_KEY, String(Date.now()));
		} catch {
			// Stockage indisponible : la bannière reviendra à la prochaine visite
		}
	};

	const install = async () => {
		const accepted = await promptInstall();
		if (accepted) setDismissed(true);
		else dismiss();
	};

	return (
		<div className="install-banner" role="dialog" aria-label="Installer l'application">
			{/* eslint-disable-next-line @next/next/no-img-element -- petite icône statique */}
			<img src="/pwa/icon-192.png" alt="" width={32} height={32} className="install-banner-icon" />
			<div className="install-banner-text">
				<strong>Installer l&apos;application</strong>
				{platform === 'ios' ? (
					<span>
						Touchez <span className="pi pi-upload" aria-label="Partager"></span> puis « Sur l&apos;écran d&apos;accueil »
					</span>
				) : (
					<span>Vos recettes, même hors ligne</span>
				)}
			</div>
			{platform === 'android' && (
				<button type="button" className="install-banner-apply" onClick={install}>
					Installer
				</button>
			)}
			<button type="button" className="install-banner-close" aria-label="Plus tard" onClick={dismiss}>
				<span className="pi pi-times" aria-hidden="true"></span>
			</button>
		</div>
	);
};

export default InstallBanner;
