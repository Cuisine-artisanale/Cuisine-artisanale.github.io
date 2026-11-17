"use client";
import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { DEFAULT_SITE_SETTINGS, SITE_SETTINGS_COLLECTION, SITE_SETTINGS_DOC, type SiteSettings } from '@/lib/config/site-settings';
import { toastMessages } from '@/lib/utils/toast';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import './reglages.css';

const settingsRef = () => doc(db, SITE_SETTINGS_COLLECTION, SITE_SETTINGS_DOC);

/** Réglages du site : interrupteurs appliqués à tous les visiteurs. */
export default function ReglagesPage() {
	const { showToast } = useToast();
	const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		getDoc(settingsRef())
			.then((snap) => setSettings({ ...DEFAULT_SITE_SETTINGS, ...(snap.data() as Partial<SiteSettings> | undefined) }))
			.catch((error) => console.error('Réglages indisponibles :', error))
			.finally(() => setLoading(false));
	}, []);

	const toggleAds = async () => {
		const adsEnabled = !settings.adsEnabled;
		setSaving(true);
		try {
			await setDoc(settingsRef(), { adsEnabled, updatedAt: new Date() }, { merge: true });
			setSettings((current) => ({ ...current, adsEnabled }));
			showToast({
				severity: 'success',
				summary: toastMessages.success.default,
				detail: adsEnabled ? 'Publicités activées' : 'Publicités désactivées',
			});
		} catch (error) {
			console.error('Erreur d\'enregistrement des réglages :', error);
			showToast({
				severity: 'error',
				summary: toastMessages.error.default,
				detail: 'Impossible d\'enregistrer le réglage',
			});
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="reglages-admin">
			<header className="admin-page-header">
				<div>
					<h1>Réglages</h1>
					<p>Options appliquées à tout le site.</p>
				</div>
			</header>

			<section className="reglages-card">
				<div className="reglages-text">
					<h2 id="reglage-ads">Publicités (Google AdSense)</h2>
					<p>
						Charge le script AdSense pour les visiteurs qui ont accepté les cookies publicitaires.
						Désactivé, aucun script publicitaire n&apos;est chargé.
					</p>
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={settings.adsEnabled}
					aria-labelledby="reglage-ads"
					className={`reglages-switch${settings.adsEnabled ? ' is-on' : ''}`}
					onClick={toggleAds}
					disabled={loading || saving}
				>
					<span className="reglages-switch-knob" aria-hidden="true"></span>
					<span className="reglages-switch-label">{loading ? '…' : settings.adsEnabled ? 'Activé' : 'Désactivé'}</span>
				</button>
			</section>
		</div>
	);
}
