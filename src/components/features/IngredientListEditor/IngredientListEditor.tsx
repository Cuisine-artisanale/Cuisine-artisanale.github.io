"use client";
import React, { useMemo, useRef, useState } from 'react';
import { buildUnitIndex, resolveUnit, selectableUnits, unitOptionLabel, type UnitDef } from '@/lib/utils/units';
import { ingredientNameKey as nameKey } from '@/lib/utils/ingredient-name';
import './IngredientListEditor.css';

/** Ingrédient en cours de saisie (formulaire de recette, relecture d'un import) */
export interface EditableIngredient {
	name: string;
	/** "250", "1/2", "2-3" ; vide si non précisée */
	quantity: string;
	/** Libellé de l'unité ("g", "c. à s.") ; vide si aucune */
	unit: string;
	/** Unité du catalogue, si elle a été reconnue ou choisie */
	unitId?: string;
}

/** Fiche du catalogue d'ingrédients, proposée pendant la saisie du nom */
export interface CatalogIngredient {
	id: string;
	name: string;
	/** Unité proposée par défaut sur la fiche */
	unit?: string;
	defaultUnitId?: string;
}

interface IngredientListEditorProps {
	ingredients: EditableIngredient[];
	onChange: (ingredients: EditableIngredient[]) => void;
	/** Ingrédients déjà connus du site, proposés pendant la saisie */
	catalog: CatalogIngredient[];
	/** Catalogue d'unités (liste de choix) */
	units: UnitDef[];
	/** Si fourni, la liste d'unités se termine par « Créer une unité… » */
	onCreateUnit?: (index: number) => void;
	/** Nombre maximum de lignes */
	max?: number;
	/** Message affiché quand la liste est vide */
	emptyMessage?: string;
}

const MAX_SUGGESTIONS = 6;
const CUSTOM_UNIT = '__custom';
const CREATE_UNIT = '__create';

/**
 * Liste d'ingrédients modifiable : quantité, unité et nom par ligne.
 * Le nom propose les ingrédients du catalogue au fil de la frappe ; un nom inconnu reste
 * accepté (sa fiche est créée quand un admin valide la recette).
 */
