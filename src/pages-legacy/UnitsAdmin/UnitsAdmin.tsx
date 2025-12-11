"use client";
import React, { useEffect, useState, useRef } from 'react';
import './UnitsAdmin.css';
import { AddUnit } from '@/components/features';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from '@firebase/firestore';
import { db } from '@/lib/config/firebase';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { toastMessages } from '@/lib/utils/toast';
import { useToast } from '@/contexts/ToastContext/ToastContext';

interface Unit {
  id: string;
  name: string;
  abbreviation: string;
  createdAt?: Date;
  updatedAt?: Date;
  isActive?: boolean;
}

const UnitsAdmin: React.FC = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [globalFilter, setGlobalFilter] = useState<string>('');
  const toast = useRef<Toast>(null);
  const { showToast } = useToast();

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
	confirmDialog({
	  message: `Êtes-vous sûr de vouloir supprimer l'unité "${name}" ?`,
	  header: 'Confirmation de suppression',
	  icon: 'pi pi-exclamation-triangle',
	  acceptLabel: 'Oui',
	  rejectLabel: 'Non',
	  accept: () => handleDelete(unitId)
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

  const handleCellEdit = async (e: any) => {
	try {
	  const { newValue, field, rowData } = e;
	  await updateDoc(doc(db, 'units', rowData.id), {
		[field]: newValue,
		updatedAt: new Date()
	  });
	  showToast({
		severity: 'success',
		summary: toastMessages.success.default,
		detail: toastMessages.success.update
	  });
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

  const header = (
	<div className="table-header">
	  <h2>Gestion des Unités</h2>
	  <div className="table-header-actions">
		<span className="p-input-icon-left">
		  <i className="pi pi-search" />
		  <InputText
			value={globalFilter}
			onChange={(e) => setGlobalFilter(e.target.value)}
			placeholder="Rechercher..."
		  />
		</span>
		<AddUnit />
	  </div>
	</div>
  );

  const statusTemplate = (rowData: Unit) => {
	return (
	  <Tag
		value={rowData.isActive ? 'Active' : 'Inactive'}
		severity={rowData.isActive ? 'success' : 'danger'}
		onClick={() => toggleActive(rowData)}
		style={{ cursor: 'pointer' }}
	  />
	);
  };

  const dateTemplate = (rowData: Unit, field: 'createdAt' | 'updatedAt') => {
	return rowData[field]?.toLocaleDateString('fr-FR', {
	  day: '2-digit',
	  month: '2-digit',
	  year: 'numeric',
	  hour: '2-digit',
	  minute: '2-digit'
	}) || '-';
  };

  const actionTemplate = (rowData: Unit) => {
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
	<div className="units-admin">
	  <Toast ref={toast} />
	  <ConfirmDialog />

	  <div className="table-container">
		<DataTable
		  value={units}
		  paginator
		  rows={10}
		  loading={loading}
		  globalFilter={globalFilter}
		  header={header}
		  editMode="cell"
		  className="units-table"
		  emptyMessage="Aucune unité trouvée"
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
			field="abbreviation"
			header="Abréviation"
			sortable
			editor={(options) => <InputText value={options.value} onChange={(e) => options.editorCallback?.(e.target.value)} />}
			onCellEditComplete={handleCellEdit}
		  />
		  <Column
			field="isActive"
			header="Statut"
			sortable
			body={statusTemplate}
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

export default UnitsAdmin;
