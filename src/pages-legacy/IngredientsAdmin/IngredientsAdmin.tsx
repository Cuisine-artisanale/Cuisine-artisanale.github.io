"use client";
import React, { useEffect, useState } from 'react';
import './IngredientsAdmin.css';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { AddIngredient } from '@/components/features';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { Button } from 'primereact/button';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { InputNumber } from 'primereact/inputnumber';
import { toastMessages } from '@/lib/utils/toast';
import { useToast } from '@/contexts/ToastContext/ToastContext';

interface Ingredient {
  id: string;
  name: string;
  price: number;
  unit: string;
  createdAt?: Date;
  updatedAt?: Date;
  inStock?: boolean;
}

const IngredientsAdmin: React.FC = () => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [globalFilter, setGlobalFilter] = useState<string>('');
  const { showToast } = useToast();

  const handleFetchIngredients = () => {
	try {
	  setLoading(true);
	  const ingredientsQuery = query(
		collection(db, "ingredients"),
		orderBy("name", "asc")
	  );

	  const unsubscribe = onSnapshot(ingredientsQuery, (querySnapshot) => {
		const ingredientsData: IngredientAdmin[] = querySnapshot.docs.map((doc) => {
		  const data = doc.data();
		  return {
			name: data.name,
			price: data.price,
			unit: data.unit,
			category: data.category ?? '',
			id: doc.id,
			createdAt: data.createdAt?.toDate(),
			updatedAt: data.updatedAt?.toDate(),
			inStock: data.inStock ?? true
		  } as IngredientAdmin;
		});

		setIngredients(ingredientsData);
		setLoading(false);
	  }, (error) => {
		console.error("Error getting ingredients:", error);
		showToast({
		  severity: 'error',
		  summary: toastMessages.error.default,
		  detail: 'Impossible de charger les ingrédients'
		});
		setLoading(false);
	  });

	  return unsubscribe;
	} catch (error) {
	  console.error("Error in handleFetchIngredients:", error);
	  setLoading(false);
	  return () => {};
	}
  };

  useEffect(() => {
	const unsubscribe = handleFetchIngredients();
	return () => unsubscribe();
  }, []);

  const confirmDelete = (ingredientId: string, name: string) => {
	confirmDialog({
	  message: `Êtes-vous sûr de vouloir supprimer l'ingrédient "${name}" ?`,
	  header: 'Confirmation de suppression',
	  icon: 'pi pi-exclamation-triangle',
	  acceptLabel: 'Oui',
	  rejectLabel: 'Non',
	  accept: () => handleDelete(ingredientId)
	});
  };

  const handleDelete = async (ingredientId: string) => {
	try {
	  await deleteDoc(doc(db, 'ingredients', ingredientId));
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
		detail: toastMessages.error.delete,
		life: 3000
	  });
	}
  };

  const handleCellEdit = async (e: any) => {
	try {
	  const { newValue, field, rowData } = e;
	  await updateDoc(doc(db, 'ingredients', rowData.id), {
		[field]: newValue,
		updatedAt: new Date()
	  });

	  showToast({
		severity: 'success',
		summary: 'Succès',
		detail: 'Ingrédient mis à jour avec succès',
		life: 3000
	  });
	} catch (error) {
	  console.error('Erreur de mise à jour:', error);
	  showToast({
		severity: 'error',
		summary: 'Erreur',
		detail: 'Impossible de mettre à jour l\'ingrédient',
		life: 3000
	  });
	}
  };

  const toggleStock = async (ingredient: Ingredient) => {
	try {
	  await updateDoc(doc(db, 'ingredients', ingredient.id), {
		inStock: !ingredient.inStock,
		updatedAt: new Date()
	  });

	  showToast({
		severity: 'success',
		summary: 'Succès',
		detail: `Ingrédient marqué comme ${!ingredient.inStock ? 'en stock' : 'en rupture'}`,
		life: 3000
	  });
	} catch (error) {
	  console.error('Erreur de mise à jour du stock:', error);
	  showToast({
		severity: 'error',
		summary: 'Erreur',
		detail: 'Impossible de mettre à jour le stock',
		life: 3000
	  });
	}
  };

  const header = (
	<div className="table-header">
	  <h2>Gestion des Ingrédients</h2>
	  <div className="table-header-actions">
		<span className="p-input-icon-left">
		  <i className="pi pi-search" />
		  <InputText
			value={globalFilter}
			onChange={(e) => setGlobalFilter(e.target.value)}
			placeholder="Rechercher..."
		  />
		</span>
		<AddIngredient />
	  </div>
	</div>
  );

  const priceTemplate = (rowData: Ingredient) => {
	return `${rowData.price.toFixed(2)} €`;
  };


  const stockTemplate = (rowData: Ingredient) => {
	return (
	  <Tag
		value={rowData.inStock ? 'En stock' : 'Rupture'}
		severity={rowData.inStock ? 'success' : 'danger'}
		onClick={() => toggleStock(rowData)}
		style={{ cursor: 'pointer' }}
	  />
	);
  };

  const dateTemplate = (rowData: Ingredient, field: 'createdAt' | 'updatedAt') => {
	return rowData[field]?.toLocaleDateString('fr-FR', {
	  day: '2-digit',
	  month: '2-digit',
	  year: 'numeric',
	  hour: '2-digit',
	  minute: '2-digit'
	}) || '-';
  };

  const actionTemplate = (rowData: Ingredient) => {
	return (
	  <div className="action-buttons">
		<Button
		  icon="pi pi-trash"
		  className="p-button-rounded p-button-danger p-button-text"
		  onClick={() => confirmDelete(rowData.id, rowData.name)}
		  tooltip="Supprimer"
		/>
	  </div>
	);
  };

  return (
	<div className="ingredients-admin">
	  <ConfirmDialog />

	  <div className="table-container">
		<DataTable
		  value={ingredients}
		  paginator
		  rows={10}
		  loading={loading}
		  globalFilter={globalFilter}
		  header={header}
		  editMode="cell"
		  className="ingredients-table"
		  emptyMessage="Aucun ingrédient trouvé"
		  responsiveLayout="scroll"
		  showGridlines
		  stripedRows
		>
		  <Column
			field="name"
			header="Nom"
			sortable
			editor={(options) => <InputText value={options.value} onChange={(e) => options.editorCallback?.(e.target.value)} />}
			onCellEditComplete={handleCellEdit}
		  />
		  <Column
			field="price"
			header="Prix"
			sortable
			body={priceTemplate}
			editor={(options) => (
			  <InputNumber
				value={options.value}
				onValueChange={(e) => options.editorCallback?.(e.value)}
				mode="currency"
				currency="EUR"
				locale="fr-FR"
				minFractionDigits={2}
			  />
			)}
			onCellEditComplete={handleCellEdit}
		  />
		  <Column
			field="unit"
			header="Unité"
			sortable
			editor={(options) => <InputText value={options.value} onChange={(e) => options.editorCallback?.(e.target.value)} />}
			onCellEditComplete={handleCellEdit}
		  />
		  <Column
			field="inStock"
			header="Stock"
			sortable
			body={stockTemplate}
		  />
		  <Column
			field="createdAt"
			header="Créé le"
			sortable
			body={(rowData) => dateTemplate(rowData, 'createdAt')}
		  />
		  <Column
			field="updatedAt"
			header="Modifié le"
			sortable
			body={(rowData) => dateTemplate(rowData, 'updatedAt')}
		  />
		  <Column
			body={actionTemplate}
			header="Actions"
			style={{ width: '100px' }}
		  />
		</DataTable>
	  </div>
	</div>
  );
};

export default IngredientsAdmin;
