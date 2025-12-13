"use client";
import React, { useState } from 'react';
import './Recette.css';
import { Button } from 'primereact/button';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { getRecipeUrl } from '@/lib/utils/recipe-url';
import { addDoc, collection, deleteDoc, doc, getDoc } from '@firebase/firestore';
import { db } from '@/lib/config/firebase';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import { Rating } from 'primereact/rating';
import { useRecipeLikes, useRecipeReviews } from '@/hooks';

interface RecetteProps {
	recetteId: string;
	title: string;
	type: string;
	fromRequest?: boolean;
	images?: string[];
	position?: string;
}

export const Recette: React.FC<RecetteProps> = ({recetteId, title, type, fromRequest = false, images = [], position = ''}) => {
	const { user, role } = useAuth();
	const { showToast } = useToast();
	const userId = user?.uid;

	// Utiliser les hooks personnalisés
	const { likesCount, hasLiked, toggleLike } = useRecipeLikes({
		recipeId: recetteId,
		userId: userId || null,
		onError: (error) => {
			showToast({
				severity: 'error',
				summary: 'Erreur',
				detail: 'Une erreur est survenue lors du like'
			});
		}
	});

	const { averageRating, reviewsCount } = useRecipeReviews({
		recipeId: recetteId
	});

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
		} catch (error) {
			// L'erreur est déjà gérée par le hook via onError
		}
	};

	const handleAcceptRequest = async () => {
		try {
			const recetteRef = doc(db, 'recipesRequest', recetteId);
			const recetteSnap = await getDoc(recetteRef);
			if (!recetteSnap.exists()) return;

			const recetteData = recetteSnap.data();
			const docRef = await addDoc(collection(db, 'recipes'), {
				...recetteData,
				createdAt: new Date()
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
			await deleteDoc(doc(db, 'recipesRequest', recetteId));
		} catch (error) {
			console.error('Error declining recipe:', error);
		}
	};

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
				unoptimized={true}
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
					{position && <span className="recipe-location">📍 {position}</span>}
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
								<Link href={getRecipeUrl({ id: recetteId, title })} className="view-recipe">
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
