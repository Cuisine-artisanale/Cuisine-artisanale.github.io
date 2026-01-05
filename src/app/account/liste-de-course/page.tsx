"use client";
import React, { useEffect, useState } from 'react';
import './liste-de-course.css';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { RequireEmailVerification } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import {
  getOrCreateShoppingList,
  addShoppingListItem,
  updateShoppingListItem,
  removeShoppingListItem,
  clearShoppingList
} from '@/lib/services/shopping.service';
import type { ShoppingList, ShoppingListItem } from '@/types/shopping.types';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Checkbox } from 'primereact/checkbox';
import { Dialog } from 'primereact/dialog';
import { confirmDialog } from 'primereact/confirmdialog';
import { ConfirmDialog } from 'primereact/confirmdialog';

export default function ListeDeCoursePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingListItem | null>(null);

  useEffect(() => {
    if (user) {
      fetchShoppingList();
    }
  }, [user]);

  const fetchShoppingList = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!user) {
        setError("Utilisateur non connecté");
        return;
      }

      const list = await getOrCreateShoppingList(user.uid);
      setShoppingList(list);
    } catch (error) {
      console.error("Error fetching shopping list:", error);
      setError("Erreur lors du chargement de la liste de course");
      showToast({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Impossible de charger la liste de course'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = async (item: ShoppingListItem) => {
    if (!shoppingList) return;

    try {
      await updateShoppingListItem(shoppingList.id, item.id, {
        checked: !item.checked
      });

      // Mettre à jour l'état local
      setShoppingList({
        ...shoppingList,
        items: shoppingList.items.map(i =>
          i.id === item.id ? { ...i, checked: !i.checked } : i
        )
      });
    } catch (error) {
      console.error("Error toggling item:", error);
      showToast({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Impossible de mettre à jour l\'élément'
      });
    }
  };

  const handleDeleteItem = (item: ShoppingListItem) => {
    if (!shoppingList) return;

    confirmDialog({
      message: `Êtes-vous sûr de vouloir supprimer "${item.name}" de votre liste ?`,
      header: 'Confirmation de suppression',
      icon: 'pi pi-exclamation-triangle',
      accept: async () => {
        try {
          await removeShoppingListItem(shoppingList.id, item.id);
          setShoppingList({
            ...shoppingList,
            items: shoppingList.items.filter(i => i.id !== item.id)
          });
          showToast({
            severity: 'success',
            summary: 'Supprimé',
            detail: 'Élément retiré de la liste'
          });
        } catch (error) {
          console.error("Error deleting item:", error);
          showToast({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Impossible de supprimer l\'élément'
          });
        }
      }
    });
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) {
      showToast({
        severity: 'warn',
        summary: 'Attention',
        detail: 'Veuillez saisir un nom d\'ingrédient'
      });
      return;
    }

    if (!shoppingList) return;

    const newItem: ShoppingListItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newItemName.trim(),
      quantity: newItemQuantity.trim() || undefined,
      unit: newItemUnit.trim() || undefined,
      checked: false,
      createdAt: new Date()
    };

    try {
      // Ajouter dans Firebase
      await addShoppingListItem(user!.uid, newItem);

      // Mettre à jour localement après succès
      setShoppingList({
        ...shoppingList,
        items: [...shoppingList.items, newItem]
      });

      // Réinitialiser le formulaire
      setNewItemName('');
      setNewItemQuantity('');
      setNewItemUnit('');
      setShowAddDialog(false);
      showToast({
        severity: 'success',
        summary: 'Ajouté',
        detail: 'Élément ajouté à la liste'
      });
    } catch (error) {
      console.error("Error adding item:", error);
      showToast({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Impossible d\'ajouter l\'élément'
      });
    }
  };

  const handleClearList = () => {
    if (!shoppingList) return;

    confirmDialog({
      message: 'Êtes-vous sûr de vouloir vider toute la liste de course ?',
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      accept: async () => {
        try {
          await clearShoppingList(shoppingList.id);
          setShoppingList({
            ...shoppingList,
            items: []
          });
          showToast({
            severity: 'success',
            summary: 'Liste vidée',
            detail: 'Tous les éléments ont été supprimés'
          });
        } catch (error) {
          console.error("Error clearing list:", error);
          showToast({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Impossible de vider la liste'
          });
        }
      }
    });
  };

  const getCheckedCount = () => {
    if (!shoppingList) return 0;
    return shoppingList.items.filter(item => item.checked).length;
  };

  const getTotalCount = () => {
    if (!shoppingList) return 0;
    return shoppingList.items.length;
  };

  if (loading) {
    return (
      <RequireEmailVerification>
        <div className="shopping-list-loading">
          <div className="spinner"></div>
          <p>Chargement de votre liste de course...</p>
        </div>
      </RequireEmailVerification>
    );
  }

  return (
    <RequireEmailVerification>
      <ConfirmDialog />
      <div className="shopping-list-page">
        <div className="shopping-list-header">
          <div>
            <h2>Liste de Course</h2>
            {shoppingList && (
              <p className="shopping-list-stats">
                {getCheckedCount()} / {getTotalCount()} éléments cochés
              </p>
            )}
          </div>
          <div className="shopping-list-actions">
            <Button
              label="Ajouter un élément"
              icon="pi pi-plus"
              onClick={() => setShowAddDialog(true)}
              className="p-button-primary"
            />
            {shoppingList && shoppingList.items.length > 0 && (
              <Button
                label="Vider la liste"
                icon="pi pi-trash"
                onClick={handleClearList}
                severity="danger"
                outlined
              />
            )}
          </div>
        </div>

        {error && (
          <div className="error-message">
            <i className="pi pi-exclamation-triangle"></i>
            <span>{error}</span>
          </div>
        )}

        {shoppingList && shoppingList.items.length === 0 ? (
          <div className="empty-state">
            <i className="pi pi-shopping-cart empty-icon"></i>
            <h3>Votre liste de course est vide</h3>
            <p>Ajoutez des ingrédients depuis vos recettes ou manuellement</p>
            <Button
              label="Ajouter un élément"
              icon="pi pi-plus"
              onClick={() => setShowAddDialog(true)}
              className="p-button-primary"
            />
          </div>
        ) : (
          <div className="shopping-list-container">
            <div className="shopping-list-items">
              {shoppingList?.items.map((item) => (
                <div
                  key={item.id}
                  className={`shopping-list-item ${item.checked ? 'checked' : ''}`}
                >
                  <div className="item-checkbox">
                    <Checkbox
                      checked={item.checked}
                      onChange={() => handleToggleItem(item)}
                    />
                  </div>
                  <div className="item-content">
                    <div className="item-name">{item.name}</div>
                    {(item.quantity || item.unit) && (
                      <div className="item-quantity">
                        {item.quantity} {item.unit}
                      </div>
                    )}
                    {item.recipeTitle && (
                      <div className="item-recipe">
                        <i className="pi pi-book"></i>
                        {item.recipeTitle}
                      </div>
                    )}
                  </div>
                  <div className="item-actions">
                    <Button
                      icon="pi pi-trash"
                      onClick={() => handleDeleteItem(item)}
                      className="p-button-text p-button-danger"
                      tooltip="Supprimer"
                      tooltipOptions={{ position: 'top' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dialog pour ajouter un élément */}
        <Dialog
          header="Ajouter un élément"
          visible={showAddDialog}
          style={{ width: '90vw', maxWidth: '500px' }}
          onHide={() => {
            setShowAddDialog(false);
            setNewItemName('');
            setNewItemQuantity('');
            setNewItemUnit('');
          }}
          footer={
            <div>
              <Button
                label="Annuler"
                icon="pi pi-times"
                onClick={() => {
                  setShowAddDialog(false);
                  setNewItemName('');
                  setNewItemQuantity('');
                  setNewItemUnit('');
                }}
                className="p-button-text"
              />
              <Button
                label="Ajouter"
                icon="pi pi-check"
                onClick={handleAddItem}
                className="p-button-primary"
              />
            </div>
          }
        >
          <div className="add-item-form">
            <div className="form-field">
              <label htmlFor="item-name">Nom de l'ingrédient *</label>
              <InputText
                id="item-name"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="ex: Farine"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddItem();
                  }
                }}
              />
            </div>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="item-quantity">Quantité</label>
                <InputText
                  id="item-quantity"
                  value={newItemQuantity}
                  onChange={(e) => setNewItemQuantity(e.target.value)}
                  placeholder="ex: 500"
                />
              </div>
              <div className="form-field">
                <label htmlFor="item-unit">Unité</label>
                <InputText
                  id="item-unit"
                  value={newItemUnit}
                  onChange={(e) => setNewItemUnit(e.target.value)}
                  placeholder="ex: g, ml, cuillères"
                />
              </div>
            </div>
          </div>
        </Dialog>
      </div>
    </RequireEmailVerification>
  );
}
