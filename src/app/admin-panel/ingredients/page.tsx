"use client";
import React, { useEffect, useState } from 'react';
import './ingredients-admin.css';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { AddIngredient } from '@/components/features';
import { toastMessages } from '@/lib/utils/toast';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import { ConfirmDialog } from '@/components/ui';
import { useConfirmDialog } from '@/hooks';

interface Ingredient {
  id: string;
  name: string;
  price: number;
  unit: string;
  createdAt?: Date;
  updatedAt?: Date;
  inStock?: boolean;
}

export default function IngredientsAdminPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [globalFilter, setGlobalFilter] = useState<string>('');
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const { showToast } = useToast();
  const { confirm, visible, dialogState, handleAccept, handleReject } = useConfirmDialog();

  const handleFetchIngredients = () => {
    try {
      setLoading(true);
      const ingredientsQuery = query(
        collection(db, "ingredients"),
        orderBy("name", "asc")
      );

      const unsubscribe = onSnapshot(ingredientsQuery, (querySnapshot) => {
        const ingredientsData: Ingredient[] = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            name: data.name,
            price: data.price,
            unit: data.unit,
            id: doc.id,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
            inStock: data.inStock ?? true
          } as Ingredient;
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
    confirm({
      message: `Êtes-vous sûr de vouloir supprimer l'ingrédient "${name}" ?`,
      header: 'Confirmation de suppression',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Oui',
      rejectLabel: 'Non',
      onAccept: () => handleDelete(ingredientId)
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

  const startEdit = (ingredient: Ingredient, field: string) => {
    setEditingCell({ id: ingredient.id, field });
    setEditValue(field === 'price' ? ingredient.price.toString() : ingredient[field as keyof Ingredient]?.toString() || '');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEdit = async (ingredient: Ingredient) => {
    if (!editingCell) return;

    try {
      const updateData: any = {
        updatedAt: new Date()
      };

      if (editingCell.field === 'price') {
        updateData[editingCell.field] = parseFloat(editValue) || 0;
      } else {
        updateData[editingCell.field] = editValue;
      }

      await updateDoc(doc(db, 'ingredients', ingredient.id), updateData);

      showToast({
        severity: 'success',
        summary: 'Succès',
        detail: 'Ingrédient mis à jour avec succès',
        life: 3000
      });

      setEditingCell(null);
      setEditValue('');
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

  const formatDate = (date?: Date) => {
    if (!date) return '-';
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredIngredients = ingredients.filter(ingredient =>
    ingredient.name.toLowerCase().includes(globalFilter.toLowerCase()) ||
    ingredient.unit.toLowerCase().includes(globalFilter.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Chargement des ingrédients...</p>
      </div>
    );
  }

  return (
    <div className="ingredients-admin">
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

      <div className="table-header">
        <h2>Gestion des Ingrédients</h2>
        <div className="table-header-actions">
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
          <AddIngredient />
        </div>
      </div>

      <div className="table-container">
        {filteredIngredients.length === 0 ? (
          <div className="empty-message">Aucun ingrédient trouvé</div>
        ) : (
          <table className="ingredients-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Prix</th>
                <th>Unité</th>
                <th>Stock</th>
                <th>Créé le</th>
                <th>Modifié le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIngredients.map((ingredient) => (
                <tr key={ingredient.id} className={ingredient.inStock ? '' : 'out-of-stock'}>
                  <td>
                    {editingCell?.id === ingredient.id && editingCell.field === 'name' ? (
                      <div className="cell-edit">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(ingredient);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          autoFocus
                          className="cell-input"
                        />
                        <div className="cell-actions">
                          <button onClick={() => saveEdit(ingredient)} className="btn-save" title="Enregistrer">
                            <i className="pi pi-check"></i>
                          </button>
                          <button onClick={cancelEdit} className="btn-cancel" title="Annuler">
                            <i className="pi pi-times"></i>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span
                        className="editable-cell"
                        onClick={() => startEdit(ingredient, 'name')}
                        title="Cliquer pour éditer"
                      >
                        {ingredient.name}
                      </span>
                    )}
                  </td>
                  <td>
                    {editingCell?.id === ingredient.id && editingCell.field === 'price' ? (
                      <div className="cell-edit">
                        <input
                          type="number"
                          step="0.01"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(ingredient);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          autoFocus
                          className="cell-input"
                        />
                        <div className="cell-actions">
                          <button onClick={() => saveEdit(ingredient)} className="btn-save" title="Enregistrer">
                            <i className="pi pi-check"></i>
                          </button>
                          <button onClick={cancelEdit} className="btn-cancel" title="Annuler">
                            <i className="pi pi-times"></i>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span
                        className="editable-cell"
                        onClick={() => startEdit(ingredient, 'price')}
                        title="Cliquer pour éditer"
                      >
                        {ingredient.price.toFixed(2)} €
                      </span>
                    )}
                  </td>
                  <td>
                    {editingCell?.id === ingredient.id && editingCell.field === 'unit' ? (
                      <div className="cell-edit">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(ingredient);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          autoFocus
                          className="cell-input"
                        />
                        <div className="cell-actions">
                          <button onClick={() => saveEdit(ingredient)} className="btn-save" title="Enregistrer">
                            <i className="pi pi-check"></i>
                          </button>
                          <button onClick={cancelEdit} className="btn-cancel" title="Annuler">
                            <i className="pi pi-times"></i>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span
                        className="editable-cell"
                        onClick={() => startEdit(ingredient, 'unit')}
                        title="Cliquer pour éditer"
                      >
                        {ingredient.unit}
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`stock-badge ${ingredient.inStock ? 'in-stock' : 'out-of-stock'}`}
                      onClick={() => toggleStock(ingredient)}
                      title="Cliquer pour changer le statut"
                    >
                      {ingredient.inStock ? 'En stock' : 'Rupture'}
                    </span>
                  </td>
                  <td>{formatDate(ingredient.createdAt)}</td>
                  <td>{formatDate(ingredient.updatedAt)}</td>
                  <td>
                    <button
                      className="btn-action btn-danger"
                      onClick={() => confirmDelete(ingredient.id, ingredient.name)}
                      title="Supprimer"
                    >
                      <i className="pi pi-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
