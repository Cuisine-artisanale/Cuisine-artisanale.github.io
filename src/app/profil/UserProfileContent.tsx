"use client";
import React, { useState, useEffect } from 'react';
import './user-profile.css';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { UserStats, Recette } from '@/components/features';
import { Breadcrumb } from '@/components/layout';

interface UserData {
  displayName: string;
  email: string;
  photoURL?: string;
  uid: string;
}

interface RecetteInterface {
  recetteId: string;
  title: string;
  type: string;
  images?: string[];
  position: string;
  createdAt?: Date;
}

interface UserProfileContentProps {
  userId: string | null;
}

export default function UserProfileContent({ userId }: UserProfileContentProps) {
  const [user, setUser] = useState<UserData | null>(null);
  const [recipes, setRecipes] = useState<RecetteInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [first, setFirst] = useState(0);
  const [rows] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    if (userId) {
      setLoading(true);
      setError(null);
      fetchUserProfile();
      fetchUserRecipes(0);
    } else {
      setError('Aucun utilisateur spécifié');
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchUserRecipes(first);
    }
  }, [first, userId]);

  const fetchUserProfile = async () => {
    if (!userId) {
      setError('Aucun utilisateur spécifié');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setError('Utilisateur non trouvé');
        setLoading(false);
        setUser(null);
        return;
      }

      const userData = userSnap.data();
      setUser({
        displayName: userData.displayName || 'Utilisateur',
        email: userData.email || '',
        photoURL: userData.photoURL,
        uid: userId
      });
    } catch (err) {
      console.error('Error fetching user:', err);
      setError('Erreur lors du chargement du profil');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRecipes = async (pageIndex: number) => {
    if (!userId) return;

    try {
      const recipesCollection = collection(db, 'recipes');

      if (pageIndex === 0) {
        const countQuery = query(
          recipesCollection,
          where('createdBy', '==', userId)
        );
        const countSnapshot = await getDocs(countQuery);
        setTotalRecords(countSnapshot.size);
      }

      const allRecettesQuery = query(
        recipesCollection,
        where('createdBy', '==', userId)
      );
      const querySnapshot = await getDocs(allRecettesQuery);

      const allRecettesData: RecetteInterface[] = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          title: data.title,
          type: data.type,
          position: data.position,
          recetteId: doc.id,
          images: data.images,
          createdAt: data.createdAt?.toDate(),
        } as RecetteInterface;
      });

      const paginatedRecettes = allRecettesData.slice(pageIndex, pageIndex + rows);
      setRecipes(paginatedRecettes);
    } catch (error) {
      console.error('Error fetching recipes:', error);
      setError('Erreur lors du chargement des recettes');
    }
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
      <div className="user-profile-container">
        <Breadcrumb />
        <div className="user-profile-loading">
          <div className="spinner"></div>
          <p>Chargement du profil...</p>
        </div>
      </div>
    );
  }

  if (error || !user || !userId) {
    return (
      <div className="user-profile-container">
        <Breadcrumb />
        <div className="error-card">
          <div className="error-message">
            <i className="pi pi-exclamation-triangle"></i>
            <span>{error || 'Profil non trouvé. Veuillez spécifier un utilisateur.'}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="user-profile-container">
      <Breadcrumb />

      <div className="profile-header-card">
        <div className="profile-header">
          <div className="profile-info">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="user-avatar"
              />
            ) : (
              <div
                className="user-avatar user-avatar-placeholder"
                style={{ backgroundColor: 'var(--primary-color)' }}
              >
                {user.displayName?.charAt(0) || 'U'}
              </div>
            )}
            <div className="profile-details">
              <h1>{user.displayName}</h1>
              <p className="profile-email">{user.email}</p>
            </div>
          </div>
        </div>
      </div>

      {user && <UserStats userId={user.uid} isPublicProfile={true} />}

      <div className="recipes-card">
        <div className="recipes-header">
          <h2>Recettes créées par {user.displayName}</h2>
        </div>

        {totalRecords === 0 ? (
          <div className="empty-state">
            <i className="pi pi-book empty-icon"></i>
            <h3>{user.displayName} n'a pas encore créé de recettes</h3>
          </div>
        ) : (
          <>
            <div className="recipes-grid">
              {recipes.map((recette) => (
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
    </div>
  );
}

