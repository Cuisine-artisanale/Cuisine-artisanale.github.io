"use client";
import React, { useEffect, useState } from 'react';
import './units-admin.css';
import AddUnit from '@/components/features/AddUnit/AddUnit';
import { collection, deleteDoc, deleteField, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { DEFAULT_UNITS, UNIT_TYPE_BASE, UNIT_TYPE_LABELS, type UnitType } from '@/lib/utils/units';
import { db } from '@/lib/config/firebase';
import { toastMessages } from '@/lib/utils/toast';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog/ConfirmDialog';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

interface Unit {
  id: string;
  name: string;
  plural: string;
  abbreviation: string;
  type: UnitType;
  toBase?: number;
  aliases: string;
  replacedBy?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
  isActive?: boolean;
}

const STANDARD_IDS = new Set(DEFAULT_UNITS.map((u) => u.id));
type EditableField = 'name' | 'plural' | 'abbreviation' | 'toBase' | 'aliases';

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
            name: data.name || '',
            plural: data.plural || '',
            abbreviation: data.abbreviation || '',
            type: (data.type as UnitType) || 'other',
            toBase: typeof data.toBase === 'number' ? data.toBase : undefined,
            aliases: Array.isArray(data.aliases) ? data.aliases.join(', ') : '',
            replacedBy: data.replacedBy,
            createdBy: data.createdBy,
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
      let value: unknown = editValue.trim();
      if (editingCell.field === 'toBase') {
        const n = Number(String(value).replace(',', '.'));
        value = Number.isFinite(n) && n > 0 ? n : deleteField();
      } else if (editingCell.field === 'aliases') {
        value = String(value).split(',').map((a) => a.trim()).filter(Boolean);
      }
      await updateDoc(doc(db, 'units', unit.id), {
        [editingCell.field]: value,
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

  const changeType = async (unit: Unit, type: UnitType) => {
    try {
      await updateDoc(doc(db, 'units', unit.id), {
        type,
        ...(type === 'mass' || type === 'volume' ? {} : { toBase: deleteField() }),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Erreur de mise à jour du type:', error);
      showToast({ severity: 'error', summary: toastMessages.error.default, detail: toastMessages.error.update });
    }
  };

  const renderEditable = (unit: Unit, field: EditableField, display: React.ReactNode) =>
    editingCell?.id === unit.id && editingCell.field === field ? (
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
      <span className="editable-cell" onClick={() => startEdit(unit, field)} title="Cliquer pour éditer">
        {display || <em style={{ opacity: 0.5 }}>—</em>}
      </span>
    );

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


  const filteredUnits = units.filter(unit =>
    unit.name.toLowerCase().includes(globalFilter.toLowerCase()) ||
    unit.abbreviation.toLowerCase().includes(globalFilter.toLowerCase()) ||
    unit.aliases.toLowerCase().includes(globalFilter.toLowerCase())
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
                <th>Pluriel</th>
                <th>Abréviation</th>
                <th>Type</th>
                <th>Équivalence</th>
                <th>Variantes reconnues</th>
                <th>Origine</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUnits.map((unit) => (
                <tr key={unit.id} className={unit.isActive && !unit.replacedBy ? '' : 'inactive'}>
                  <td>{renderEditable(unit, 'name', unit.name)}</td>
                  <td>{renderEditable(unit, 'plural', unit.plural)}</td>
                  <td>{renderEditable(unit, 'abbreviation', unit.abbreviation)}</td>
                  <td>
                    <select
                      value={unit.type}
                      onChange={(e) => changeType(unit, e.target.value as UnitType)}
                      className="cell-input"
                      aria-label={`Type de l'unité ${unit.name}`}
                    >
                      {(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((t) => (
                        <option key={t} value={t}>{UNIT_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {unit.type === 'mass' || unit.type === 'volume'
                      ? renderEditable(unit, 'toBase', unit.toBase ? `= ${unit.toBase.toLocaleString('fr-FR')} ${UNIT_TYPE_BASE[unit.type]}` : '')
                      : <em style={{ opacity: 0.5 }}>—</em>}
                  </td>
                  <td>{renderEditable(unit, 'aliases', unit.aliases)}</td>
                  <td>
                    {unit.replacedBy
                      ? `Doublon de « ${unit.replacedBy} »`
                      : STANDARD_IDS.has(unit.id)
                        ? 'Standard'
                        : unit.createdBy
                          ? 'Créée par un utilisateur'
                          : 'Ancienne'}
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
