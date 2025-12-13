import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import type { Review } from '@/types';

interface UseRecipeReviewsOptions {
  recipeId: string;
}

interface UseRecipeReviewsReturn {
  reviews: Review[];
  averageRating: number | null;
  reviewsCount: number;
  isLoading: boolean;
}

/**
 * Hook personnalisé pour gérer les reviews d'une recette
 * @param recipeId - ID de la recette
 * @returns Reviews, note moyenne et nombre de reviews
 */
export function useRecipeReviews({
  recipeId
}: UseRecipeReviewsOptions): UseRecipeReviewsReturn {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [reviewsCount, setReviewsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!recipeId) {
      setIsLoading(false);
      return;
    }

    const reviewsRef = collection(db, "reviews");
    const q = query(
      reviewsRef,
      where("recipeId", "==", recipeId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const reviewsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as Review[];

        setReviews(reviewsData);
        setReviewsCount(reviewsData.length);

        if (reviewsData.length > 0) {
          const avgRating =
            reviewsData.reduce((sum, r) => sum + (r.rating || 0), 0) /
            reviewsData.length;
          setAverageRating(parseFloat(avgRating.toFixed(1)));
        } else {
          setAverageRating(null);
        }

        setIsLoading(false);
      },
      (error) => {
        console.error("Erreur lors de l'écoute des reviews:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [recipeId]);

  return {
    reviews,
    averageRating,
    reviewsCount,
    isLoading
  };
}

