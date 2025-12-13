"use client";
import React, { useEffect, useState } from 'react';
import './mes-favoris.css';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { Recette } from '@/components/features';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { useRouter } from 'next/navigation';
import { RequireEmailVerification } from '@/components/ui';

interface RecetteInterface {
  recetteId: string;
  title: string;
  type: string;
  images?: string[];
  position?: string;
}

export default function MesFavorisPage() {
  const [recettes, setRecettes] = useState<RecetteInterface[]>([]);
  const [allRecettes, setAllRecettes] = useState<RecetteInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [first, setFirst] = useState(0);
  const [rows] = useState(9);
  const [totalRecords, setTotalRecords] = useState(0);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      setFirst(0);
      fetchRecettes(0);
    }
  }, [user]);

  useEffect(() => {
    if (allRecettes.length > 0) {
      const paginatedRecettes = allRecettes.slice(first, first + rows);
      setRecettes(paginatedRecettes);
    }
  }, [first, allRecettes]);

  const fetchRecettes = async (pageIndex: number) => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        setError("Utilisateur non connecté");
        return;
      }

      // Récupérer le document utilisateur
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setError("Utilisateur non trouvé");
        return;
      }

      const userData = userSnap.data();
      const likedRecipesIds: string[] = userData.likedRecipes || [];

      if (likedRecipesIds.length === 0) {
        setAllRecettes([]);
        setRecettes([]);
        setTotalRecords(0);
        return;
      }

      // Récupérer toutes les recettes correspondant aux IDs en chunks de 10
      const recipesCollection = collection(db, "recipes");
      const allRecettesData: RecetteInterface[] = [];

      for (let i = 0; i < likedRecipesIds.length; i += 10) {
        const chunk = likedRecipesIds.slice(i, i + 10);
        const recettesQuery = query(
          recipesCollection,
          where("__name__", "in", chunk)
        );

        const querySnapshot = await getDocs(recettesQuery);
        querySnapshot.docs.forEach(doc => {
          const data = doc.data();
          allRecettesData.push({
            recetteId: doc.id,
            title: data.title,
            type: data.type,
            images: data.images,
            position: data.position
          });
        });
      }

      // Trier selon l'ordre des IDs dans likedRecipes
      allRecettesData.sort((a, b) => {
        return likedRecipesIds.indexOf(a.recetteId) - likedRecipesIds.indexOf(b.recetteId);
      });

      setAllRecettes(allRecettesData);
      setTotalRecords(allRecettesData.length);

      // Afficher la première page
      const paginatedRecettes = allRecettesData.slice(pageIndex, pageIndex + rows);
      setRecettes(paginatedRecettes);

    } catch (error) {
      console.error("Erreur lors du chargement des recettes favorites: ", error);
      setError("Erreur lors du chargement des recettes favorites");
    } finally {
      setLoading(false);
    }
  };

  const handleExploreRecipes = () => {
    router.push('/recettes');
  };

  const handlePageChange = (newFirst: number) => {
    setFirst(newFirst);
  };

  const totalPages = Math.ceil(totalRecords / rows);
  const currentPage = Math.floor(first / rows) + 1;
  const startRecord = first + 1;
  const endRecord = Math.min(first + rows, totalRecords);

  if (loading) {
    return (
      <RequireEmailVerification>
        <div className="favorites-loading">
          <div className="spinner"></div>
          <p>Chargement de vos recettes favorites...</p>
        </div>
      </RequireEmailVerification>
    );
  }

  return (
    <RequireEmailVerification>
      <div className="account-favorites">
        <div className="favorites-header">
          <h2>Mes Recettes Favorites</h2>
          <button
            className="explore-recipes-btn"
            onClick={handleExploreRecipes}
          >
            <i className="pi pi-search"></i>
            Explorer les recettes
          </button>
        </div>

        {error && (
          <div className="error-message">
            <i className="pi pi-exclamation-triangle"></i>
            <span>{error}</span>
          </div>
        )}

        {!error && recettes.length === 0 ? (
          <div className="empty-state">
            <i className="pi pi-heart empty-icon"></i>
            <h3>Aucune recette favorite pour le moment</h3>
            <p>Explorez notre collection de recettes et ajoutez vos favorites à votre collection !</p>
            <button
              className="btn-primary"
              onClick={handleExploreRecipes}
            >
              <i className="pi pi-search"></i>
              Découvrir des recettes
            </button>
          </div>
        ) : (
          <>
            <div className="favorites-grid">
              {recettes.map((recette) => (
                <Recette
                  key={recette.recetteId}
                  recetteId={recette.recetteId}
                  title={recette.title}
                  type={recette.type}
                  images={recette.images}
                  position={recette.position}
                />
              ))}
            </div>
            {totalRecords > rows && (
              <div className="pagination-wrapper">
                <div className="pagination-info">
                  Affichage de {startRecord} à {endRecord} sur {totalRecords}
                </div>
                <div className="pagination">
                  <button
                    className="pagination-btn"
                    onClick={() => handlePageChange(0)}
                    disabled={first === 0}
                    aria-label="Première page"
                  >
                    <i className="pi pi-angle-double-left"></i>
                  </button>
                  <button
                    className="pagination-btn"
                    onClick={() => handlePageChange(Math.max(0, first - rows))}
                    disabled={first === 0}
                    aria-label="Page précédente"
                  >
                    <i className="pi pi-angle-left"></i>
                  </button>
                  <div className="pagination-pages">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      const pageFirst = (page - 1) * rows;
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            className={`pagination-page ${page === currentPage ? 'active' : ''}`}
                            onClick={() => handlePageChange(pageFirst)}
                            aria-label={`Page ${page}`}
                          >
                            {page}
                          </button>
                        );
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return <span key={page} className="pagination-ellipsis">...</span>;
                      }
                      return null;
                    })}
                  </div>
                  <button
                    className="pagination-btn"
                    onClick={() => handlePageChange(Math.min(totalRecords - rows, first + rows))}
                    disabled={first + rows >= totalRecords}
                    aria-label="Page suivante"
                  >
                    <i className="pi pi-angle-right"></i>
                  </button>
                  <button
                    className="pagination-btn"
                    onClick={() => handlePageChange((totalPages - 1) * rows)}
                    disabled={first + rows >= totalRecords}
                    aria-label="Dernière page"
                  >
                    <i className="pi pi-angle-double-right"></i>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </RequireEmailVerification>
  );
}
