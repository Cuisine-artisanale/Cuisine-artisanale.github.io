"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import { Rating } from 'primereact/rating';
import type { Recipe } from '@/types';
import { useRecipeLikes, useRecipeReviews } from '@/hooks';
import './WeeklyRecipe.css';

export default function WeeklyRecipe() {
	const [featuredRecette, setFeaturedRecette] = useState<Recipe | null>(null);
	const [loading, setLoading] = useState(true);

	// Hooks pour les likes et reviews
	const { likesCount } = useRecipeLikes({
		recipeId: featuredRecette?.id || '',
		userId: null,
		onError: () => {}
	});

	const { averageRating, reviewsCount } = useRecipeReviews({
		recipeId: featuredRecette?.id || ''
	});

	useEffect(() => {
		fetchWeeklyRecette();
	}, []);

	const fetchWeeklyRecette = async () => {
		try {
			const weeklyRef = doc(db, "weeklyRecipe", "current");
			const weeklySnap = await getDoc(weeklyRef);

			if (weeklySnap.exists()) {
				setFeaturedRecette(weeklySnap.data() as Recipe);
			}
		} catch (error) {
			console.error("Erreur lors du chargement de la recette de la semaine :", error);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return (
			<section className="weekly-recipe">
				<h2 className="weekly-recipe-title">🥇 Recette de la semaine</h2>
				<div className="weekly-recipe-card">
					<div className="weekly-recipe-skeleton-image"></div>
					<div className="weekly-recipe-content">
						<div className="weekly-recipe-skeleton weekly-recipe-skeleton-title"></div>
						<div className="weekly-recipe-skeleton-meta">
							<div className="weekly-recipe-skeleton weekly-recipe-skeleton-badge"></div>
							<div className="weekly-recipe-skeleton weekly-recipe-skeleton-badge"></div>
						</div>
						<div className="weekly-recipe-skeleton weekly-recipe-skeleton-subtitle"></div>
						<div className="weekly-recipe-skeleton-stats">
							<div className="weekly-recipe-skeleton weekly-recipe-skeleton-stat"></div>
							<div className="weekly-recipe-skeleton weekly-recipe-skeleton-stat"></div>
						</div>
						<div className="weekly-recipe-skeleton weekly-recipe-skeleton-button"></div>
					</div>
				</div>
			</section>
		);
	}

	if (!featuredRecette) {
		return (
			<section className="weekly-recipe">
				<p className="weekly-recipe-empty">Aucune recette disponible pour cette semaine.</p>
			</section>
		);
	}

	return (
		<section className="weekly-recipe">
			<h2 className="weekly-recipe-title">🥇 Recette de la semaine</h2>
			<div className="weekly-recipe-card">
				{featuredRecette.images?.[0] && (
					<div className="weekly-recipe-image-wrapper">
						<Image
							src={featuredRecette.images[0]}
							alt={featuredRecette.title}
							className="weekly-recipe-image"
							height={400}
							width={600}
							priority
							sizes="(max-width: 768px) 100vw, 50vw"
							unoptimized={true}
						/>
					</div>
				)}
				<div className="weekly-recipe-content">
					<h3 className="weekly-recipe-content-title">{featuredRecette.title}</h3>

					<div className="weekly-recipe-meta">
						<span className="weekly-recipe-type">{featuredRecette.type}</span>
						{featuredRecette.difficulty && (
							<span className={`weekly-recipe-difficulty weekly-recipe-difficulty-${featuredRecette.difficulty}`}>
								{featuredRecette.difficulty === 'easy' ? 'Facile' :
								 featuredRecette.difficulty === 'medium' ? 'Moyen' : 'Difficile'}
							</span>
						)}
					</div>

					{featuredRecette.position && (
						<p className="weekly-recipe-content-location">📍 {featuredRecette.position}</p>
					)}

					<div className="weekly-recipe-stats">
						{(featuredRecette.preparationTime || featuredRecette.cookingTime) && (
							<div className="weekly-recipe-times">
								{featuredRecette.preparationTime && (
									<div className="weekly-recipe-time-item">
										<i className="pi pi-clock"></i>
										<span>Préparation: {featuredRecette.preparationTime} min</span>
									</div>
								)}
								{featuredRecette.cookingTime && (
									<div className="weekly-recipe-time-item">
										<i className="pi pi-stopwatch"></i>
										<span>Cuisson: {featuredRecette.cookingTime} min</span>
									</div>
								)}
							</div>
						)}

						{featuredRecette.servings && (
							<div className="weekly-recipe-servings">
								<i className="pi pi-users"></i>
								<span>{featuredRecette.servings} {featuredRecette.servings > 1 ? 'personnes' : 'personne'}</span>
							</div>
						)}
					</div>

					<div className="weekly-recipe-engagement">
						{averageRating !== null && averageRating > 0 && (
							<div className="weekly-recipe-rating">
								<Rating value={averageRating} readOnly cancel={false} />
								<span className="weekly-recipe-rating-text">
									{averageRating.toFixed(1)} ({reviewsCount} {reviewsCount > 1 ? 'avis' : 'avis'})
								</span>
							</div>
						)}
						{likesCount > 0 && (
							<div className="weekly-recipe-likes">
								<i className="pi pi-heart-fill"></i>
								<span>{likesCount} {likesCount > 1 ? 'likes' : 'like'}</span>
							</div>
						)}
					</div>

					<Link href={`/recettes/?id=${featuredRecette.id}`} className="weekly-recipe-button">
						Voir la recette
					</Link>
				</div>
			</div>
		</section>
	);
}

