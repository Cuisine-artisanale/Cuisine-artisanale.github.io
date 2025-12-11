import { db } from "@/lib/config/firebase";
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, serverTimestamp, orderBy, limit } from "firebase/firestore";

export const toggleLikeRecipes = async (recetteId: string, userId: string) => {
  try {
	// Vérifier si la recette existe
	const recipesRef = doc(db, "recipes", recetteId);
	const recipeSnap = await getDoc(recipesRef);

	if (!recipeSnap.exists()) {
	  console.warn("Recette non trouvée");
	  return;
	}

	// Vérifier si l'utilisateur existe
	const userRef = doc(db, "users", userId);
	const userSnap = await getDoc(userRef);

	if (!userSnap.exists()) {
	  console.warn("Utilisateur non trouvé");
	  return;
	}

	const userData = userSnap.data();
	const userName = userData.displayName || userData.email || "Anonyme";

	// Créer un ID unique pour le like basé sur userId et recetteId
	const likeId = `${userId}_${recetteId}`;
	const likeRef = doc(db, "likes", likeId);

	// Vérifier si le like existe déjà
	const likeSnap = await getDoc(likeRef);

	if (!likeSnap.exists()) {
	  // Ajouter le like
	  await setDoc(likeRef, {
		userId: userId,
		userName: userName,
		recetteId: recetteId,
		createdAt: serverTimestamp(),
	  });
	  console.log(`Like ajouté: ${userName} a liké la recette ${recetteId}`);
	} else {
	  console.log("User a déjà liké cette recette");
	}

  } catch (error) {
	console.error("Error liking recipe: ", error);
  }
};


export const unlikeRecipes = async (recetteId: string, userId: string) => {
  try {
	// Créer l'ID unique du like
	const likeId = `${userId}_${recetteId}`;
	const likeRef = doc(db, "likes", likeId);

	// Vérifier si le like existe
	const likeSnap = await getDoc(likeRef);

	if (likeSnap.exists()) {
	  // Supprimer le like
	  await deleteDoc(likeRef);
	  console.log(`Like supprimé: userId ${userId} pour recette ${recetteId}`);
	} else {
	  console.warn("Like non trouvé");
	}

  } catch (error) {
	console.error("Error unliking recipe: ", error);
  }
};

// Fonction utilitaire pour récupérer tous les likes d'une recette
export const getRecipeLikes = async (recetteId: string) => {
  try {
	const likesRef = collection(db, "likes");
	const q = query(likesRef, where("recetteId", "==", recetteId));
	const querySnapshot = await getDocs(q);

	const likes = querySnapshot.docs.map(doc => ({
	  id: doc.id,
	  ...doc.data()
	}));

	return likes;
  } catch (error) {
	console.error("Error fetching recipe likes: ", error);
	return [];
  }
};

// Fonction utilitaire pour vérifier si un utilisateur a liké une recette
export const hasUserLikedRecipe = async (recetteId: string, userId: string) => {
  try {
	const likeId = `${userId}_${recetteId}`;
	const likeRef = doc(db, "likes", likeId);
	const likeSnap = await getDoc(likeRef);

	return likeSnap.exists();
  } catch (error) {
	console.error("Error checking user like: ", error);
	return false;
  }
};

// Fonction utilitaire pour compter les likes d'une recette
export const countRecipeLikes = async (recetteId: string) => {
  try {
	const likesRef = collection(db, "likes");
	const q = query(likesRef, where("recetteId", "==", recetteId));
	const querySnapshot = await getDocs(q);

	return querySnapshot.size;
  } catch (error) {
	console.error("Error counting recipe likes: ", error);
	return 0;
  }
};

// ============= RECOMMANDATIONS =============

/**
 * Récupère les recettes similaires basées sur le type et le département
 * Algorithme simple: même type + même département
 */
