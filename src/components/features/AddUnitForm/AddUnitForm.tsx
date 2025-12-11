import React, { useState, useRef, useEffect } from 'react';
import './AddUnitForm.css';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { Dialog } from 'primereact/dialog';
import { addDoc, collection } from '@firebase/firestore';
import { db } from '@/lib/config/firebase';
import { toastMessages } from '@/lib/utils/toast';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import type { Unit } from '@/types';

interface AddUnitFormProps {
	visible: boolean;
	onHide: () => void;
	onUnitCreated?: (unit: Unit) => void;
	initialName?: string;
}

const AddUnitForm: React.FC<AddUnitFormProps> = ({ visible, onHide, onUnitCreated, initialName }) => {
  const [name, setName] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<{ name?: string; abbreviation?: string }>({});
  const toast = useRef<Toast>(null);
  const { showToast } = useToast();

  useEffect(() => {
		if (visible) {
			setName(initialName || '');
		}
	}, [visible, initialName]);

  const validateForm = () => {
	const errors: { name?: string; abbreviation?: string } = {};

	if (!name.trim()) {
	  errors.name = 'Le nom est requis';
	}
	if (!abbreviation.trim()) {
	  errors.abbreviation = 'L\'abréviation est requise';
	}
	if (abbreviation.length > 5) {
	  errors.abbreviation = 'L\'abréviation ne doit pas dépasser 5 caractères';
	}

	setFormErrors(errors);
	return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
	event.preventDefault();

	if (!validateForm()) {
	  return;
	}

	setLoading(true);

	try {
		const docRef = await addDoc(collection(db, 'units'), {
			name: name.trim(),
			abbreviation: abbreviation.trim(),
			createdAt: new Date(),
			isActive: true
		});

		if (onUnitCreated) {
			onUnitCreated({
			id: docRef.id,
			name: name.trim(),
			abbreviation: abbreviation.trim()
			});
		}

		showToast({
			severity: 'success',
			summary: toastMessages.success.default,
			detail: toastMessages.success.create
		});

		setName('');
		setAbbreviation('');
		onHide();
	} catch (error) {
		console.error('Error creating unit:', error);
		showToast({
			severity: 'error',
			summary: toastMessages.error.default,
			detail: toastMessages.error.create
		});
	} finally {
		setLoading(false);
	}
};


  const dialogFooter = (
	<div className="form-actions">
	  <Button
		type="submit"
		label="Ajouter"
		icon="pi pi-check"
		loading={loading}
		className="p-button-success"
		onClick={handleSubmit}
	  />
	  <Button
		type="button"
		label="Annuler"
		icon="pi pi-times"
		onClick={onHide}
		className="p-button-text"
	  />
	</div>
  );

  return (
	<>
	  <Toast ref={toast} />

	  <Dialog
		header="Ajouter une unité"
		visible={visible}
		onHide={onHide}
		footer={dialogFooter}
		modal
		className="add-unit-dialog"
		closeOnEscape
		dismissableMask
	  >
		<div className="form-container">
		  <p className="required-field-note">* Champs requis</p>

		  <div className="form-field">
			<label htmlFor="name">
			  Nom <span className="required">*</span>
			</label>
			<span className="p-input-icon-right">
			  <i className={name ? "pi pi-check" : "pi pi-times"}
				 style={{ color: name ? 'var(--green-500)' : 'var(--red-500)' }} />
			  <InputText
				id="name"
				value={name}
				onChange={(e) => {
				  setName(e.target.value);
				  setFormErrors({ ...formErrors, name: undefined });
				}}
				placeholder="Entrez le nom de l'unité"
				className={formErrors.name ? 'p-invalid' : ''}
			  />
			</span>
			{formErrors.name && <small className="p-error">{formErrors.name}</small>}
		  </div>

		  <div className="form-field">
			<label htmlFor="abbreviation">
			  Abréviation <span className="required">*</span>
			</label>
			<span className="p-input-icon-right">
			  <i className={abbreviation ? "pi pi-check" : "pi pi-times"}
				 style={{ color: abbreviation ? 'var(--green-500)' : 'var(--red-500)' }} />
			  <InputText
				id="abbreviation"
				value={abbreviation}
				onChange={(e) => {
				  setAbbreviation(e.target.value);
				  setFormErrors({ ...formErrors, abbreviation: undefined });
				}}
				placeholder="Entrez l'abréviation"
				className={formErrors.abbreviation ? 'p-invalid' : ''}
				maxLength={5}
			  />
			</span>
			{formErrors.abbreviation && <small className="p-error">{formErrors.abbreviation}</small>}
		  </div>
		</div>
	  </Dialog>
	</>
  );
};

export default AddUnitForm;
