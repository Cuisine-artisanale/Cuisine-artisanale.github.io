"use client";
import React, { useEffect, useState } from 'react';
import './AddIngredientForm.css';

import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { Dialog } from 'primereact/dialog';
import { addDoc, collection, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { toastMessages } from '@/lib/utils/toast';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import AddUnitForm from '@/components/features/AddUnitForm/AddUnitForm';
import { useUnits } from '@/hooks/useUnits';
import { selectableUnits, unitOptionLabel, type UnitDef } from '@/lib/utils/units';

interface AddIngredientFormProps {
  visible: boolean;
  onHide: () => void;
  initialName?: string;
  onIngredientCreated?: (ingredientId: any) => void;
}

const AddIngredientForm: React.FC<AddIngredientFormProps> = ({ visible, onHide, initialName, onIngredientCreated }) => {
	const [name, setName] = useState('');
	const [price, setPrice] = useState<number | null>(0);
	const [unit, setUnit] = useState<UnitDef | null>(null);
	const { units: allUnits, reload: reloadUnits } = useUnits();
	const units = selectableUnits(allUnits).map((u) => ({ ...u, label: unitOptionLabel(u) }));
	const [loading, setLoading] = useState(false);
	const [formErrors, setFormErrors] = useState<{
		name?: string;
		unit?: string;
		category?: string;
	}>({});
	const { showToast } = useToast();
	const [showAddUnitDialog, setShowAddUnitDialog] = useState(false);

	useEffect(() => {
		if (visible) {
			setName(initialName || '');
		}
	}, [visible, initialName]);

  	const validateForm = () => {
		const errors: { name?: string; unit?: string; category?: string } = {};

		if (!name.trim()) {
			errors.name = 'Le nom est requis';
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
			const docRef = await addDoc(collection(db, 'ingredients'), {
				name: name.trim(),
				price: price,
				// Unité proposée par défaut dans les recettes (chaque recette peut en choisir une autre)
				unit: unit ? unit.abbreviation || unit.name : '',
				...(unit ? { defaultUnitId: unit.id } : {}),
				createdAt: new Date(),
			});

			await updateDoc(docRef, {
				ingredientId: docRef.id,
			});

			const newIngredient = {
				id: docRef.id,
				name: name.trim(),
				price,
				unit: unit ? unit.abbreviation || unit.name : '',
				defaultUnitId: unit?.id,
			};

			showToast({
				severity: 'success',
				summary: toastMessages.success.default,
				detail: toastMessages.success.create
			});

			setName('');
			setPrice(null);
			setUnit(null);
			onHide();

			if (onIngredientCreated) onIngredientCreated(newIngredient);

		} catch (error) {
			console.error('Error creating ingredient:', error);
			showToast({
				severity: 'error',
				summary: toastMessages.error.default,
				detail: toastMessages.error.create
			});
		} finally {
			setLoading(false);
		}
  };

	useEffect(() => {
		if (visible) {
			// Bloque le scroll du body
			document.body.style.overflow = 'hidden';
		} else {
			// Rétablit le scroll quand la modale est fermée
			document.body.style.overflow = '';
		}

		// Nettoyage au démontage du composant
		return () => {
			document.body.style.overflow = '';
		};
	}, [visible]);

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
		<Dialog
			header="Ajouter un ingrédient"
			visible={visible}
			onHide={onHide}
			footer={dialogFooter}
			modal
			className="add-ingredient-dialog"
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
					placeholder="Entrez le nom de l'ingrédient"
					className={formErrors.name ? 'p-invalid' : ''}
					/>
				</span>
				{formErrors.name && <small className="p-error">{formErrors.name}</small>}
			</div>

			<div className="form-row">
				<div className="form-field">
					<label htmlFor="price">Prix</label>
					<InputNumber
						id="price"
						value={price}
						onValueChange={(e) => setPrice(e.value || null)}
						mode="currency"
						currency="EUR"
						locale="fr-FR"
						placeholder="0,00 €"
						minFractionDigits={2}
					/>
				</div>

				<div className="form-field">
					<label htmlFor="unit">
					Unité par défaut <small>(facultatif)</small>
					</label>
					<Dropdown
						id="unit"
						value={unit}
						options={units}
						onChange={(e) => {
							setUnit(e.value);
							setFormErrors({ ...formErrors, unit: undefined });
						}}
						optionLabel="label"
						dataKey="id"
						placeholder="Proposée par défaut dans les recettes"
						className={formErrors.unit ? 'p-invalid' : ''}
						filter
						emptyFilterMessage={
							<div
								className="create-unit-option"
								onClick={() => setShowAddUnitDialog(true)}
								style={{
									cursor: 'pointer',
									color: 'var(--primary-color)',
									padding: '0.5rem 1rem',
									textAlign: 'center',
								}}
							>
								➕ Créer une nouvelle unité
							</div>
							}
					/>
					{formErrors.unit && <small className="p-error">{formErrors.unit}</small>}
				</div>
			</div>
		</div>
		<AddUnitForm
			visible={showAddUnitDialog}
			onHide={() => setShowAddUnitDialog(false)}
			onUnitCreated={(newUnit) => {
				reloadUnits(); // recharge le catalogue (la nouvelle unité y figure)
				setUnit(newUnit); // la sélectionne automatiquement
				setShowAddUnitDialog(false);
			}}
			initialName={name}
		/>
		</Dialog>
	);
};

export default AddIngredientForm;
