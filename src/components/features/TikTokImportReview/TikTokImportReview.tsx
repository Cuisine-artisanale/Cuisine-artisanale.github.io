"use client";
import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { selectableUnits, unitOptionLabel, type UnitDef } from '@/lib/utils/units';
import type { ImportDraft, ImportDraftIngredient } from '@/types/import.types';
import './TikTokImportReview.css';

const RECIPE_TYPES = ['Entrée', 'Plat', 'Dessert', 'Boisson'];

interface TikTokImportReviewProps {
	draft: ImportDraft;
	/** Catalogue d'unités (liste de choix) */
	units: UnitDef[];
	submitting: boolean;
	onCancel: () => void;
	onSubmit: (draft: ImportDraft) => void;
}

/**
 * Relecture d'une recette extraite d'une vidéo TikTok : l'utilisateur corrige le titre,
 * les ingrédients et les étapes avant l'envoi en modération.
 */
const TikTokImportReview: React.FC<TikTokImportReviewProps> = ({ draft: initialDraft, units, submitting, onCancel, onSubmit }) => {
	const [draft, setDraft] = useState<ImportDraft>(initialDraft);
	const unitOptions = selectableUnits(units);

	const update = (changes: Partial<ImportDraft>) => setDraft((current) => ({ ...current, ...changes }));

	const updateIngredient = (index: number, changes: Partial<ImportDraftIngredient>) =>
		update({ ingredients: draft.ingredients.map((ingredient, i) => (i === index ? { ...ingredient, ...changes } : ingredient)) });

	const changeUnit = (index: number, value: string) => {
		const unit = unitOptions.find((u) => u.id === value);
		const { unitId: _previous, ...ingredient } = draft.ingredients[index];
		void _previous;
		update({
			ingredients: draft.ingredients.map((current, i) =>
				i === index ? { ...ingredient, unit: unit ? unit.abbreviation || unit.name : '', ...(unit ? { unitId: unit.id } : {}) } : current
			),
		});
	};

	const updateStep = (index: number, value: string) =>
		update({ steps: draft.steps.map((step, i) => (i === index ? value : step)) });

	const moveStep = (index: number, delta: number) => {
		const target = index + delta;
		if (target < 0 || target >= draft.steps.length) return;
		const steps = [...draft.steps];
		[steps[index], steps[target]] = [steps[target], steps[index]];
		update({ steps });
	};

	const titleMissing = draft.title.trim().length < 3;
	const namedIngredients = draft.ingredients.filter((ingredient) => ingredient.name.trim());
	const writtenSteps = draft.steps.filter((step) => step.trim());

	const submit = () => {
		if (titleMissing) return;
		onSubmit({
			...draft,
			title: draft.title.trim(),
			ingredients: namedIngredients,
			steps: writtenSteps,
		});
	};

	return (
		<Dialog
			header="Vérifier la recette importée"
			visible
			onHide={() => { if (!submitting) onCancel(); }}
			className="tiktok-review-dialog"
			style={{ width: '95vw', maxWidth: '760px' }}
			dismissableMask={false}
			footer={
				<div className="tiktok-review-footer">
					<Button type="button" label="Annuler" icon="pi pi-times" className="p-button-text" onClick={onCancel} disabled={submitting} />
					<Button
						type="button"
						label={submitting ? 'Envoi…' : 'Envoyer en modération'}
						icon="pi pi-send"
						onClick={submit}
						disabled={submitting || titleMissing}
						loading={submitting}
					/>
				</div>
			}
		>
			<div className="tiktok-review">
				<p className="tiktok-review-intro">
					{draft.aiUsed
						? "La recette a été extraite automatiquement de la vidéo. Corrigez ce qui doit l'être avant l'envoi."
						: "La recette a été lue dans la légende de la vidéo, sans assistance : vérifiez et complétez-la avant l'envoi."}
				</p>

				<div className="tiktok-review-source">
					{draft.thumbnailUrl && (
						// eslint-disable-next-line @next/next/no-img-element -- miniature TikTok temporaire, simple aperçu
						<img src={draft.thumbnailUrl} alt="" className="tiktok-review-thumbnail" />
					)}
					<div className="tiktok-review-main-fields">
						<label className="tiktok-review-field">
							<span>Titre *</span>
							<input
								type="text"
								value={draft.title}
								maxLength={100}
								onChange={(e) => update({ title: e.target.value })}
								aria-invalid={titleMissing}
							/>
						</label>
						{draft.author && <p className="tiktok-review-author">Vidéo de {draft.author}</p>}
					</div>
				</div>

				<div className="tiktok-review-grid">
					<label className="tiktok-review-field">
						<span>Type</span>
						<select value={draft.type} onChange={(e) => update({ type: e.target.value })}>
							{RECIPE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
						</select>
					</label>
					<label className="tiktok-review-field">
						<span>Préparation (min)</span>
						<input
							type="number"
							min={0}
							max={1440}
							inputMode="numeric"
							value={draft.preparationTime || ''}
							onChange={(e) => update({ preparationTime: Math.max(0, Number(e.target.value) || 0) })}
						/>
					</label>
					<label className="tiktok-review-field">
						<span>Cuisson (min)</span>
						<input
							type="number"
							min={0}
							max={1440}
							inputMode="numeric"
							value={draft.cookingTime || ''}
							onChange={(e) => update({ cookingTime: Math.max(0, Number(e.target.value) || 0) })}
						/>
					</label>
					<label className="tiktok-review-field">
						<span>Personnes</span>
						<input
							type="number"
							min={1}
							max={50}
							inputMode="numeric"
							value={draft.servings ?? ''}
							onChange={(e) => update({ servings: Number(e.target.value) >= 1 ? Math.min(50, Math.round(Number(e.target.value))) : null })}
						/>
					</label>
				</div>

				<section className="tiktok-review-section">
					<h3>Ingrédients ({namedIngredients.length})</h3>
					{draft.ingredients.length === 0 && (
						<p className="tiktok-review-empty">Aucun ingrédient trouvé dans la vidéo : ajoutez-les ci-dessous.</p>
					)}
					<ul className="tiktok-review-ingredients">
						{draft.ingredients.map((ingredient, index) => (
							<li key={index}>
								<input
									type="text"
									className="tiktok-review-quantity"
									value={ingredient.quantity}
									maxLength={20}
									placeholder="Qté"
									aria-label={`Quantité de l'ingrédient ${index + 1}`}
									onChange={(e) => updateIngredient(index, { quantity: e.target.value })}
								/>
								<select
									className="tiktok-review-unit"
									value={ingredient.unitId || (ingredient.unit ? '__custom' : '')}
									aria-label={`Unité de l'ingrédient ${index + 1}`}
									onChange={(e) => changeUnit(index, e.target.value)}
								>
									<option value="">Sans unité</option>
									{/* Unité lue dans la vidéo mais absente du catalogue : conservée telle quelle */}
									{!ingredient.unitId && ingredient.unit && <option value="__custom">{ingredient.unit}</option>}
									{unitOptions.map((unit) => <option key={unit.id} value={unit.id}>{unitOptionLabel(unit)}</option>)}
								</select>
								<input
									type="text"
									className="tiktok-review-name"
									value={ingredient.name}
									maxLength={80}
									placeholder="Ingrédient"
									aria-label={`Nom de l'ingrédient ${index + 1}`}
									onChange={(e) => updateIngredient(index, { name: e.target.value })}
								/>
								<button
									type="button"
									className="tiktok-review-icon"
									aria-label={`Retirer l'ingrédient ${ingredient.name || index + 1}`}
									onClick={() => update({ ingredients: draft.ingredients.filter((_, i) => i !== index) })}
								>
									<span className="pi pi-trash" aria-hidden="true"></span>
								</button>
							</li>
						))}
					</ul>
					<button
						type="button"
						className="tiktok-review-add"
						onClick={() => update({ ingredients: [...draft.ingredients, { name: '', quantity: '', unit: '' }] })}
						disabled={draft.ingredients.length >= 40}
					>
						<span className="pi pi-plus" aria-hidden="true"></span> Ajouter un ingrédient
					</button>
				</section>

				<section className="tiktok-review-section">
					<h3>Étapes ({writtenSteps.length})</h3>
					<ol className="tiktok-review-steps">
						{draft.steps.map((step, index) => (
							<li key={index}>
								<span className="tiktok-review-step-number">{index + 1}</span>
								<textarea
									value={step}
									rows={2}
									maxLength={1000}
									aria-label={`Étape ${index + 1}`}
									onChange={(e) => updateStep(index, e.target.value)}
								/>
								<div className="tiktok-review-step-actions">
									<button type="button" className="tiktok-review-icon" aria-label={`Monter l'étape ${index + 1}`} onClick={() => moveStep(index, -1)} disabled={index === 0}>
										<span className="pi pi-arrow-up" aria-hidden="true"></span>
									</button>
									<button type="button" className="tiktok-review-icon" aria-label={`Descendre l'étape ${index + 1}`} onClick={() => moveStep(index, 1)} disabled={index === draft.steps.length - 1}>
										<span className="pi pi-arrow-down" aria-hidden="true"></span>
									</button>
									<button type="button" className="tiktok-review-icon" aria-label={`Supprimer l'étape ${index + 1}`} onClick={() => update({ steps: draft.steps.filter((_, i) => i !== index) })}>
										<span className="pi pi-trash" aria-hidden="true"></span>
									</button>
								</div>
							</li>
						))}
					</ol>
					<button
						type="button"
						className="tiktok-review-add"
						onClick={() => update({ steps: [...draft.steps, ''] })}
						disabled={draft.steps.length >= 30}
					>
						<span className="pi pi-plus" aria-hidden="true"></span> Ajouter une étape
					</button>
				</section>

				<p className="tiktok-review-note">
					La recette sera publiée après validation par un administrateur. Le département et les photos
					supplémentaires pourront être ajoutés ensuite.
				</p>
			</div>
		</Dialog>
	);
};

export default TikTokImportReview;
