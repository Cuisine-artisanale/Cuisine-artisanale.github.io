"use client";
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import './AddRecetteForm.css';
import Breadcrumb from '@/components/layout/Breadcrumb/Breadcrumb';
import { Button } from 'primereact/button';

import { db } from '@/lib/config/firebase';
import { storage } from '@/lib/config/firebase-storage';
import { collection, addDoc, updateDoc, getDocs } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { compressImage } from '@/lib/utils/image';
import { slugify } from '@/lib/utils/slug';
import { formatIngredientName, ingredientNameKey } from '@/lib/utils/ingredient-name';
import { DEPARTEMENTS } from '@/constants/departements';
import { useUnits } from '@/hooks/useUnits';
import type { UnitDef } from '@/lib/utils/units';
import type { ImportDraft } from '@/types/import.types';
import TikTokImportReview from '@/components/features/TikTokImportReview/TikTokImportReview';
import IngredientListEditor, { type CatalogIngredient, type EditableIngredient } from '@/components/features/IngredientListEditor/IngredientListEditor';
import StepListEditor from '@/components/features/StepListEditor/StepListEditor';
import AddUnitForm from '@/components/features/AddUnitForm/AddUnitForm';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { toast } from 'react-toastify';

/** Partie d'une recette (pâte, garniture, glaçage…) telle que saisie dans le formulaire */
interface RecipePartForm {
	title: string;
	ingredients: EditableIngredient[];
	steps: string[];
}

const RECIPE_TYPES = ['Entrée', 'Plat', 'Dessert', 'Boisson'];
const MAX_IMAGES = 6;

const emptyPart = (): RecipePartForm => ({
	title: '',
	ingredients: [{ name: '', quantity: '', unit: '' }],
	steps: [''],
});

function isValidVideoUrl(url: string) {
	return /^(https?:\/\/)?(www\.)?(tiktok\.com|vm\.tiktok\.com|instagram\.com|youtu\.be|youtube\.com|facebook\.com)\/.+$/i.test(url);
}

function isValidTikTokUrl(url: string) {
	return /^(https?:\/\/)?(www\.)?(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)\/.+$/i.test(url);
}

/** Durée ou nombre saisi dans un champ numérique : entier positif, ou null si vide. */
function toPositiveInt(value: string, max: number): number | null {
	const n = Math.round(Number(value));
	return value.trim() !== '' && Number.isFinite(n) && n >= 0 ? Math.min(max, n) : null;
}

