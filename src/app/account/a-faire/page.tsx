"use client";
import React, { useEffect, useState } from 'react';
import './a-faire.css';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { Recette } from '@/components/features';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { RequireEmailVerification } from '@/components/ui';
import { getUserRecipesToDo, removeRecipeToDo } from '@/lib/services/shopping.service';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import type { Recipe } from '@/types';

interface RecetteToDoInterface {
  recetteId: string;
  title: string;
  type: string;
  images?: string[];
  position: string;
  url?: string;
  addedAt?: Date;
}

export default function AFairePage() {
  const [recettes, setRecettes] = useState<RecetteToDoInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (user) {
      fetchRecettesToDo();
    }
  }, [user]);

  const fetchRecettesToDo = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        setError("Utilisateur non connecté");
        return;
      }

      // Récupérer les IDs des recettes "à faire"
      const recipesToDo = await getUserRecipesToDo(user.uid);

      if (recipesToDo.length === 0) {
        setRecettes([]);
        setLoading(false);
        return;
      }

      // Récupérer les détails de chaque recette
      const recettesPromises = recipesToDo.map(async (item) => {
        try {
          const recipeRef = doc(db, "recipes", item.recipeId);
          const recipeSnap = await getDoc(recipeRef);

          if (recipeSnap.exists()) {
            const recipeData = recipeSnap.data() as Recipe;
            return {
              recetteId: item.recipeId,
              title: recipeData.title,
              type: recipeData.type,
              images: recipeData.images,
              position: recipeData.position,
              url: recipeData.url,
              addedAt: item.addedAt?.toDate ? item.addedAt.toDate() : item.addedAt
            } as RecetteToDoInterface;
          }
          return null;
        } catch (error) {
          console.error(`Error fetching recipe ${item.recipeId}:`, error);
          return null;
        }
      });

      const recettesData = await Promise.all(recettesPromises);
      const validRecettes = recettesData.filter((r): r is RecetteToDoInterface => r !== null);

      // Trier par date d'ajout (plus récent en premier)
      validRecettes.sort((a, b) => {
        if (!a.addedAt || !b.addedAt) return 0;
        return b.addedAt.getTime() - a.addedAt.getTime();
      });

      setRecettes(validRecettes);
    } catch (error) {
      console.error("Error fetching recipes to do:", error);
      setError("Erreur lors du chargement des recettes à faire");
      showToast({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Impossible de charger vos recettes à faire'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromToDo = async (recipeId: string) => {
    if (!user) return;

    try {
      await removeRecipeToDo(user.uid, recipeId);
      // Retirer de la liste locale
      setRecettes(recettes.filter(r => r.recetteId !== recipeId));
      showToast({
        severity: 'success',
        summary: 'Retiré',
        detail: 'Recette retirée de "à faire"'
      });
    } catch (error) {
      console.error("Error removing recipe from to do:", error);
      showToast({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Impossible de retirer la recette'
      });
    }
  };

  if (loading) {
    return (
      <RequireEmailVerification>
        <div className="recipes-loading">
          <div className="spinner"></div>
          <p>Chargement de vos recettes à faire...</p>
        </div>
      </RequireEmailVerification>
    );
  }

  return (
    <RequireEmailVerification>
      <div className="a-faire-page">
        <div className="recipes-header">
          <h2>Mes Recettes à Faire</h2>
          {recettes.length > 0 && (
            <p className="recipes-count">{recettes.length} recette{recettes.length > 1 ? 's' : ''}</p>
          )}
        </div>

        {error && (
          <div className="error-message">
            <i className="pi pi-exclamation-triangle"></i>
            <span>{error}</span>
          </div>
        )}

        {!error && recettes.length === 0 ? (
          <div className="empty-state">
            <i className="pi pi-bookmark empty-icon"></i>
            <h3>Vous n'avez pas encore de recettes à faire</h3>
            <p>Ajoutez des recettes à "à faire" depuis les pages de recettes pour les retrouver ici</p>
          </div>
        ) : (
          <div className="recipes-grid">
            {recettes.map((recette) => (
              <div key={recette.recetteId} className="recipe-card-wrapper">
                <Recette
                  recetteId={recette.recetteId}
                  title={recette.title}
                  type={recette.type}
                  images={recette.images}
                  position={recette.position}
                />
                {recette.addedAt && (
                  <div className="recipe-added-date">
                    <i className="pi pi-calendar"></i>
                    Ajoutée le {recette.addedAt.toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </RequireEmailVerification>
  );
}

