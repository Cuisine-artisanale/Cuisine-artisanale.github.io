import Link from 'next/link';
import Image from 'next/image';
import { getRecipeUrl } from '@/lib/utils/recipe-url';
import { isOptimizableImage } from '@/lib/utils/image';
import type { RecipeCardData } from '@/lib/server/listings';
import './TrendingRecipes.css';

interface TrendingRecipesProps {
	/** Chargées côté serveur (app/page.tsx) */
	recipes: RecipeCardData[];
}

/** Composant serveur : aucune requête ni JavaScript côté navigateur. */
export default function TrendingRecipes({ recipes }: TrendingRecipesProps) {
	if (recipes.length === 0) {
		return null;
	}

	return (
		<div className="trending-recipes-section">
			<h2>Recettes populaires cette semaine</h2>
			<div className="trending-recipes-grid">
				{recipes.map((recipe) => (
					<Link
						key={recipe.recetteId}
						href={getRecipeUrl({ id: recipe.recetteId, url: recipe.url, title: recipe.title })}
						className="trending-recipe-card"
					>
						{recipe.images.length > 0 && (
							<div className="trending-recipe-image-wrapper">
								<Image
									src={recipe.images[0]}
									alt={recipe.title}
									className="trending-recipe-image"
									width={400}
									height={300}
									sizes="(max-width: 768px) 50vw, 25vw"
									unoptimized={!isOptimizableImage(recipe.images[0])}
								/>
								<div className="trending-badge">
									<i className="pi pi-heart-fill"></i> {recipe.likesCount}
								</div>
							</div>
						)}
						<div className="trending-recipe-content">
							<h3>{recipe.title}</h3>
							<p className="recipe-type">{recipe.type}</p>
							{recipe.cookingTime ? (
								<p className="recipe-time">
									<i className="pi pi-clock"></i> {recipe.cookingTime} min
								</p>
							) : null}
						</div>
					</Link>
				))}
			</div>
		</div>
	);
}
