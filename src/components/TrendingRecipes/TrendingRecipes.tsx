"use client";
import React, { useEffect, useState } from 'react';
import { getTrendingRecipes } from '@/services/RecetteService/RecetteService';
import { useRouter } from 'next/navigation';
import { getRecipeUrl } from '@/utils/recipeUrl';
import './TrendingRecipes.css';

interface TrendingRecipe {
  id: string;
  title: string;
  type: string;
  cookingTime?: number;
  images?: string[];
  likesCount?: number;
  url?: string;
}

const TrendingRecipes: React.FC = () => {
  const [recipes, setRecipes] = useState<TrendingRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
	const loadTrendingRecipes = async () => {
	  try {
		setLoading(true);
		const trendingRecipes = await getTrendingRecipes(4);
		setRecipes(trendingRecipes as TrendingRecipe[]);
	  } catch (error) {
		console.error("Erreur lors du chargement des recettes tendances:", error);
		setRecipes([]);
	  } finally {
		setLoading(false);
	  }
	};

	loadTrendingRecipes();
  }, []);

  if (loading) {
	return (
	  <div className="trending-recipes-section">
		<h2>Recettes populaires cette semaine</h2>
		<div className="loading-message">Chargement des recettes populaires...</div>
	  </div>
	);
  }

  if (recipes.length === 0) {
	return null;
  }

  return (
	<div className="trending-recipes-section">
	  <h2>Recettes populaires cette semaine</h2>
	  <div className="trending-recipes-grid">
		{recipes.map((recipe) => (
		  <div
			key={recipe.id}
			className="trending-recipe-card"
			onClick={() => router.push(getRecipeUrl(recipe))}
		  >
			{recipe.images && recipe.images.length > 0 && (
			  	<div className="trending-recipe-image-wrapper">
					<img
						src={recipe.images[0]}
						alt={recipe.title}
						className="trending-recipe-image"
					/>
					<div className="trending-badge">
						<i className="pi pi-heart-fill"></i> {recipe.likesCount}
					</div>
				</div>
			)}
			<div className="trending-recipe-content">
			  <h3>{recipe.title}</h3>
			  <p className="recipe-type">{recipe.type}</p>
			  {recipe.cookingTime && (
				<p className="recipe-time">
				  <i className="pi pi-clock"></i> {recipe.cookingTime} min
				</p>
			  )}
			</div>
		  </div>
		))}
	  </div>
	</div>
  );
};

export default TrendingRecipes;
