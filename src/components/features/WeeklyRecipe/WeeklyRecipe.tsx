"use client";
import Link from 'next/link';
import Image from 'next/image';
import { isOptimizableImage } from '@/lib/utils/image';
import { getRecipeUrl } from '@/lib/utils/recipe-url';
import { getDepartementName } from '@/constants/departements';
import { Rating } from 'primereact/rating';
import type { WeeklyRecipeData } from '@/lib/server/listings';
import './WeeklyRecipe.css';

interface WeeklyRecipeProps {
	/** Chargée côté serveur (app/page.tsx) */
	recipe: WeeklyRecipeData | null;
}

export default function WeeklyRecipe({ recipe }: WeeklyRecipeProps) {
	const featuredRecette = recipe;
	const likesCount = recipe?.likesCount ?? 0;
	const averageRating = recipe?.averageRating ?? null;
	const reviewsCount = recipe?.reviewsCount ?? 0;

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
							unoptimized={!isOptimizableImage(featuredRecette.images[0])}
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
						<p className="weekly-recipe-content-location">📍 {getDepartementName(featuredRecette.position) || featuredRecette.position}</p>
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

					<Link href={getRecipeUrl({ id: featuredRecette.recetteId, url: featuredRecette.url, title: featuredRecette.title })} className="weekly-recipe-button">
						Voir la recette
					</Link>
				</div>
			</div>
		</section>
	);
}

