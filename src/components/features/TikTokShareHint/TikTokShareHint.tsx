"use client";
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { getInstallPrompt, promptInstall, subscribeInstallPrompt } from '@/lib/utils/install-prompt';
import './TikTokShareHint.css';

type Platform = 'android' | 'ios' | 'other';

/**
 * Astuce affichée sur téléphone : comment envoyer une vidéo depuis l'app TikTok.
 * Android : l'app installée apparaît dans le menu Partager de TikTok (share_target du manifest).
 * iOS : pas de partage vers une app web, on passe par « Copier le lien » puis « Coller le lien ».
 */
const TikTokShareHint: React.FC = () => {
	const [platform, setPlatform] = useState<Platform | null>(null);
	const [installed, setInstalled] = useState(false);
	const installPrompt = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt, () => null);

	useEffect(() => {
		if (!window.matchMedia('(pointer: coarse)').matches) return;
		const userAgent = navigator.userAgent;
		setPlatform(/iPhone|iPad|iPod/i.test(userAgent) ? 'ios' : /Android/i.test(userAgent) ? 'android' : 'other');
		setInstalled(window.matchMedia('(display-mode: standalone)').matches);
	}, []);

	if (!platform || platform === 'other') return null;

	if (platform === 'ios') {
		return (
			<p className="tiktok-share-hint">
				<span className="pi pi-lightbulb" aria-hidden="true"></span>
				<span>Dans TikTok, touchez <strong>Partager</strong> puis <strong>Copier le lien</strong>, revenez ici et touchez <strong>Coller le lien</strong>.</span>
			</p>
		);
	}

	if (installed) {
		return (
			<p className="tiktok-share-hint">
				<span className="pi pi-lightbulb" aria-hidden="true"></span>
				<span>Plus rapide : dans TikTok, touchez <strong>Partager</strong> puis <strong>Cuisine Artisanale</strong>, l&apos;analyse démarre toute seule.</span>
			</p>
		);
	}

	return (
		<div className="tiktok-share-hint">
			<span className="pi pi-lightbulb" aria-hidden="true"></span>
			<div>
				<p>
					Installez l&apos;application : elle apparaîtra dans le menu <strong>Partager</strong> de TikTok, et l&apos;analyse démarrera toute seule.
				</p>
				{installPrompt ? (
					<button type="button" className="tiktok-share-hint-install" onClick={() => void promptInstall()}>
						<span className="pi pi-download" aria-hidden="true"></span> Installer l&apos;application
					</button>
				) : (
					<p className="tiktok-share-hint-manual">Menu du navigateur (⋮), puis « Installer l&apos;application » ou « Ajouter à l&apos;écran d&apos;accueil ».</p>
				)}
			</div>
		</div>
	);
};

export default TikTokShareHint;
