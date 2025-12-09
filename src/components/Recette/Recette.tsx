"use client";
import React, { useEffect, useState } from 'react';
import './Recette.css';
import { Button } from 'primereact/button';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { toggleLikeRecipes, unlikeRecipes, countRecipeLikes, hasUserLikedRecipe } from '@/services/RecetteService/RecetteService';
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, query, where, orderBy } from '@firebase/firestore';
import { db } from '@firebaseModule';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import { Rating } from 'primereact/rating';

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
	const [likesCount, setLikesCount] = useState<number>(0);
	const [hasLiked, setHasLiked] = useState<boolean>(false);
	const [averageRating, setAverageRating] = useState<number | null>(null);
	const [reviewsCount, setReviewsCount] = useState<number>(0);
	const userId = user?.uid;

	useEffect(() => {
		// Écouter les changements dans la collection likes pour cette recette
		const likesRef = collection(db, "likes");
		const q = query(likesRef, where("recetteId", "==", recetteId));

		const unsubscribe = onSnapshot(q, (snapshot) => {
			setLikesCount(snapshot.size);

			// Vérifier si l'utilisateur actuel a liké
			if (userId) {
				const userLiked = snapshot.docs.some(doc => doc.data().userId === userId);
				setHasLiked(userLiked);
			} else {
				setHasLiked(false);
			}
		});

		return () => unsubscribe();
	}, [recetteId, userId]);

	// Récupérer les reviews et calculer la note moyenne
	useEffect(() => {
		const reviewsRef = collection(db, "reviews");
		const q = query(reviewsRef, where("recipeId", "==", recetteId), orderBy("createdAt", "desc"));

		const unsubscribe = onSnapshot(q, (snapshot) => {
			const reviews = snapshot.docs.map(doc => doc.data());
			setReviewsCount(reviews.length);

			if (reviews.length > 0) {
				const avgRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length;
				setAverageRating(parseFloat(avgRating.toFixed(1)));
			} else {
				setAverageRating(null);
			}
		});

		return () => unsubscribe();
	}, [recetteId]);

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
			if (hasLiked) {
				await unlikeRecipes(recetteId, userId);
			} else {
				await toggleLikeRecipes(recetteId, userId);
			}
		} catch (error) {
			console.error("Erreur lors du like:", error);
			showToast({
				severity: 'error',
				summary: 'Erreur',
				detail: 'Une erreur est survenue lors du like'
			});
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
							<div className='Post_admin_actions'>
								<Link href={`/recettes?id=${recetteId}`} className="view-recipe">
									<Button
										label="Voir la recette"
										icon="pi pi-eye"
										className="p-button-primary view-button"
									/>
								</Link>

								<Button
									className='Post_likeButton'
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