const IngredientListEditor: React.FC<IngredientListEditorProps> = ({
	ingredients,
	onChange,
	catalog,
	units,
	onCreateUnit,
	max = 40,
	emptyMessage,
}) => {
	const unitOptions = selectableUnits(units);
	// Ligne dont les suggestions sont affichées, et suggestion surlignée au clavier
	const [suggestFor, setSuggestFor] = useState<number | null>(null);
	const [highlighted, setHighlighted] = useState(0);
	const listRef = useRef<HTMLUListElement>(null);

	const catalogKeys = useMemo(() => catalog.map((item) => ({ item, key: nameKey(item.name) })), [catalog]);
	const knownKeys = useMemo(() => new Set(catalogKeys.map((entry) => entry.key)), [catalogKeys]);
	const unitIndex = useMemo(() => buildUnitIndex(units), [units]);

	const update = (index: number, changes: Partial<EditableIngredient>) =>
		onChange(ingredients.map((ingredient, i) => (i === index ? { ...ingredient, ...changes } : ingredient)));

	/** Ingrédients du catalogue correspondant à la saisie : ceux qui commencent par le texte d'abord. */
	const suggestionsFor = (text: string): CatalogIngredient[] => {
		const key = nameKey(text);
		if (key.length < 2) return [];
		const starts = catalogKeys.filter((entry) => entry.key.startsWith(key));
		const contains = catalogKeys.filter((entry) => !entry.key.startsWith(key) && entry.key.includes(key));
		return [...starts, ...contains]
			.filter((entry) => entry.item.name !== text.trim())
			.slice(0, MAX_SUGGESTIONS)
			.map((entry) => entry.item);
	};

	/** Reprend le nom exact de la fiche, et son unité par défaut si la ligne n'en a pas encore. */
	const chooseSuggestion = (index: number, suggestion: CatalogIngredient) => {
		const current = ingredients[index];
		const defaultUnit = !current.unit && !current.unitId ? resolveUnit(unitIndex, suggestion.defaultUnitId, suggestion.unit) : null;
		update(index, {
			name: suggestion.name,
			...(defaultUnit ? { unit: defaultUnit.abbreviation || defaultUnit.name, unitId: defaultUnit.id } : {}),
		});
		setSuggestFor(null);
	};

	const changeUnit = (index: number, value: string) => {
		if (value === CREATE_UNIT) {
			onCreateUnit?.(index);
			return;
		}
		const unit = unitOptions.find((u) => u.id === value);
		const next: EditableIngredient = {
			name: ingredients[index].name,
			quantity: ingredients[index].quantity,
			unit: unit ? unit.abbreviation || unit.name : '',
			...(unit ? { unitId: unit.id } : {}),
		};
		onChange(ingredients.map((ingredient, i) => (i === index ? next : ingredient)));
	};

	const focusRow = (index: number, field: 'quantity' | 'name') => {
		// Après le rendu de la nouvelle ligne
		setTimeout(() => {
			listRef.current?.querySelector<HTMLInputElement>(`:scope > li:nth-child(${index + 1}) .ingredient-editor-${field}`)?.focus();
		});
	};

	const addRow = (after = ingredients.length - 1) => {
		if (ingredients.length >= max) return;
		const next = [...ingredients];
		next.splice(after + 1, 0, { name: '', quantity: '', unit: '' });
		onChange(next);
		focusRow(after + 1, 'quantity');
	};

	const onNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, index: number, suggestions: CatalogIngredient[]) => {
		const open = suggestFor === index && suggestions.length > 0;
		if (event.key === 'ArrowDown' && open) {
			event.preventDefault();
			setHighlighted((value) => (value + 1) % suggestions.length);
		} else if (event.key === 'ArrowUp' && open) {
			event.preventDefault();
			setHighlighted((value) => (value - 1 + suggestions.length) % suggestions.length);
		} else if (event.key === 'Enter') {
			// Jamais d'envoi du formulaire depuis ce champ
			event.preventDefault();
			if (open && highlighted >= 0) {
				chooseSuggestion(index, suggestions[Math.min(highlighted, suggestions.length - 1)]);
			} else if (ingredients[index].name.trim()) {
				// Ligne terminée : on enchaîne sur la suivante
				addRow(index);
			}
		} else if (event.key === 'Escape' && open) {
			event.stopPropagation();
			setSuggestFor(null);
		}
	};

	return (
		<div className="ingredient-editor">
			{ingredients.length === 0 && emptyMessage && <p className="ingredient-editor-empty">{emptyMessage}</p>}
			<ul className="ingredient-editor-list" ref={listRef}>
				{ingredients.map((ingredient, index) => {
					const suggestions = suggestFor === index ? suggestionsFor(ingredient.name) : [];
					const isKnown = knownKeys.has(nameKey(ingredient.name));
					return (
						<li key={index}>
							<input
								type="text"
								className="ingredient-editor-quantity"
								value={ingredient.quantity}
								maxLength={20}
								placeholder="Qté"
								inputMode="decimal"
								aria-label={`Quantité de l'ingrédient ${index + 1}`}
								onChange={(e) => update(index, { quantity: e.target.value })}
								onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); focusRow(index, 'name'); } }}
							/>
							<select
								className="ingredient-editor-unit"
								value={ingredient.unitId || (ingredient.unit ? CUSTOM_UNIT : '')}
								aria-label={`Unité de l'ingrédient ${index + 1}`}
								onChange={(e) => changeUnit(index, e.target.value)}
							>
								<option value="">Sans unité</option>
								{/* Unité saisie ou lue ailleurs, absente du catalogue : conservée telle quelle */}
								{!ingredient.unitId && ingredient.unit && <option value={CUSTOM_UNIT}>{ingredient.unit}</option>}
								{unitOptions.map((unit) => <option key={unit.id} value={unit.id}>{unitOptionLabel(unit)}</option>)}
								{onCreateUnit && <option value={CREATE_UNIT}>Créer une unité…</option>}
							</select>
							<div className="ingredient-editor-name-wrapper">
								<input
									type="text"
									className="ingredient-editor-name"
									value={ingredient.name}
									maxLength={80}
									placeholder="Ingrédient"
									aria-label={`Nom de l'ingrédient ${index + 1}`}
									role="combobox"
									aria-expanded={suggestions.length > 0}
									aria-controls={`ingredient-editor-suggestions-${index}`}
									aria-autocomplete="list"
									autoComplete="off"
									onChange={(e) => {
										update(index, { name: e.target.value });
										setSuggestFor(index);
										setHighlighted(0);
									}}
									onFocus={() => { setSuggestFor(index); setHighlighted(0); }}
									// Délai : laisse le clic sur une suggestion s'enregistrer avant de fermer la liste
									onBlur={() => setTimeout(() => setSuggestFor((current) => (current === index ? null : current)), 150)}
									onKeyDown={(e) => onNameKeyDown(e, index, suggestions)}
								/>
								{ingredient.name.trim().length >= 2 && (
									<span
										className={`ingredient-editor-known${isKnown ? ' is-known' : ''}`}
										title={isKnown ? 'Ingrédient déjà connu du site' : 'Nouvel ingrédient'}
									>
										<span className={`pi ${isKnown ? 'pi-check-circle' : 'pi-plus-circle'}`} aria-hidden="true"></span>
										<span className="sr-only">{isKnown ? 'Ingrédient déjà connu du site' : 'Nouvel ingrédient'}</span>
									</span>
								)}
								{suggestions.length > 0 && (
									<ul className="ingredient-editor-suggestions" id={`ingredient-editor-suggestions-${index}`} role="listbox">
										{suggestions.map((suggestion, position) => (
											<li
												key={suggestion.id}
												role="option"
												aria-selected={position === highlighted}
												className={position === highlighted ? 'is-highlighted' : undefined}
												// mousedown : avant la perte de focus du champ
												onMouseDown={(e) => { e.preventDefault(); chooseSuggestion(index, suggestion); }}
											>
												{suggestion.name}
											</li>
										))}
									</ul>
								)}
							</div>
							<button
								type="button"
								className="ingredient-editor-icon"
								aria-label={`Retirer l'ingrédient ${ingredient.name || index + 1}`}
								onClick={() => onChange(ingredients.filter((_, i) => i !== index))}
							>
								<span className="pi pi-trash" aria-hidden="true"></span>
							</button>
						</li>
					);
				})}
			</ul>
			<button type="button" className="ingredient-editor-add" onClick={() => addRow()} disabled={ingredients.length >= max}>
				<span className="pi pi-plus" aria-hidden="true"></span> Ajouter un ingrédient
			</button>
			{ingredients.some((ingredient) => ingredient.name.trim().length >= 2) && (
				<p className="ingredient-editor-legend">
					<span className="pi pi-check-circle" aria-hidden="true"></span> déjà connu du site
					<span className="pi pi-plus-circle" aria-hidden="true"></span> nouvel ingrédient
				</p>
			)}
		</div>
	);
};

export default IngredientListEditor;
