"use client";
import React, { useEffect, useState } from 'react';
import './units-admin.css';
import { AddUnit } from '@/components/features';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { toastMessages } from '@/lib/utils/toast';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import { ConfirmDialog } from '@/components/ui';
import { useConfirmDialog } from '@/hooks';

interface Unit {
  id: string;
  name: string;
  abbreviation: string;
  createdAt?: Date;
  updatedAt?: Date;
  isActive?: boolean;
}

export default function UnitsAdminPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [globalFilter, setGlobalFilter] = useState<string>('');
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const { showToast } = useToast();
  const { confirm, visible, dialogState, handleAccept, handleReject } = useConfirmDialog();

  const handleFetchUnits = () => {
    try {
      setLoading(true);
      const unitsQuery = query(
        collection(db, "units"),
        orderBy("name", "asc")
      );

      const unsubscribe = onSnapshot(unitsQuery, (querySnapshot) => {
        const unitsData: Unit[] = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            abbreviation: data.abbreviation,
            createdAt: data.createdAt?.toDate(),
            updatedAt: data.updatedAt?.toDate(),
            isActive: data.isActive ?? true
          } as Unit;
        });

        setUnits(unitsData);
        setLoading(false);
      }, (error) => {
        console.error("Error getting units:", error);
        showToast({
          severity: 'error',
          summary: toastMessages.error.default,
          detail: 'Impossible de charger les unités'
        });
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error("Error in handleFetchUnits:", error);
      setLoading(false);
      return () => {};
    }
  };

  useEffect(() => {
    const unsubscribe = handleFetchUnits();
    return () => unsubscribe();
  }, []);

  const confirmDelete = (unitId: string, name: string) => {
    confirm({
      message: `Êtes-vous sûr de vouloir supprimer l'unité "${name}" ?`,
      header: 'Confirmation de suppression',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Oui',
      rejectLabel: 'Non',
      onAccept: () => handleDelete(unitId)
    });
  };

  const handleDelete = async (unitId: string) => {
    try {
      await deleteDoc(doc(db, 'units', unitId));
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

  const startEdit = (unit: Unit, field: string) => {
    setEditingCell({ id: unit.id, field });
    setEditValue(unit[field as keyof Unit]?.toString() || '');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEdit = async (unit: Unit) => {
    if (!editingCell) return;

    try {
      await updateDoc(doc(db, 'units', unit.id), {
        [editingCell.field]: editValue,
        updatedAt: new Date()
      });

      showToast({
        severity: 'success',
        summary: toastMessages.success.default,
        detail: toastMessages.success.update
      });

      setEditingCell(null);
      setEditValue('');
    } catch (error) {
      console.error('Erreur de mise à jour:', error);
      showToast({
        severity: 'error',
        summary: toastMessages.error.default,
        detail: toastMessages.error.update
      });
    }
  };

  const toggleActive = async (unit: Unit) => {
    try {
      await updateDoc(doc(db, 'units', unit.id), {
        isActive: !unit.isActive,
        updatedAt: new Date()
      });
      showToast({
        severity: 'success',
        summary: toastMessages.success.default,
        detail: `Unité marquée comme ${!unit.isActive ? 'active' : 'inactive'}`
      });
    } catch (error) {
      console.error('Erreur de mise à jour du statut:', error);
      showToast({
        severity: 'error',
        summary: toastMessages.error.default,
        detail: 'Impossible de mettre à jour le statut'
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

  const filteredUnits = units.filter(unit =>
    unit.name.toLowerCase().includes(globalFilter.toLowerCase()) ||
    unit.abbreviation.toLowerCase().includes(globalFilter.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Chargement des unités...</p>
      </div>
    );
  }

  return (
    <div className="units-admin">
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
        <h2>Gestion des Unités</h2>
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
          <AddUnit />
        </div>
      </div>

      <div className="table-container">
        {filteredUnits.length === 0 ? (
          <div className="empty-message">Aucune unité trouvée</div>
        ) : (
          <table className="units-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Abréviation</th>
                <th>Statut</th>
                <th>Créé le</th>
                <th>Modifié le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUnits.map((unit) => (
                <tr key={unit.id} className={unit.isActive ? '' : 'inactive'}>
                  <td>
                    {editingCell?.id === unit.id && editingCell.field === 'name' ? (
                      <div className="cell-edit">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(unit);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          autoFocus
                          className="cell-input"
                        />
                        <div className="cell-actions">
                          <button onClick={() => saveEdit(unit)} className="btn-save" title="Enregistrer">
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
                        onClick={() => startEdit(unit, 'name')}
                        title="Cliquer pour éditer"
                      >
                        {unit.name}
                      </span>
                    )}
                  </td>
                  <td>
                    {editingCell?.id === unit.id && editingCell.field === 'abbreviation' ? (
                      <div className="cell-edit">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(unit);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          autoFocus
                          className="cell-input"
                        />
                        <div className="cell-actions">
                          <button onClick={() => saveEdit(unit)} className="btn-save" title="Enregistrer">
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
                        onClick={() => startEdit(unit, 'abbreviation')}
                        title="Cliquer pour éditer"
                      >
                        {unit.abbreviation}
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`status-badge ${unit.isActive ? 'active' : 'inactive'}`}
                      onClick={() => toggleActive(unit)}
                      title="Cliquer pour changer le statut"
                    >
                      {unit.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{formatDate(unit.createdAt)}</td>
                  <td>{formatDate(unit.updatedAt)}</td>
                  <td>
                    <button
                      className="btn-action btn-danger"
                      onClick={() => confirmDelete(unit.id, unit.name)}
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
