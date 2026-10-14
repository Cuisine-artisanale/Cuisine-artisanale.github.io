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
import { revalidateRecipe } from '@/lib/utils/revalidate-recipe';
import { loadFirestore } from '@/lib/config/firestore-lazy';
import { useToast } from '@/contexts/ToastContext/ToastContext';
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
	/** Temps total (préparation + cuisson), en minutes */
	time?: number;
}

/** Durée lisible : 45 → « 45 min », 90 → « 1 h 30 ». */
function formatDuration(minutes: number): string {
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`;
}

export const Recette: React.FC<RecetteProps> = ({recetteId, title, type, fromRequest = false, images = [], position = '', url, stats, time}) => {
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
			// La fiche de la recette (en cache) affiche aussi le nombre de likes
			revalidateRecipe({ id: recetteId, url });
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
			// Les ingrédients nouveaux n'entrent au catalogue qu'ici, une fois la recette validée
			const { syncRecipeIngredientsWithCatalog } = await import('@/lib/services/ingredient-catalog.service');
			const { recipeParts } = await syncRecipeIngredientsWithCatalog(recetteData.recipeParts);
			const docRef = await addDoc(collection(db, 'recipes'), {
				...recetteData,
				recipeParts,
				url: safeUrl,
				createdAt: new Date(),
				// Compteurs maintenus par les Cloud Functions : jamais repris d'une demande
				likesCount: 0,
				ratingCount: 0,
				ratingAverage: null,
				viewsCount: 0,
				popularity: 0
			});

			if (docRef.id) {
				revalidateRecipe({ id: docRef.id, url: safeUrl }, { lists: true });
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

	const renderAdminButtons = () => {
		if (!fromRequest || role !== 'admin') return null;

		return (
		<div className="recipe-card-admin-actions">
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

	const content = (
		<>
			<div className="recipe-card-image">
				{images.length > 0 ? (
					<Image
						src={images[0]}
						alt=""
						width={600}
						height={450}
						loading="lazy"
						sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
						unoptimized={!isOptimizableImage(images[0])}
					/>
				) : (
					<span className="recipe-card-placeholder pi pi-image" aria-hidden="true"></span>
				)}
			</div>

			<div className="recipe-card-body">
				<p className="recipe-card-tags">
					{type && <span className="recipe-card-type">{type}</span>}
					{location && (
						<span className="recipe-card-location">
							<span className="pi pi-map-marker" aria-hidden="true"></span>
							{location}
						</span>
					)}
				</p>
				<h2 className="recipe-card-title">{title}</h2>
				{(time || averageRating !== null) && (
					<p className="recipe-card-meta">
						{time ? (
							<span>
								<span className="pi pi-clock" aria-hidden="true"></span>
								{formatDuration(time)}
							</span>
						) : null}
						{averageRating !== null && (
							<span>
								<span className="pi pi-star-fill" aria-hidden="true"></span>
								{averageRating.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}
								<span className="recipe-card-reviews"> ({reviewsCount} avis)</span>
							</span>
						)}
					</p>
				)}
			</div>
		</>
	);

	return (
		<article className={`recipe-card${fromRequest ? ' recipe-request' : ''}`}>
			{fromRequest ? (
				<div className="recipe-card-link">{content}</div>
			) : (
				// Toute la carte mène à la recette
				<Link href={getRecipeUrl({ id: recetteId, title, url })} className="recipe-card-link">
					{content}
				</Link>
			)}

			{!fromRequest && (
				<button
					type="button"
					className={`recipe-card-like${hasLiked ? ' is-active' : ''}`}
					aria-pressed={hasLiked}
					aria-label={hasLiked ? `Ne plus aimer ${title}` : `Aimer ${title}`}
					onClick={handleLike}
				>
					<span className={`pi ${hasLiked ? 'pi-heart-fill' : 'pi-heart'}`} aria-hidden="true"></span>
					{likesCount > 0 && likesCount}
				</button>
			)}

			{renderAdminButtons()}
		</article>
	);
};

export default Recette;
