"use client";
import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import type { UnitDef } from '@/lib/utils/units';
import IngredientListEditor, { type CatalogIngredient } from '@/components/features/IngredientListEditor/IngredientListEditor';
import StepListEditor from '@/components/features/StepListEditor/StepListEditor';
import type { ImportDraft } from '@/types/import.types';
import './TikTokImportReview.css';

const RECIPE_TYPES = ['Entrée', 'Plat', 'Dessert', 'Boisson'];

interface TikTokImportReviewProps {
	draft: ImportDraft;
	/** Ingrédients déjà connus du site, proposés pendant la saisie */
	catalog: CatalogIngredient[];
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
const TikTokImportReview: React.FC<TikTokImportReviewProps> = ({ draft: initialDraft, catalog, units, submitting, onCancel, onSubmit }) => {
	const [draft, setDraft] = useState<ImportDraft>(initialDraft);

	const update = (changes: Partial<ImportDraft>) => setDraft((current) => ({ ...current, ...changes }));

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
					<IngredientListEditor
						ingredients={draft.ingredients}
						onChange={(ingredients) => update({ ingredients })}
						catalog={catalog}
						units={units}
						emptyMessage="Aucun ingrédient trouvé dans la vidéo : ajoutez-les ci-dessous."
					/>
				</section>

				<section className="tiktok-review-section">
					<h3>Étapes ({writtenSteps.length})</h3>
					<StepListEditor steps={draft.steps} onChange={(steps) => update({ steps })} />
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
