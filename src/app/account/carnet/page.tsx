"use client";
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { isOptimizableImage } from '@/lib/utils/image';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import RequireEmailVerification from '@/components/ui/RequireEmailVerification/RequireEmailVerification';
import '@/components/features/Recette/Recette.css';
import '../mes-recettes/mes-recettes.css';

interface CarnetRecipe {
	id: string;
	title: string;
	type: string;
	image?: string;
	/** Temps total (préparation + cuisson), en minutes */
	time: number;
}

/** Carnet privé : les recettes importées par l'utilisateur, visibles par lui seul. */
export default function CarnetPage() {
	const { user } = useAuth();
	const [recettes, setRecettes] = useState<CarnetRecipe[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!user) return;
		let cancelled = false;

		(async () => {
			try {
				setLoading(true);
				setError(null);
				const snapshot = await getDocs(query(collection(db, 'users', user.uid, 'carnet'), orderBy('createdAt', 'desc')));
				if (cancelled) return;
				setRecettes(
					snapshot.docs.map((doc) => {
						const data = doc.data();
						return {
							id: doc.id,
							title: data.title || 'Recette sans titre',
							type: data.type || '',
							image: Array.isArray(data.images) ? data.images[0] : undefined,
							time: (Number(data.preparationTime) || 0) + (Number(data.cookingTime) || 0),
						};
					})
				);
			} catch (err) {
				console.error('Erreur lors du chargement du carnet :', err);
				if (!cancelled) setError('Erreur lors du chargement de votre carnet');
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => { cancelled = true; };
	}, [user]);

	if (loading) {
		return (
			<RequireEmailVerification>
				<div className="recipes-loading">
					<div className="spinner"></div>
					<p>Chargement de votre carnet...</p>
				</div>
			</RequireEmailVerification>
		);
	}

	return (
		<RequireEmailVerification>
			<div className="account-recipes">
				<div className="recipes-header">
					<h2>Mon Carnet</h2>
					<Link href="/recettes/add-recipe?mode=tiktok" className="create-recipe-btn">
						<i className="pi pi-video"></i>
						Importer une vidéo
					</Link>
				</div>

				{error && (
					<div className="error-message">
						<i className="pi pi-exclamation-triangle"></i>
						<span>{error}</span>
					</div>
				)}

				{!error && recettes.length === 0 ? (
					<div className="empty-state">
						<i className="pi pi-lock empty-icon"></i>
						<h3>Votre carnet est vide</h3>
						<p>Importez une vidéo TikTok : la recette est mise au propre et rangée ici, visible par vous seul.</p>
						<Link href="/recettes/add-recipe?mode=tiktok" className="btn-primary">
							<i className="pi pi-video"></i>
							Importer ma première vidéo
						</Link>
					</div>
				) : (
					<div className="recipes-grid">
						{recettes.map((recette) => (
							<article key={recette.id} className="recipe-card">
								<Link href={`/carnet?id=${encodeURIComponent(recette.id)}`} className="recipe-card-link">
									<div className="recipe-card-image">
										{recette.image ? (
											<Image
												src={recette.image}
												alt=""
												width={600}
												height={450}
												loading="lazy"
												sizes="(max-width: 768px) 100vw, 33vw"
												unoptimized={!isOptimizableImage(recette.image)}
											/>
										) : (
											<span className="recipe-card-placeholder pi pi-image" aria-hidden="true"></span>
										)}
									</div>
									<div className="recipe-card-body">
										<p className="recipe-card-tags">
											{recette.type && <span className="recipe-card-type">{recette.type}</span>}
										</p>
										<h3 className="recipe-card-title">{recette.title}</h3>
										{recette.time > 0 && (
											<p className="recipe-card-meta">
												<span>
													<span className="pi pi-clock" aria-hidden="true"></span>
													{recette.time} min
												</span>
											</p>
										)}
									</div>
								</Link>
							</article>
						))}
					</div>
				)}
			</div>
		</RequireEmailVerification>
	);
}
