'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { applyUpdate, getWaitingWorker, subscribeWaitingWorker } from '@/lib/utils/service-worker';
import './UpdateBanner.css';

/** Bannière « Nouvelle version disponible » : la mise à jour n'est appliquée qu'au clic. */
const UpdateBanner: React.FC = () => {
	const waiting = useSyncExternalStore(subscribeWaitingWorker, getWaitingWorker, () => null);
	const [dismissed, setDismissed] = useState(false);
	const [updating, setUpdating] = useState(false);

	if (!waiting || dismissed) return null;

	return (
	<div className="update-banner" role="status">
	  <span className="pi pi-sparkles" aria-hidden="true"></span>
	  <p>Une nouvelle version du site est disponible.</p>
	  <button
		type="button"
		className="update-banner-apply"
		disabled={updating}
		onClick={() => {
		  setUpdating(true);
		  applyUpdate();
		}}
	  >
		{updating ? 'Mise à jour…' : 'Mettre à jour'}
	  </button>
	  <button type="button" className="update-banner-close" aria-label="Plus tard" onClick={() => setDismissed(true)}>
		<span className="pi pi-times" aria-hidden="true"></span>
	  </button>
	</div>
	);
};

export default UpdateBanner;
