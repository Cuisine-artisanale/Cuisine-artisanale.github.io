"use client";
import React, { useEffect, useState } from 'react';
import './recettes-admin.css';
import { db } from '@/lib/config/firebase';
import { collection, onSnapshot, orderBy, query, deleteDoc, doc, getDoc, addDoc, updateDoc, limit } from 'firebase/firestore';
import { toastMessages } from '@/lib/utils/toast';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import { ConfirmDialog } from '@/components/ui';
import { useConfirmDialog } from '@/hooks';
import type { RecipePart } from '@/types';

interface RecetteInterface {
  recetteId: string;
  title: string;
  type: string;
  createdBy: string;
  createdAt: Date;
  status?: 'pending' | 'approved' | 'rejected';
  preparationTime?: number;
  cookingTime?: number;
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  images?: string[];
  recipeParts?: RecipePart[];
}

export default function RecettesAdminPage() {
  const [recettes, setRecettes] = useState<RecetteInterface[]>([]);
  const [displayedRecettes, setDisplayedRecettes] = useState<RecetteInterface[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [globalFilter, setGlobalFilter] = useState<string>('');
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [first, setFirst] = useState(0);
  const [rows] = useState(6);
  const { showToast } = useToast();
  const { confirm, visible, dialogState, handleAccept, handleReject } = useConfirmDialog();

  const sortOptions = [
    { label: 'Plus récent', value: 'createdAt:desc' },
    { label: 'Plus ancien', value: 'createdAt:asc' },
    { label: 'Titre A-Z', value: 'title:asc' },
    { label: 'Titre Z-A', value: 'title:desc' }
  ];

  const handleFetchRecettes = () => {
    try {
      setLoading(true);
      const recettesQuery = query(
        collection(db, "recipesRequest"),
        orderBy("createdAt", "desc"),
        limit(100)
      );

      const unsubscribe = onSnapshot(recettesQuery, (querySnapshot) => {
        const recettesData: RecetteInterface[] = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            ...data,
            recetteId: doc.id,
            createdAt: data.createdAt?.toDate(),
            images: data.images || [],
            status: data.status || 'pending'
          } as RecetteInterface;
        });

        recettesData.sort((a, b) => {
          let aValue: any = sortField === 'createdAt' ? a.createdAt?.getTime() : a[sortField as keyof RecetteInterface];
          let bValue: any = sortField === 'createdAt' ? b.createdAt?.getTime() : b[sortField as keyof RecetteInterface];

          if (sortOrder === 'asc') {
            return aValue > bValue ? 1 : -1;
          } else {
            return aValue < bValue ? 1 : -1;
          }
        });

        setRecettes(recettesData);
        setDisplayedRecettes(recettesData.slice(first, first + rows));
        setLoading(false);
      }, (error) => {
        console.error("Error getting recettes:", error);
        showToast({
          severity: 'error',
          summary: toastMessages.error.default,
          detail: 'Impossible de charger les recettes'
        });
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error("Error in handleFetchRecettes:", error);
      setLoading(false);
      return () => {};
    }
  };

  useEffect(() => {
    const unsubscribe = handleFetchRecettes();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const sorted = [...recettes].sort((a, b) => {
      let aValue: any = sortField === 'createdAt' ? a.createdAt?.getTime() : a[sortField as keyof RecetteInterface];
      let bValue: any = sortField === 'createdAt' ? b.createdAt?.getTime() : b[sortField as keyof RecetteInterface];

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    setRecettes(sorted);
  }, [sortField, sortOrder]);

  useEffect(() => {
    setDisplayedRecettes(recettes.slice(first, first + rows));
  }, [first, recettes]);

  const handleAcceptRequest = async (recette: RecetteInterface) => {
    try {
      const recetteRef = doc(db, 'recipesRequest', recette.recetteId);
      const recetteSnap = await getDoc(recetteRef);
      if (!recetteSnap.exists()) {
        showToast({
          severity: 'error',
          summary: toastMessages.error.default,
          detail: 'Recette introuvable'
        });
        return;
      }

      const recetteData = recetteSnap.data();

      const recipeRef = await addDoc(collection(db, 'recipes'), {
        ...recetteData,
        createdAt: new Date(),
        likes: []
      });

      const id = recipeRef.id;
      await updateDoc(recipeRef, { id });

      await deleteDoc(recetteRef);

      showToast({
        severity: 'success',
        summary: toastMessages.success.default,
        detail: 'La recette a été acceptée et publiée'
      });
    } catch (error) {
      console.error('Error accepting recipe:', error);
      showToast({
        severity: 'error',
        summary: toastMessages.error.default,
        detail: 'Erreur lors de l\'acceptation de la recette'
      });
    }
  };

  const handleRejectRequest = async (recetteId: string) => {
    try {
      await deleteDoc(doc(db, 'recipesRequest', recetteId));
      showToast({
        severity: 'info',
        summary: toastMessages.info.default,
        detail: 'La recette a été rejetée avec succès'
      });
    } catch (error) {
      console.error('Error rejecting recipe:', error);
      showToast({
        severity: 'error',
        summary: toastMessages.error.default,
        detail: 'Erreur lors du rejet de la recette'
      });
    }
  };

  const confirmAccept = (recette: RecetteInterface) => {
    confirm({
      message: `Êtes-vous sûr de vouloir accepter et publier la recette "${recette.title}" ?`,
      header: 'Confirmation de publication',
      icon: 'pi pi-check-circle',
      acceptLabel: 'Oui',
      rejectLabel: 'Non',
      onAccept: () => handleAcceptRequest(recette)
    });
  };

  const confirmReject = (recette: RecetteInterface) => {
    confirm({
      message: `Êtes-vous sûr de vouloir rejeter la recette "${recette.title}" ?`,
      header: 'Confirmation de rejet',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Oui',
      rejectLabel: 'Non',
      onAccept: () => handleRejectRequest(recette.recetteId)
    });
  };

  const confirmDelete = (recetteId: string, title: string) => {
    confirm({
      message: `Êtes-vous sûr de vouloir supprimer la recette "${title}" ?`,
      header: 'Confirmation de suppression',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Oui',
      rejectLabel: 'Non',
      onAccept: () => handleDelete(recetteId)
    });
  };

  const handleDelete = async (recetteId: string) => {
    try {
      await deleteDoc(doc(db, 'recipesRequest', recetteId));
      showToast({
        severity: 'success',
        summary: toastMessages.success.default,
        detail: toastMessages.success.delete
      });
    } catch (error) {
      console.error('Erreur de suppression:', error);
      showToast({
        severity: 'error',
        summary: toastMessages.error.default,
        detail: toastMessages.error.delete
      });
    }
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [field, order] = e.target.value.split(':');
    setSortField(field);
    setSortOrder(order as 'asc' | 'desc');
  };

  const formatTime = (minutes?: number) => {
    if (!minutes) return 'Non spécifié';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours > 0 ? `${hours}h ` : ''}${mins > 0 ? `${mins}min` : ''}`;
  };

  const handlePageChange = (newFirst: number) => {
    setFirst(newFirst);
  };

  const totalPages = Math.ceil(recettes.length / rows);
  const currentPage = Math.floor(first / rows) + 1;
  const startRecord = first + 1;
  const endRecord = Math.min(first + rows, recettes.length);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Chargement des recettes...</p>
      </div>
    );
  }

  const filteredRecettes = recettes.filter(recette =>
    recette.title.toLowerCase().includes(globalFilter.toLowerCase()) ||
    recette.type.toLowerCase().includes(globalFilter.toLowerCase()) ||
    recette.createdBy.toLowerCase().includes(globalFilter.toLowerCase())
  );

  const paginatedRecettes = filteredRecettes.slice(first, first + rows);

  const statusColors = {
    pending: 'var(--yellow-500)',
    approved: 'var(--green-500)',
    rejected: 'var(--red-500)'
  };

  return (
    <div className="recipes-admin">
      {dialogState && (
        <ConfirmDialog
          visible={visible}
          message={dialogState.message}
          header={dialogState.header}
          icon={dialogState.icon}
          acceptLabel={dialogState.acceptLabel}
          rejectLabel={dialogState.rejectLabel}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      )}

      <div className="recipes-header">
        <h2>Gestion des Recettes</h2>
        <div className="recipes-header-actions">
          <div className="input-icon-left">
            <i className="pi pi-search" />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Rechercher..."
              className="search-input"
            />
          </div>
          <select
            value={`${sortField}:${sortOrder}`}
            onChange={handleSortChange}
            className="sort-dropdown"
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      {paginatedRecettes.length === 0 ? (
        <div className="empty-message">Aucune recette trouvée</div>
      ) : (
        <>
          <div className="recipes-grid">
            {paginatedRecettes.map((recette) => (
              <div key={recette.recetteId} className="recipe-card-admin">
                <div className="recipe-card-header">
                  <div className="recipe-title-section">
                    <h3>{recette.title}</h3>
                    <span className="recipe-type-tag">{recette.type}</span>
                  </div>
                  <span
                    className="recipe-status"
                    style={{ backgroundColor: statusColors[recette.status || 'pending'] }}
                  >
                    {recette.status === 'pending' ? 'En attente' :
                     recette.status === 'approved' ? 'Approuvée' : 'Rejetée'}
                  </span>
                </div>

                <div className="recipe-card-content">
                  {recette.images && recette.images.length > 0 && (
                    <div className="recipe-images">
                      <img
                        src={recette.images[0]}
                        alt={recette.title}
                        className="recipe-image"
                      />
                      {recette.images.length > 1 && (
                        <span className="image-count">+{recette.images.length - 1}</span>
                      )}
                    </div>
                  )}

                  <div className="recipe-details">
                    <div className="recipe-metadata">
                      {recette.preparationTime && (
                        <span className="metadata-item">
                          <i className="pi pi-clock" /> Préparation: {formatTime(recette.preparationTime)}
                        </span>
                      )}
                      {recette.cookingTime && (
                        <span className="metadata-item">
                          <i className="pi pi-stopwatch" /> Cuisson: {formatTime(recette.cookingTime)}
                        </span>
                      )}
                      {recette.recipeParts && recette.recipeParts.length > 0 && (
                        <span className="metadata-item">
                          <i className="pi pi-list" /> {recette.recipeParts.length} parties
                        </span>
                      )}
                    </div>
                  </div>
                  {recette.recipeParts && recette.recipeParts.length > 0 && (
                    <div className="recipe-parts">
                      {recette.recipeParts.map((part, index) => (
                        <div key={index} className="recipe-part">
                          <h4>{part.title}</h4>
                          <p style={{ whiteSpace: 'pre-line' }}>{part.steps.join('\n')}</p>
                          <ul>
                            {part.ingredients.map((ingredient, idx) => (
                              <li key={idx}>{ingredient.name} ({ingredient.quantity} {ingredient.unit})</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="recipe-card-footer">
                  <div className="recipe-info">
                    <span className="recipe-author">
                      <i className="pi pi-user" /> {recette.createdBy}
                    </span>
                    {recette.createdAt && (
                      <span className="recipe-date">
                        <i className="pi pi-calendar" /> {recette.createdAt.toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>
                  <div className="recipe-actions">
                    <button
                      className="btn-action btn-success"
                      onClick={() => confirmAccept(recette)}
                      disabled={recette.status === 'approved'}
                      title="Approuver"
                    >
                      <i className="pi pi-check"></i>
                    </button>
                    <button
                      className="btn-action btn-warning"
                      onClick={() => confirmReject(recette)}
                      disabled={recette.status === 'rejected'}
                      title="Rejeter"
                    >
                      <i className="pi pi-times"></i>
                    </button>
                    <button
                      className="btn-action btn-danger"
                      onClick={() => confirmDelete(recette.recetteId, recette.title)}
                      title="Supprimer"
                    >
                      <i className="pi pi-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredRecettes.length > rows && (
            <div className="pagination-wrapper">
              <div className="pagination-info">
                Affichage de {startRecord} à {endRecord} sur {filteredRecettes.length}
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
                  onClick={() => handlePageChange(Math.min(filteredRecettes.length - rows, first + rows))}
                  disabled={first + rows >= filteredRecettes.length}
                  aria-label="Page suivante"
                >
                  <i className="pi pi-angle-right"></i>
                </button>
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange((totalPages - 1) * rows)}
                  disabled={first + rows >= filteredRecettes.length}
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
  );
}
