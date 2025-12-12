"use client";
import React, { useEffect, useState } from 'react';
import { getPersonalizedRecommendations } from '@/lib/services/recipe.service';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { getRecipeUrl } from '@/lib/utils/recipe-url';
import './PersonalizedRecommendations.css';

interface RecommendedRecipe {
  id: string;
  title: string;
  type: string;
  cookingTime?: number;
  images?: string[];
  url?: string;
}

const PersonalizedRecommendations: React.FC = () => {
  const [recipes, setRecipes] = useState<RecommendedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
	const loadRecommendations = async () => {
	  if (!user?.uid) {
		setLoading(false);
		return;
	  }

	  try {
		setLoading(true);
		const recommended = await getPersonalizedRecommendations(user.uid, 6);
		setRecipes(recommended as RecommendedRecipe[]);
	  } catch (error) {
		console.error("Erreur lors du chargement des recommandations personnalisées:", error);
		setRecipes([]);
	  } finally {
		setLoading(false);
	  }
	};

	loadRecommendations();
  }, [user?.uid]);

  if (!user) {
	return null;
  }

  if (loading) {
	return (
	  <div className="personalized-recommendations-section">
		<h3>Recommandé pour vous</h3>
		<div className="loading-message">Chargement de vos recommandations personnalisées...</div>
	  </div>
	);
  }

  if (recipes.length === 0) {
	return (
	  <div className="personalized-recommendations-section">
		<h3>Recommandé pour vous</h3>
		<p className="no-recommendations">
		  Likez des recettes pour obtenir des recommandations personnalisées!
		</p>
	  </div>
	);
  }

  return (
	<div className="personalized-recommendations-section">
	  <h3>Recommandé pour vous</h3>
	  <div className="personalized-recipes-grid">
		{recipes.map((recipe) => (
		  <div
			key={recipe.id}
			className="personalized-recipe-card"
			onClick={() => router.push(getRecipeUrl(recipe))}
		  >
			{recipe.images && recipe.images.length > 0 && (
			  <img
				src={recipe.images[0]}
				alt={recipe.title}
				className="personalized-recipe-image"
			  />
			)}
			<div className="personalized-recipe-content">
			  <h4>{recipe.title}</h4>
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

export default PersonalizedRecommendations;
