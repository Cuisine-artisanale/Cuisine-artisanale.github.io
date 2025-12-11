import React, { useEffect, useState } from 'react';
import './AddIngredientForm.css';

import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { Dialog } from 'primereact/dialog';
import { addDoc, collection, getDocs, query, updateDoc } from '@firebase/firestore';
import { db } from '@/lib/config/firebase';
import { toastMessages } from '@/lib/utils/toast';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import { AddUnitForm } from '@/components/features';
import type { Unit } from '@/types';

interface AddIngredientFormProps {
  visible: boolean;
  onHide: () => void;
  initialName?: string;
  onIngredientCreated?: (ingredientId: any) => void;
}

const AddIngredientForm: React.FC<AddIngredientFormProps> = ({ visible, onHide, initialName, onIngredientCreated }) => {
	const [name, setName] = useState('');
	const [price, setPrice] = useState<number | null>(0);
	const [unit, setUnit] = useState<Unit | null>(null);
	const [units, setUnits] = useState<Unit[]>([]);
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
			fetchUnits();
		}
	}, [visible, initialName]);

  	const validateForm = () => {
		const errors: { name?: string; unit?: string; category?: string } = {};

		if (!name.trim()) {
			errors.name = 'Le nom est requis';
		}
		if (!unit) {
			errors.unit = 'L\'unité est requise';
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
				unit: unit?.abbreviation,
				createdAt: new Date(),
			});

			await updateDoc(docRef, {
				ingredientId: docRef.id,
			});

			const newIngredient = {
				id: docRef.id,
				name: name.trim(),
				price,
				unit: unit?.abbreviation,
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

  const fetchUnits = async () => {
	try {
	  const unitsQuery = query(collection(db, 'units'));
	  const querySnapshot = await getDocs(unitsQuery);
	  const unitsData = querySnapshot.docs.map((doc) => ({
		id: doc.id,
		...doc.data()
	  })) as Unit[];

	  setUnits(unitsData);
	} catch (error) {
	  console.error('Error fetching units:', error);
	  showToast({
		severity: 'error',
		summary: 'Erreur',
		detail: 'Impossible de charger les unités',
		life: 3000
	  });
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
					Unité <span className="required">*</span>
					</label>
					<Dropdown
						id="unit"
						value={unit}
						options={units}
						onChange={(e) => {
							setUnit(e.value);
							setFormErrors({ ...formErrors, unit: undefined });
						}}
						optionLabel="name"
						placeholder="Sélectionnez une unité"
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
				setUnits((prev) => [...prev, newUnit]); // ajoute la nouvelle unité à la liste
				setUnit(newUnit); // la sélectionne automatiquement
				setShowAddUnitDialog(false);
			}}
			initialName={name}
		/>
		</Dialog>
	);
};

export default AddIngredientForm;