export const getSimilarRecipes = async (recetteId: string, limit_count: number = 5) => {
  try {
	const recipeRef = doc(db, "recipes", recetteId);
	const recipeSnap = await getDoc(recipeRef);

	if (!recipeSnap.exists()) {
	  console.warn("Recette non trouvée");
	  return [];
	}

	const recipeData = recipeSnap.data();
	const { type, position } = recipeData;

	// Requête pour trouver des recettes du même type et département
	const recipesRef = collection(db, "recipes");
	const q = query(
	  recipesRef,
	  where("type", "==", type),
	  where("position", "==", position)
	);
	const querySnapshot = await getDocs(q);

	// Filtrer la recette actuelle et limiter les résultats
	const similarRecipes = querySnapshot.docs
	  .filter(doc => doc.id !== recetteId)
	  .slice(0, limit_count)
	  .map(doc => ({
		id: doc.id,
		...doc.data()
	  }));

	return similarRecipes;
  } catch (error) {
	console.error("Error fetching similar recipes: ", error);
	return [];
  }
};

/**
 * Récupère les recettes populaires (basé sur les likes)
 */
export const getTrendingRecipes = async (limit_count: number = 5) => {
  try {
	const recipesRef = collection(db, "recipes");
	const q = query(recipesRef);
	const querySnapshot = await getDocs(q);

	const recipesWithLikeCounts = await Promise.all(
	  querySnapshot.docs.map(async (doc) => ({
		id: doc.id,
		...doc.data(),
		likesCount: await countRecipeLikes(doc.id)
	  }))
	);

	// Trier par nombre de likes décroissant
	return recipesWithLikeCounts
	  .sort((a, b) => b.likesCount - a.likesCount)
	  .slice(0, limit_count);
  } catch (error) {
	console.error("Error fetching trending recipes: ", error);
	return [];
  }
};

/**
 * Récupère les recettes recommandées pour un utilisateur basé sur ses likes
 */
export const getPersonalizedRecommendations = async (userId: string, limit_count: number = 5) => {
  try {
	// Récupérer les recettes aimées par l'utilisateur
	const likesRef = collection(db, "likes");
	const q = query(likesRef, where("userId", "==", userId));
	const likesSnapshot = await getDocs(q);

	if (likesSnapshot.empty) {
	  // Si pas de likes, retourner les recettes populaires
	  return getTrendingRecipes(limit_count);
	}

	// Récupérer les données des recettes aimées
	const likedRecipeIds = likesSnapshot.docs.map(doc => doc.data().recetteId);
	const likedRecipes = await Promise.all(
	  likedRecipeIds.map(id => getDoc(doc(db, "recipes", id)))
	);

	// Extraire les types et départements des recettes aimées
	const likedTypes = new Set<string>();
	const likedDepartments = new Set<string>();

	likedRecipes.forEach(recipeDoc => {
	  if (recipeDoc.exists()) {
		const data = recipeDoc.data();
		if (data.type) likedTypes.add(data.type);
		if (data.position) likedDepartments.add(data.position);
	  }
	});

	// Récupérer toutes les recettes
	const recipesRef = collection(db, "recipes");
	const allRecipesSnapshot = await getDocs(query(recipesRef));

	// Scorer les recettes basé sur les types et départements aimés
	const scoredRecipes = await Promise.all(
	  allRecipesSnapshot.docs.map(async (recipeDoc) => {
		const recipeData = recipeDoc.data();
		let score = 0;

		// +2 points si le type est aimé
		if (likedTypes.has(recipeData.type)) score += 2;

		// +1 point si le département est aimé
		if (likedDepartments.has(recipeData.position)) score += 1;

		// +1 point par like
		const likesCount = await countRecipeLikes(recipeDoc.id);
		score += likesCount * 0.5;

		return {
		  id: recipeDoc.id,
		  ...recipeData,
		  score
		};
	  })
	);

	// Filtrer les recettes déjà aimées, trier par score et limiter
	return scoredRecipes
	  .filter(recipe => !likedRecipeIds.includes(recipe.id))
	  .sort((a, b) => b.score - a.score)
	  .slice(0, limit_count)
	  .map(({ score, ...recipe }) => recipe); // Retirer le score

  } catch (error) {
	console.error("Error fetching personalized recommendations: ", error);
	return [];
  }
};