const AddRecetteForm: React.FC = () => {
	const { user } = useAuth();
	const { units: allUnits, reload: reloadUnits } = useUnits();

	// ---- Mode de saisie ----
	const [mode, setMode] = useState<'manual' | 'tiktok'>('manual');

	// ---- La recette ----
	const [title, setTitle] = useState('');
	const [type, setType] = useState('');
	const [preparationTime, setPreparationTime] = useState<number | null>(null);
	const [cookingTime, setCookingTime] = useState<number | null>(null);
	const [servings, setServings] = useState<number | null>(4);
	const [position, setPosition] = useState('none');
	const [video, setVideo] = useState('');
	const [showMore, setShowMore] = useState(false);
	const [parts, setParts] = useState<RecipePartForm[]>([emptyPart()]);

	// ---- Photos ----
	const [imageURLs, setImageURLs] = useState<string[]>([]);
	const [uploading, setUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// ---- Catalogues ----
	const [catalog, setCatalog] = useState<CatalogIngredient[]>([]);
	// Ligne d'ingrédient pour laquelle on crée une unité (sélectionnée une fois créée)
	const [unitTarget, setUnitTarget] = useState<{ partIndex: number; index: number } | null>(null);

	const [submitting, setSubmitting] = useState(false);

	// ---- Import TikTok ----
	const [tiktokImportUrl, setTiktokImportUrl] = useState('');
	const [tiktokImportContext, setTiktokImportContext] = useState('');
	const [tiktokImporting, setTiktokImporting] = useState(false);
	const [tiktokDraft, setTiktokDraft] = useState<ImportDraft | null>(null);
	const [tiktokSaving, setTiktokSaving] = useState(false);

	useEffect(() => {
		// Ingrédients déjà connus du site, proposés pendant la saisie
		getDocs(collection(db, 'ingredients'))
			.then((snapshot) =>
				setCatalog(
					snapshot.docs.map((d) => {
						const data = d.data();
						return { id: d.id, name: data.name, unit: data.unit || '', ...(data.defaultUnitId ? { defaultUnitId: data.defaultUnitId } : {}) };
					})
				)
			)
			.catch((error) => console.error('Catalogue des ingrédients indisponible :', error));
	}, []);

	const updatePart = (partIndex: number, changes: Partial<RecipePartForm>) =>
		setParts((current) => current.map((part, i) => (i === partIndex ? { ...part, ...changes } : part)));

	const handleUnitCreated = (unit: UnitDef) => {
		reloadUnits();
		if (unitTarget) {
			const { partIndex, index } = unitTarget;
			updatePart(partIndex, {
				ingredients: parts[partIndex].ingredients.map((ingredient, i) =>
					i === index ? { ...ingredient, unit: unit.abbreviation || unit.name, unitId: unit.id } : ingredient
				),
			});
		}
		setUnitTarget(null);
	};

	// ---- Ce qui manque avant l'envoi ----
	const filledParts = parts
		.map((part) => ({
			title: part.title.trim(),
			ingredients: part.ingredients.filter((ingredient) => ingredient.name.trim()),
			steps: part.steps.map((step) => step.trim()).filter(Boolean),
		}))
		.filter((part) => part.ingredients.length > 0 || part.steps.length > 0);

	const missing: string[] = [];
	if (title.trim().length < 3) missing.push('le titre');
	if (!type) missing.push('le type de plat');
	if (!filledParts.some((part) => part.ingredients.length > 0)) missing.push('au moins un ingrédient');
	if (!filledParts.some((part) => part.steps.length > 0)) missing.push('au moins une étape');
	const videoInvalid = Boolean(video.trim()) && !isValidVideoUrl(video.trim());

	// ---- Photos : envoyées dès leur sélection ----
	const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(event.target.files || []).slice(0, MAX_IMAGES - imageURLs.length);
		event.target.value = '';
		if (files.length === 0) return;
		if (!user) {
			toast.error('Connectez-vous pour ajouter des photos.');
			return;
		}

		setUploading(true);
		try {
			const folder = title.trim() || 'sans-titre';
			for (const original of files) {
				const image = await compressImage(original);
				// Préfixe horodaté : évite d'écraser l'image d'une autre recette portant le même nom
				const storageRef = ref(storage, `recipes/${folder}/${Date.now()}_${image.name}`);
				const task = uploadBytesResumable(storageRef, image);
				await new Promise<void>((resolve, reject) => task.on('state_changed', null, reject, () => resolve()));
				const url = await getDownloadURL(task.snapshot.ref);
				setImageURLs((current) => [...current, url]);
			}
		} catch (error) {
			console.error('Envoi de photo impossible :', error);
			toast.error("Une photo n'a pas pu être envoyée. Réessayez.");
		} finally {
			setUploading(false);
		}
	};

	// ---- Envoi en modération ----
	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (submitting || uploading) return;

		if (!user) {
			toast.error('Connectez-vous pour proposer une recette.');
			return;
		}
		if (missing.length > 0) {
			toast.error(`Il manque : ${missing.join(', ')}.`);
			return;
		}
		if (videoInvalid) {
			toast.error('Le lien vidéo doit venir de TikTok, Instagram, YouTube ou Facebook.');
			setShowMore(true);
			return;
		}

		const recipeTitle = title.trim().charAt(0).toUpperCase() + title.trim().slice(1);
		const catalogByKey = new Map(catalog.map((item) => [ingredientNameKey(item.name), item] as const));
		let position_ = 0;
		const recipeParts = filledParts.map((part, partIndex) => ({
			// Recette en une seule partie : elle porte le titre de la recette
			title: filledParts.length === 1 ? recipeTitle : part.title || `Partie ${partIndex + 1}`,
			steps: part.steps,
			ingredients: part.ingredients.map((ingredient) => {
				position_ += 1;
				const name = formatIngredientName(ingredient.name) || ingredient.name.trim();
				const known = catalogByKey.get(ingredientNameKey(name));
				return {
					// Fiche du catalogue si elle existe ; sinon id libre, la fiche étant créée
					// quand un admin valide la recette (syncRecipeIngredientsWithCatalog)
					id: known?.id || `${slugify(name) || 'ingredient'}-${position_}`,
					name: known?.name || name,
					quantity: ingredient.quantity.trim(),
					unit: ingredient.unit,
					...(ingredient.unitId ? { unitId: ingredient.unitId } : {}),
				};
			}),
		}));

		setSubmitting(true);
		try {
			// Création puis remplissage : c'est le passage d'un titre vide à un titre renseigné qui
			// déclenche l'email d'alerte à l'admin (Cloud Function sendEmailOnNewRecipeRequest).
			// Les règles Firestore exigent que la demande soit créée au nom de son auteur.
			const requestRef = await addDoc(collection(db, 'recipesRequest'), {
				title: '',
				type: '',
				preparationTime: '',
				cookingTime: '',
				video: '',
				images: [],
				recipeParts: [],
				position: '',
				createdBy: user.uid,
				titleKeywords: [],
				url: '',
			});

			await updateDoc(requestRef, {
				title: recipeTitle,
				type,
				preparationTime: preparationTime ?? 0,
				cookingTime: cookingTime ?? 0,
				...(servings && servings > 0 ? { servings } : {}),
				video: video.trim(),
				id: requestRef.id,
				createdAt: new Date(),
				recipeParts,
				position: position || 'none',
				createdBy: user.uid,
				images: imageURLs,
				titleKeywords: recipeTitle.toLowerCase().split(' '),
				url: slugify(recipeTitle),
			});

			toast.success('Recette envoyée ! Elle sera publiée après vérification.');
			window.history.back();
		} catch (error) {
			console.error('Envoi de la recette impossible :', error);
			toast.error("La recette n'a pas pu être envoyée. Réessayez.");
		} finally {
			setSubmitting(false);
		}
	};

	// ---- Import TikTok : analyse de la vidéo, puis relecture (TikTokImportReview) ----
	const handleImportTikTokByUrl = async () => {
		if (!user) {
			toast.error('Connectez-vous pour importer une vidéo TikTok.');
			return;
		}

		const trimmedUrl = tiktokImportUrl.trim();
		if (!trimmedUrl || !isValidTikTokUrl(trimmedUrl)) {
			toast.error('Saisissez un lien TikTok valide.');
			return;
		}

		try {
			setTiktokImporting(true);
			const idToken = await user.getIdToken();
			const response = await fetch('/api/tiktok/import-url', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
				body: JSON.stringify({ videoUrl: trimmedUrl, supplementalText: tiktokImportContext.trim() }),
			});

			const data = await response.json();
			if (!response.ok || !data?.success || !data.draft) {
				throw new Error(data?.error || "Erreur lors de l'analyse de la vidéo TikTok.");
			}

			setTiktokDraft(data.draft as ImportDraft);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Erreur lors de l'analyse de la vidéo TikTok.");
		} finally {
			setTiktokImporting(false);
		}
	};

	const handleSaveTikTokDraft = async (draft: ImportDraft) => {
		if (!user) return;

		try {
			setTiktokSaving(true);
			const idToken = await user.getIdToken();
			const response = await fetch('/api/tiktok/import-save', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
				body: JSON.stringify({ draft }),
			});

			const data = await response.json();
			if (!response.ok || !data?.success) {
				throw new Error(data?.error || "Erreur lors de l'enregistrement de la recette.");
			}

			if (data.duplicate) {
				toast.info('Cette vidéo TikTok a déjà été importée.');
			} else {
				toast.success('Recette envoyée ! Elle sera publiée après vérification.');
			}
			setTiktokDraft(null);
			setTiktokImportUrl('');
			setTiktokImportContext('');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Erreur lors de l'enregistrement de la recette.");
		} finally {
			setTiktokSaving(false);
		}
	};

	const severalParts = parts.length > 1;

	return (
		<div className="add-recipe-container">
			<Breadcrumb />
			<header className="add-recipe-header">
				<h1>Proposer une recette</h1>
				<p className="subtitle">Elle sera publiée après vérification par notre équipe.</p>
			</header>

			{!user && (
				<p className="add-recipe-login" role="status">
					<span className="pi pi-info-circle" aria-hidden="true"></span>
					<span><Link href="/login">Connectez-vous</Link> pour envoyer votre recette.</span>
				</p>
			)}

			<div className="add-recipe-modes" role="tablist" aria-label="Façon de proposer la recette">
				<button
					type="button"
					role="tab"
					aria-selected={mode === 'manual'}
					className={`add-recipe-mode${mode === 'manual' ? ' is-active' : ''}`}
					onClick={() => setMode('manual')}
				>
					<span className="pi pi-pencil" aria-hidden="true"></span>
					Écrire la recette
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={mode === 'tiktok'}
					className={`add-recipe-mode${mode === 'tiktok' ? ' is-active' : ''}`}
					onClick={() => setMode('tiktok')}
				>
					<span className="pi pi-video" aria-hidden="true"></span>
					Importer depuis TikTok
				</button>
			</div>

			{mode === 'tiktok' && (
				<section className="recipe-card tiktok-import-panel">
					<h2>Importer depuis TikTok</h2>
					<p className="recipe-card-help">
						Collez le lien d&apos;une vidéo : la recette est extraite de sa légende, puis vous la vérifiez avant l&apos;envoi.
					</p>
					<div className="tiktok-import-controls">
						<input
							type="url"
							className="recipe-input"
							value={tiktokImportUrl}
							onChange={(e) => setTiktokImportUrl(e.target.value)}
							placeholder="https://www.tiktok.com/@compte/video/…"
							aria-label="Lien de la vidéo TikTok"
							disabled={tiktokImporting}
						/>
						<Button
							type="button"
							label={tiktokImporting ? 'Analyse…' : 'Analyser la vidéo'}
							icon="pi pi-search"
							loading={tiktokImporting}
							onClick={handleImportTikTokByUrl}
							disabled={tiktokImporting}
						/>
					</div>
					<label className="recipe-field">
						<span>Texte de la recette (facultatif)</span>
						<textarea
							className="recipe-input"
							value={tiktokImportContext}
							onChange={(e) => setTiktokImportContext(e.target.value)}
							placeholder={"Ingrédients :\n- 2 œufs\n- 150 g de farine\nPréparation :\n1. Mélanger…"}
							rows={4}
							disabled={tiktokImporting}
							maxLength={3000}
						/>
						<small>
							À remplir si la recette n&apos;est pas écrite dans la légende de la vidéo (recette dictée, ou en commentaire).
						</small>
					</label>
				</section>
			)}

			{tiktokDraft && (
				<TikTokImportReview
					key={tiktokDraft.sourceVideoId}
					draft={tiktokDraft}
					catalog={catalog}
					units={allUnits}
					submitting={tiktokSaving}
					onCancel={() => setTiktokDraft(null)}
					onSubmit={handleSaveTikTokDraft}
				/>
			)}

			{mode === 'manual' && (
				<form onSubmit={handleSubmit} className="recipe-form" noValidate>
					<AddUnitForm visible={unitTarget !== null} onHide={() => setUnitTarget(null)} onUnitCreated={handleUnitCreated} />

					{/* ---- La recette ---- */}
					<section className="recipe-card">
						<h2>La recette</h2>
						<label className="recipe-field">
							<span>Titre *</span>
							<input
								type="text"
								className="recipe-input recipe-input-title"
								value={title}
								maxLength={100}
								placeholder="Tarte aux pommes de grand-mère"
								onChange={(e) => setTitle(e.target.value)}
							/>
						</label>

						<div className="recipe-grid">
							<label className="recipe-field">
								<span>Type de plat *</span>
								<select className="recipe-input" value={type} onChange={(e) => setType(e.target.value)}>
									<option value="">Choisir…</option>
									{RECIPE_TYPES.map((name) => <option key={name} value={name}>{name}</option>)}
								</select>
							</label>
							<label className="recipe-field">
								<span>Préparation (min)</span>
								<input
									type="number"
									className="recipe-input"
									min={0}
									max={1440}
									inputMode="numeric"
									value={preparationTime ?? ''}
									onChange={(e) => setPreparationTime(toPositiveInt(e.target.value, 1440))}
								/>
							</label>
							<label className="recipe-field">
								<span>Cuisson (min)</span>
								<input
									type="number"
									className="recipe-input"
									min={0}
									max={1440}
									inputMode="numeric"
									value={cookingTime ?? ''}
									onChange={(e) => setCookingTime(toPositiveInt(e.target.value, 1440))}
								/>
							</label>
							<label className="recipe-field">
								<span>Personnes</span>
								<input
									type="number"
									className="recipe-input"
									min={1}
									max={50}
									inputMode="numeric"
									value={servings ?? ''}
									onChange={(e) => setServings(toPositiveInt(e.target.value, 50) || null)}
								/>
							</label>
						</div>

						{showMore ? (
							<div className="recipe-grid recipe-grid-wide">
								<label className="recipe-field">
									<span>Département d&apos;origine</span>
									<select className="recipe-input" value={position} onChange={(e) => setPosition(e.target.value)}>
										<option value="none">Aucun département</option>
										{DEPARTEMENTS.map((departement) => (
											<option key={departement.code} value={departement.code}>{departement.nom}</option>
										))}
									</select>
								</label>
								<label className="recipe-field">
									<span>Lien vidéo</span>
									<input
										type="url"
										className="recipe-input"
										value={video}
										placeholder="TikTok, Instagram, YouTube…"
										aria-invalid={videoInvalid}
										onChange={(e) => setVideo(e.target.value)}
									/>
									{videoInvalid && <small className="recipe-error">Lien TikTok, Instagram, YouTube ou Facebook attendu.</small>}
								</label>
							</div>
						) : (
							<button type="button" className="recipe-link-button" onClick={() => setShowMore(true)}>
								<span className="pi pi-plus" aria-hidden="true"></span> Département d&apos;origine, lien vidéo
							</button>
						)}
					</section>

					{/* ---- Ingrédients et étapes, par partie ---- */}
					{parts.map((part, partIndex) => (
						<section key={partIndex} className="recipe-card recipe-part">
							{severalParts && (
								<div className="recipe-part-header">
									<input
										type="text"
										className="recipe-input recipe-part-title"
										value={part.title}
										maxLength={60}
										placeholder={`Nom de la partie ${partIndex + 1} (pâte, garniture…)`}
										aria-label={`Nom de la partie ${partIndex + 1}`}
										onChange={(e) => updatePart(partIndex, { title: e.target.value })}
									/>
									<button
										type="button"
										className="recipe-icon-button"
										aria-label={`Supprimer la partie ${part.title || partIndex + 1}`}
										onClick={() => setParts((current) => current.filter((_, i) => i !== partIndex))}
									>
										<span className="pi pi-trash" aria-hidden="true"></span>
									</button>
								</div>
							)}
							<div className="recipe-part-columns">
								<div>
									<h2>Ingrédients{!severalParts && ' *'}</h2>
									<IngredientListEditor
										ingredients={part.ingredients}
										onChange={(ingredients) => updatePart(partIndex, { ingredients })}
										catalog={catalog}
										units={allUnits}
										onCreateUnit={(index) => setUnitTarget({ partIndex, index })}
									/>
								</div>
								<div>
									<h2>Étapes{!severalParts && ' *'}</h2>
									<StepListEditor steps={part.steps} onChange={(steps) => updatePart(partIndex, { steps })} />
								</div>
							</div>
						</section>
					))}

					<button type="button" className="recipe-add-part" onClick={() => setParts((current) => [...current, emptyPart()])}>
						<span className="pi pi-plus" aria-hidden="true"></span>
						{severalParts ? 'Ajouter une partie' : 'Recette en plusieurs parties ? Ajouter une partie (pâte, garniture, glaçage…)'}
					</button>

					{/* ---- Photos ---- */}
					<section className="recipe-card">
						<h2>Photos</h2>
						<div className="recipe-photos">
							{imageURLs.map((url, index) => (
								<div key={url} className="recipe-photo">
									{/* eslint-disable-next-line @next/next/no-img-element -- simple aperçu d'une photo tout juste envoyée */}
									<img src={url} alt={`Photo ${index + 1}`} />
									<button
										type="button"
										className="recipe-photo-remove"
										aria-label={`Retirer la photo ${index + 1}`}
										onClick={() => setImageURLs((current) => current.filter((item) => item !== url))}
									>
										<span className="pi pi-times" aria-hidden="true"></span>
									</button>
								</div>
							))}
							{imageURLs.length < MAX_IMAGES && (
								<button type="button" className="recipe-photo-add" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
									<span className={`pi ${uploading ? 'pi-spin pi-spinner' : 'pi-camera'}`} aria-hidden="true"></span>
									{uploading ? 'Envoi…' : 'Ajouter'}
								</button>
							)}
						</div>
						<input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
						<small className="recipe-card-help">Jusqu&apos;à {MAX_IMAGES} photos. La première sert d&apos;image principale.</small>
					</section>

					{/* ---- Envoi ---- */}
					<footer className="recipe-submit-bar">
						<p className="recipe-submit-status" aria-live="polite">
							{missing.length > 0 ? (
								<>Il manque : {missing.join(', ')}.</>
							) : (
								<><span className="pi pi-check-circle" aria-hidden="true"></span> Prête à être envoyée.</>
							)}
						</p>
						<div className="recipe-submit-actions">
							<button type="button" className="recipe-link-button" onClick={() => window.history.back()}>Annuler</button>
							<Button
								type="submit"
								label={submitting ? 'Envoi…' : uploading ? 'Envoi des photos…' : 'Envoyer la recette'}
								icon="pi pi-send"
								loading={submitting}
								disabled={submitting || uploading}
							/>
						</div>
					</footer>
				</form>
			)}
		</div>
	);
};

export default AddRecetteForm;
