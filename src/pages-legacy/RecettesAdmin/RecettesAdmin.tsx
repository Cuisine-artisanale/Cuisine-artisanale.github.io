"use client";
import React, { useEffect, useState, useRef } from 'react';
import './RecettesAdmin.css';
import { db } from '@/lib/config/firebase';
import { collection, onSnapshot, orderBy, query, deleteDoc, doc, getDoc, addDoc, updateDoc, limit } from '@firebase/firestore';
import { DataView } from 'primereact/dataview';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ProgressSpinner } from 'primereact/progressspinner';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Tag } from 'primereact/tag';
import { Image } from 'primereact/image';
import { toastMessages } from '@/lib/utils/toast';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import { Paginator } from 'primereact/paginator';
import type { RecipePart, Ingredient, Recipe } from '@/types';

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

const RecettesAdmin: React.FC = () => {
  const [recettes, setRecettes] = useState<RecetteInterface[]>([]);
  const [displayedRecettes, setDisplayedRecettes] = useState<RecetteInterface[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [globalFilter, setGlobalFilter] = useState<string>('');
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [first, setFirst] = useState(0);
  const [rows] = useState(6);
  const toast = useRef<Toast>(null);
  const { showToast } = useToast();

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
		limit(100) // Fetch max 100 for admin (reasonable limit)
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

		// Sort based on current sort settings
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

  // Update displayed recettes when first changes or recettes changes
  useEffect(() => {
	setDisplayedRecettes(recettes.slice(first, first + rows));
  }, [first, recettes]);

  const handleAcceptRequest = async (recette: RecetteInterface) => {
	try {
	  // Get the full recipe data
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

	  // Add to recipes collection
	  const recipeRef = await addDoc(collection(db, 'recipes'), {
		...recetteData,
		createdAt: new Date(),
		likes: []
	  });

	  const id = recipeRef.id;
	  await updateDoc(recipeRef, { id });

	  // Delete from recipesRequest
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
	confirmDialog({
	  message: `Êtes-vous sûr de vouloir accepter et publier la recette "${recette.title}" ?`,
	  header: 'Confirmation de publication',
	  icon: 'pi pi-check-circle',
	  acceptLabel: 'Oui',
	  rejectLabel: 'Non',
	  accept: () => handleAcceptRequest(recette)
	});
  };

  const confirmReject = (recette: RecetteInterface) => {
	confirmDialog({
	  message: `Êtes-vous sûr de vouloir rejeter la recette "${recette.title}" ?`,
	  header: 'Confirmation de rejet',
	  icon: 'pi pi-exclamation-triangle',
	  acceptLabel: 'Oui',
	  rejectLabel: 'Non',
	  accept: () => handleRejectRequest(recette.recetteId)
	});
  };

  const confirmDelete = (recetteId: string, title: string) => {
	confirmDialog({
	  message: `Êtes-vous sûr de vouloir supprimer la recette "${title}" ?`,
	  header: 'Confirmation de suppression',
	  icon: 'pi pi-exclamation-triangle',
	  acceptLabel: 'Oui',
	  rejectLabel: 'Non',
	  accept: () => handleDelete(recetteId)
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

  const handleSortChange = (e: { value: string }) => {
	const [field, order] = e.value.split(':');
	setSortField(field);
	setSortOrder(order as 'asc' | 'desc');
  };

  const formatTime = (minutes?: number) => {
	if (!minutes) return 'Non spécifié';
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${hours > 0 ? `${hours}h ` : ''}${mins > 0 ? `${mins}min` : ''}`;
  };

  const header = () => {
	return (
	  <div className="recipes-header">
		<h2>Gestion des Recettes</h2>
		<div className="recipes-header-actions">
		  <span className="p-input-icon-left">
			<i className="pi pi-search" />
			<InputText
			  value={globalFilter}
			  onChange={(e) => setGlobalFilter(e.target.value)}
			  placeholder="Rechercher..."
			/>
		  </span>
		  <Dropdown
			value={`${sortField}:${sortOrder}`}
			options={sortOptions}
			onChange={handleSortChange}
			className="sort-dropdown"
		  />
		</div>
	  </div>
	);
  };

  const itemTemplate = (recette: RecetteInterface) => {
	const statusColors = {
	  pending: 'var(--warning-color)',
	  approved: 'var(--success-color)',
	  rejected: 'var(--danger-color)'
	};

	return (
	  <div className="recipe-card-admin">
		<div className="recipe-card-header">
		  <div className="recipe-title-section">
			<h3>{recette.title}</h3>
			<Tag
			  value={recette.type}
			  severity="info"
			  className="recipe-type-tag"
			/>
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
			  <Image
				src={recette.images[0]}
				alt={recette.title}
				width="100"
				preview
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
					  <p>{part.steps.join('\n')}</p>
					  <ul>
						{part.ingredients.map((ingredient, index) => (
						  <li key={index}>{ingredient.name} ({ingredient.quantity} {ingredient.unit})</li>
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
			<Button
			  icon="pi pi-check"
			  className="p-button-rounded p-button-success p-button-text"
			  onClick={() => confirmAccept(recette)}
			  tooltip="Approuver"
			  tooltipOptions={{ position: 'bottom' }}
			  disabled={recette.status === 'approved'}
			/>
			<Button
			  icon="pi pi-times"
			  className="p-button-rounded p-button-warning p-button-text"
			  onClick={() => confirmReject(recette)}
			  tooltip="Rejeter"
			  tooltipOptions={{ position: 'bottom' }}
			  disabled={recette.status === 'rejected'}
			/>
			<Button
			  icon="pi pi-trash"
			  className="p-button-rounded p-button-danger p-button-text"
			  onClick={() => confirmDelete(recette.recetteId, recette.title)}
			  tooltip="Supprimer"
			  tooltipOptions={{ position: 'bottom' }}
			/>
		  </div>
		</div>
	  </div>
	);
  };

  if (loading) {
	return (
	  <div className="loading-container">
		<ProgressSpinner />
		<p>Chargement des recettes...</p>
	  </div>
	);
  }

  const filteredRecettes = recettes.filter(recette =>
	recette.title.toLowerCase().includes(globalFilter.toLowerCase()) ||
	recette.type.toLowerCase().includes(globalFilter.toLowerCase()) ||
	recette.createdBy.toLowerCase().includes(globalFilter.toLowerCase())
  );

  return (
	<div className="recipes-admin">
	  <Toast ref={toast} />
	  <ConfirmDialog />

	  <DataView
		value={filteredRecettes}
		layout="grid"
		header={header()}
		itemTemplate={itemTemplate}
		paginator
		rows={6}
		first={first}
		onPage={(e) => setFirst(e.first)}
		emptyMessage="Aucune recette trouvée"
	  />
	</div>
  );
};

export default RecettesAdmin;
