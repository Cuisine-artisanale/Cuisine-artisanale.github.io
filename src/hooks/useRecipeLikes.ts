import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { toggleLikeRecipes, unlikeRecipes } from '@/lib/services/recipe.service';

interface UseRecipeLikesOptions {
  recipeId: string;
  userId?: string | null;
  onError?: (error: Error) => void;
}

interface UseRecipeLikesReturn {
  likesCount: number;
  hasLiked: boolean;
  isLoading: boolean;
  toggleLike: () => Promise<void>;
}

/**
 * Hook personnalisé pour gérer les likes d'une recette
 * @param recipeId - ID de la recette
 * @param userId - ID de l'utilisateur (optionnel)
 * @param onError - Callback en cas d'erreur
 * @returns État des likes et fonction pour toggle
 */
export function useRecipeLikes({
  recipeId,
  userId,
  onError
}: UseRecipeLikesOptions): UseRecipeLikesReturn {
  const [likesCount, setLikesCount] = useState<number>(0);
  const [hasLiked, setHasLiked] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Écouter les changements dans la collection likes
  useEffect(() => {
    if (!recipeId) return;

    const likesRef = collection(db, "likes");
    const q = query(likesRef, where("recetteId", "==", recipeId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setLikesCount(snapshot.size);

        // Vérifier si l'utilisateur actuel a liké
        if (userId) {
          const userLiked = snapshot.docs.some(
            (doc) => doc.data().userId === userId
          );
          setHasLiked(userLiked);
        } else {
          setHasLiked(false);
        }
      },
      (error) => {
        console.error("Erreur lors de l'écoute des likes:", error);
        onError?.(error as Error);
      }
    );

    return () => unsubscribe();
  }, [recipeId, userId, onError]);

  const toggleLike = async () => {
    if (!userId) {
      throw new Error("Vous devez être connecté pour aimer une recette");
    }

    setIsLoading(true);
    try {
      if (hasLiked) {
        await unlikeRecipes(recipeId, userId);
      } else {
        await toggleLikeRecipes(recipeId, userId);
      }
    } catch (error) {
      console.error("Erreur lors du like:", error);
      onError?.(error as Error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    likesCount,
    hasLiked,
    isLoading,
    toggleLike
  };
}

