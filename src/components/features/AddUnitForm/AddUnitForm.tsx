"use client";
import React, { useState, useEffect } from 'react';
import './AddUnitForm.css';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { toastMessages } from '@/lib/utils/toast';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { createUnit } from '@/lib/services/units.service';
import { UNIT_TYPE_BASE, UNIT_TYPE_LABELS, type UnitDef, type UnitType } from '@/lib/utils/units';

interface AddUnitFormProps {
	visible: boolean;
	onHide: () => void;
	/** Appelé avec l'unité créée, ou l'unité existante équivalente si elle existait déjà */
	onUnitCreated?: (unit: UnitDef) => void;
	initialName?: string;
}

const TYPE_OPTIONS = (Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((value) => ({
	value,
	label: UNIT_TYPE_LABELS[value],
}));

/**
 * Création d'une unité (ouverte à tous les utilisateurs connectés).
 * Si une unité équivalente existe déjà (même nom, pluriel ou abréviation, y compris
 * variantes comme « gr » ou « c.à.s »), elle est proposée au lieu de créer un doublon.
 */
const AddUnitForm: React.FC<AddUnitFormProps> = ({ visible, onHide, onUnitCreated, initialName }) => {
	const [name, setName] = useState('');
	const [plural, setPlural] = useState('');
	const [abbreviation, setAbbreviation] = useState('');
	const [type, setType] = useState<UnitType>('count');
	const [toBase, setToBase] = useState<number | null>(null);
	const [loading, setLoading] = useState(false);
	const [formErrors, setFormErrors] = useState<{ name?: string; abbreviation?: string; toBase?: string }>({});
	const { showToast } = useToast();
	const { user } = useAuth();

	useEffect(() => {
		if (visible) {
			setName(initialName || '');
			setPlural('');
			setAbbreviation('');
			setType('count');
			setToBase(null);
			setFormErrors({});
		}
	}, [visible, initialName]);

	const hasEquivalence = type === 'mass' || type === 'volume';

	const validateForm = () => {
		const errors: typeof formErrors = {};
		if (!name.trim()) errors.name = 'Le nom est requis';
		if (name.trim().length > 40) errors.name = '40 caractères maximum';
		if (abbreviation.trim().length > 10) errors.abbreviation = '10 caractères maximum';
		if (hasEquivalence && toBase !== null && toBase <= 0) errors.toBase = 'Valeur positive attendue';
		setFormErrors(errors);
		return Object.keys(errors).length === 0;
	};

	const handleSubmit = async (event: React.SyntheticEvent) => {
		event.preventDefault();
		event.stopPropagation();
		if (!validateForm()) return;

		setLoading(true);
		try {
			const { unit, existing } = await createUnit({
				name,
				plural: plural || undefined,
				abbreviation: abbreviation || undefined,
				type,
				toBase: hasEquivalence ? toBase : null,
				createdBy: user?.uid,
			});

			onUnitCreated?.(unit);
			showToast({
				severity: existing ? 'info' : 'success',
				summary: existing ? 'Unité existante' : toastMessages.success.default,
				detail: existing
					? `L'unité « ${unit.name} » existe déjà : elle a été sélectionnée.`
					: toastMessages.success.create,
			});
			onHide();
		} catch (error) {
			console.error('Error creating unit:', error);
			showToast({
				severity: 'error',
				summary: toastMessages.error.default,
				detail: toastMessages.error.create,
			});
		} finally {
			setLoading(false);
		}
	};

	const dialogFooter = (
		<div className="form-actions">
			<Button
				type="button"
				label="Ajouter"
				icon="pi pi-check"
				loading={loading}
				className="p-button-success"
				onClick={handleSubmit}
				disabled={!user}
			/>
			<Button type="button" label="Annuler" icon="pi pi-times" onClick={onHide} className="p-button-text" />
		</div>
	);

	return (
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
					<label htmlFor="unit-name">
						Nom (au singulier) <span className="required">*</span>
					</label>
					<InputText
						id="unit-name"
						value={name}
						onChange={(e) => {
							setName(e.target.value);
							setFormErrors({ ...formErrors, name: undefined });
						}}
						placeholder="ex. gousse, cuillère à soupe, sachet"
						className={formErrors.name ? 'p-invalid' : ''}
						maxLength={40}
					/>
					{formErrors.name && <small className="p-error">{formErrors.name}</small>}
				</div>

				<div className="form-field">
					<label htmlFor="unit-plural">Pluriel</label>
					<InputText
						id="unit-plural"
						value={plural}
						onChange={(e) => setPlural(e.target.value)}
						placeholder={name ? `ex. ${name.trim()}s` : 'ex. gousses'}
						maxLength={40}
					/>
					<small>Laisser vide si identique au singulier.</small>
				</div>

				<div className="form-field">
					<label htmlFor="unit-abbreviation">Abréviation</label>
					<InputText
						id="unit-abbreviation"
						value={abbreviation}
						onChange={(e) => {
							setAbbreviation(e.target.value);
							setFormErrors({ ...formErrors, abbreviation: undefined });
						}}
						placeholder="ex. g, c. à s. (facultatif)"
						className={formErrors.abbreviation ? 'p-invalid' : ''}
						maxLength={10}
					/>
					{formErrors.abbreviation && <small className="p-error">{formErrors.abbreviation}</small>}
					<small>Si renseignée, c'est elle qui s'affiche dans les recettes (« 2 c. à s. »).</small>
				</div>

				<div className="form-field">
					<label htmlFor="unit-type">
						Type <span className="required">*</span>
					</label>
					<Dropdown
						inputId="unit-type"
						value={type}
						options={TYPE_OPTIONS}
						optionLabel="label"
						optionValue="value"
						onChange={(e) => setType(e.value)}
					/>
				</div>

				{hasEquivalence && (
					<div className="form-field">
						<label htmlFor="unit-tobase">Équivalence</label>
						<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
							<span>1 {abbreviation || name || 'unité'} =</span>
							<InputNumber
								inputId="unit-tobase"
								value={toBase}
								onValueChange={(e) => setToBase(e.value ?? null)}
								min={0}
								maxFractionDigits={3}
								locale="fr-FR"
								placeholder="ex. 15"
							/>
							<span>{UNIT_TYPE_BASE[type]}</span>
						</div>
						{formErrors.toBase && <small className="p-error">{formErrors.toBase}</small>}
						<small>Permet d&apos;additionner et de convertir les quantités (facultatif).</small>
					</div>
				)}
			</div>
		</Dialog>
	);
};

export default AddUnitForm;
