"use client";
import React, { useEffect, useState } from 'react';
import './mes-recettes.css';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
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
  position: string;
  createdAt?: Date;
}

export default function MesRecettesPage() {
  const [recettes, setRecettes] = useState<RecetteInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [first, setFirst] = useState(0);
  const [rows] = useState(9);
  const [totalRecords, setTotalRecords] = useState(0);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setFirst(0);
    fetchRecettes(0);
  }, [user]);

  useEffect(() => {
    fetchRecettes(first);
  }, [first]);

  const fetchRecettes = async (pageIndex: number) => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        setError("Utilisateur non connecté");
        return;
      }

      const recettesCollection = collection(db, "recipes");

      // Fetch all recettes for this user
      const querySnapshot = await getDocs(
        query(
          recettesCollection,
          where("createdBy", "==", user.uid),
          orderBy("createdAt", "desc")
        )
      );

      const allRecettesData: RecetteInterface[] = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          title: data.title,
          description: data.description,
          type: data.type,
          position: data.position,
          recetteId: doc.id,
          images: data.images,
          createdAt: data.createdAt?.toDate(),
        } as RecetteInterface;
      });

      // Slice for pagination
      const paginatedRecettes = allRecettesData.slice(pageIndex, pageIndex + rows);
      setRecettes(paginatedRecettes);
      setTotalRecords(allRecettesData.length);
    } catch (error) {
      console.error("Error getting recettes: ", error);
      setError("Erreur lors du chargement des recettes");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRecipe = () => {
    router.push('/recettes/add-recipe');
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
        <div className="recipes-loading">
          <div className="spinner"></div>
          <p>Chargement de vos recettes...</p>
        </div>
      </RequireEmailVerification>
    );
  }

  return (
    <RequireEmailVerification>
      <div className="account-recipes">
        <div className="recipes-header">
          <h2>Mes Recettes</h2>
          <button
            className="create-recipe-btn"
            onClick={handleCreateRecipe}
          >
            <i className="pi pi-plus"></i>
            Créer une recette
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
            <i className="pi pi-book empty-icon"></i>
            <h3>Vous n'avez pas encore créé de recettes</h3>
            <p>Commencez à partager vos délicieuses recettes avec la communauté !</p>
            <button
              className="btn-primary"
              onClick={handleCreateRecipe}
            >
              <i className="pi pi-plus"></i>
              Créer ma première recette
            </button>
          </div>
        ) : (
          <>
            <div className="recipes-grid">
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
