"use client";
import React, { useEffect, useState } from 'react';
import './Recette.css';
import { Button } from 'primereact/button';
import Link from 'next/link';
import Image from 'next/image';
import { isOptimizableImage } from '@/lib/utils/image';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { getRecipeUrl } from '@/lib/utils/recipe-url';
import { slugify } from '@/lib/utils/slug';
import { getDepartementName } from '@/constants/departements';
import { loadFirestore } from '@/lib/config/firestore-lazy';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import { Rating } from 'primereact/rating';
import type { RecipeStats } from '@/lib/utils/recipe-stats';

interface RecetteProps {
	recetteId: string;
	title: string;
	type: string;
	fromRequest?: boolean;
	images?: string[];
	position?: string;
	/** Slug de la recette (champ url) : sans lui, le lien est déduit du titre */
	url?: string;
	/** Compteurs lus sur le document recette (aucune requête supplémentaire par carte) */
	stats?: RecipeStats;
}

export const Recette: React.FC<RecetteProps> = ({recetteId, title, type, fromRequest = false, images = [], position = '', url, stats}) => {
	const { user, role } = useAuth();
	const { showToast } = useToast();
	const userId = user?.uid;

	const [likesCount, setLikesCount] = useState<number>(stats?.likesCount ?? 0);
	const [hasLiked, setHasLiked] = useState<boolean>(false);
	const [likePending, setLikePending] = useState(false);
	const averageRating = stats?.ratingAverage ?? null;
	const reviewsCount = stats?.ratingCount ?? 0;

	useEffect(() => {
		setLikesCount(stats?.likesCount ?? 0);
	}, [stats?.likesCount]);

	// Une seule lecture (document likes/{uid}_{recette}) et seulement si l'utilisateur est connecté
	useEffect(() => {
		let cancelled = false;
		if (!userId || fromRequest) {
			setHasLiked(false);
			return;
		}
		loadFirestore()
			.then(({ db, doc, getDoc }) => getDoc(doc(db, 'likes', `${userId}_${recetteId}`)))
			.then((snap) => { if (!cancelled) setHasLiked(snap.exists()); })
			.catch(() => {});
		return () => { cancelled = true; };
	}, [userId, recetteId, fromRequest]);

	const toggleLike = async () => {
		if (!userId || likePending) return;
		const wasLiked = hasLiked;
		// Mise à jour immédiate de l'affichage, annulée en cas d'erreur
		setHasLiked(!wasLiked);
		setLikesCount((c) => Math.max(0, c + (wasLiked ? -1 : 1)));
		setLikePending(true);
		try {
			const { toggleLikeRecipes, unlikeRecipes } = await import('@/lib/services/recipe.service');
			if (wasLiked) {
				await unlikeRecipes(recetteId, userId);
			} else {
				await toggleLikeRecipes(recetteId, userId);
			}
		} catch (error) {
			setHasLiked(wasLiked);
			setLikesCount((c) => Math.max(0, c + (wasLiked ? 1 : -1)));
			showToast({
				severity: 'error',
				summary: 'Erreur',
				detail: 'Une erreur est survenue lors du like'
			});
			throw error;
		} finally {
			setLikePending(false);
		}
	};

	const handleLike = async () => {
		if (!userId) {
			showToast({
				severity: 'warn',
				summary: 'Connexion requise',
				detail: 'Vous devez être connecté pour aimer une recette'
			});
			return;
		}
		try {
			await toggleLike();
		} catch {
			// Erreur déjà signalée par toggleLike
		}
	};

	const handleAcceptRequest = async () => {
		try {
			const { db, doc, getDoc, addDoc, collection } = await loadFirestore();
			const recetteRef = doc(db, 'recipesRequest', recetteId);
			const recetteSnap = await getDoc(recetteRef);
			if (!recetteSnap.exists()) return;

			const recetteData = recetteSnap.data();
			const safeUrl = recetteData.url || slugify(recetteData.title || '') || `recette-${Date.now()}`;
			const docRef = await addDoc(collection(db, 'recipes'), {
				...recetteData,
				url: safeUrl,
				createdAt: new Date(),
				// Compteurs maintenus par les Cloud Functions : jamais repris d'une demande
				likesCount: 0,
				ratingCount: 0,
				ratingAverage: null
			});

			if (docRef.id) {
				await declineRequest(); // Remove from requests after successful addition
			}
		} catch (error) {
			console.error('Error handling recipe request:', error);
		}
	};

	const declineRequest = async () => {
		try {
			const { db, doc, deleteDoc } = await loadFirestore();
			await deleteDoc(doc(db, 'recipesRequest', recetteId));
		} catch (error) {
			console.error('Error declining recipe:', error);
		}
	};

	// `position` est un code de département ("26"), un nom déjà résolu, ou "none" (non renseigné)
	const location = getDepartementName(position) ?? (position === 'none' ? '' : position);

	const renderImage = () => {
		if (images.length === 0) {
			return <div className="recipe-placeholder">Pas d'image</div>;
		}

		return (
			<Image
				src={images[0]}
				alt={title}
				className="recipe-image"
				width={600}
				height={400}
				loading="lazy"
				sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
				unoptimized={!isOptimizableImage(images[0])}
			/>
		);
	};

	const renderAdminButtons = () => {
		if (!fromRequest || role !== 'admin') return null;

		return (
		<div className="admin-actions">
			<Button
				label="Accepter"
				icon="pi pi-check"
				onClick={handleAcceptRequest}
				className="accept-button"
			/>
			<Button
				label="Refuser"
				icon="pi pi-times"
				onClick={declineRequest}
				className="decline-button"
			/>
		</div>
		);
  	};

	return (
		<article className={`recipe-card ${fromRequest ? 'recipe-request' : ''}`}>
			<div className="recipe-image-container">
				{renderImage()}
			</div>

			<div className="recipe-content">
				<h2 className="recipe-title">{title}</h2>

				<div className="recipe-tags">
					<span className="recipe-type">{type}</span>
					{location && <span className="recipe-location">📍 {location}</span>}
				</div>

				{/* Rating Section */}
				{averageRating !== null && (
					<div className="recipe-rating">
						<Rating value={averageRating} readOnly cancel={false} />
						<span className="rating-info">({reviewsCount} avis)</span>
					</div>
				)}

				<div className="recipe-actions">
				{renderAdminButtons()}
					<div className="main-actions">
						{!fromRequest && (
							<div className='recipes-buttons'>
								<Link href={getRecipeUrl({ id: recetteId, title, url })} className="view-recipe">
									<Button
										label="Voir la recette"
										icon="pi pi-eye"
										className="p-button-primary view-button"
									/>
								</Link>

								<Button
									className='recipes-likeButton'
									onClick={handleLike}
									severity={hasLiked ? "danger" : "secondary"}
									icon={hasLiked ? "pi pi-heart-fill" : "pi pi-heart"}
									label={likesCount.toString()}
								/>
							</div>
						)}
					</div>
				</div>
			</div>
		</article>
	);
};

export default Recette;
