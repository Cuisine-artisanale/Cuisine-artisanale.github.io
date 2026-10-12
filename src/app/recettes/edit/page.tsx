"use client";
import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, deleteField, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { storage } from '@/lib/config/firebase-storage';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { Button } from 'primereact/button';
import { toast } from 'react-toastify';
import { compressImage, isOptimizableImage } from '@/lib/utils/image';
import { slugify } from '@/lib/utils/slug';
import { formatIngredientName, ingredientNameKey } from '@/lib/utils/ingredient-name';
import { DEPARTEMENTS } from '@/constants/departements';
import Breadcrumb from '@/components/layout/Breadcrumb/Breadcrumb';
import type { Recipe } from '@/types/recipe.types';
import AddUnitForm from '@/components/features/AddUnitForm/AddUnitForm';
import IngredientListEditor, { type CatalogIngredient, type EditableIngredient } from '@/components/features/IngredientListEditor/IngredientListEditor';
import StepListEditor from '@/components/features/StepListEditor/StepListEditor';
import { syncRecipeIngredientsWithCatalog } from '@/lib/services/ingredient-catalog.service';
import { useUnits } from '@/hooks/useUnits';
import { revalidateRecipe } from '@/lib/utils/revalidate-recipe';
import type { UnitDef } from '@/lib/utils/units';
// Même mise en page que le formulaire « Proposer une recette »
import '@/components/features/AddRecetteForm/AddRecetteForm.css';

/** Partie d'une recette telle que saisie dans le formulaire */
interface RecipePartForm {
	title: string;
	ingredients: EditableIngredient[];
	steps: string[];
}

const RECIPE_TYPES = ['Entrée', 'Plat', 'Dessert', 'Boisson'];
const MAX_IMAGES = 6;

function isValidVideoUrl(url: string) {
	return /^(https?:\/\/)?(www\.)?(tiktok\.com|vm\.tiktok\.com|instagram\.com|youtu\.be|youtube\.com|facebook\.com)\/.+$/i.test(url);
}

/** Durée ou nombre saisi dans un champ numérique : entier positif, ou null si vide. */
function toPositiveInt(value: string, max: number): number | null {
	const n = Math.round(Number(value));
	return value.trim() !== '' && Number.isFinite(n) && n >= 0 ? Math.min(max, n) : null;
}

function EditRecetteContent() {
	const router = useRouter();
	const id = useSearchParams()?.get('id');
	const { units: allUnits, reload: reloadUnits } = useUnits();

	const [recette, setRecette] = useState<Recipe | null>(null);
	const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');

	const [title, setTitle] = useState('');
	const [type, setType] = useState('');
	const [preparationTime, setPreparationTime] = useState<number | null>(null);
	const [cookingTime, setCookingTime] = useState<number | null>(null);
	const [servings, setServings] = useState<number | null>(null);
	const [position, setPosition] = useState('none');
	const [video, setVideo] = useState('');
	const [parts, setParts] = useState<RecipePartForm[]>([]);

	const [imageURLs, setImageURLs] = useState<string[]>([]);
	// Photos retirées pendant l'édition : supprimées du stockage seulement après l'enregistrement
	const [removedImages, setRemovedImages] = useState<string[]>([]);
	const [uploading, setUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [catalog, setCatalog] = useState<CatalogIngredient[]>([]);
	const [unitTarget, setUnitTarget] = useState<{ partIndex: number; index: number } | null>(null);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!id) {
			setStatus('missing');
			return;
		}
		let cancelled = false;

		(async () => {
			const [snapshot, ingredients] = await Promise.all([
				getDoc(doc(db, 'recipes', id)),
				getDocs(collection(db, 'ingredients')).catch(() => null),
			]);
			if (cancelled) return;

			if (ingredients) {
				setCatalog(
					ingredients.docs.map((d) => {
						const data = d.data();
						return { id: d.id, name: data.name, unit: data.unit || '', ...(data.defaultUnitId ? { defaultUnitId: data.defaultUnitId } : {}) };
					})
				);
			}

			if (!snapshot.exists()) {
				setStatus('missing');
				return;
			}

			const data = snapshot.data() as Recipe;
			const names = new Map((ingredients?.docs ?? []).map((d) => [d.id, String(d.data().name || '')]));

			setRecette(data);
			setTitle(data.title || '');
			setType(data.type || '');
			setPreparationTime(Number(data.preparationTime) || null);
			setCookingTime(Number(data.cookingTime) || null);
			setServings(data.servings ?? null);
			setPosition(data.position || 'none');
			setVideo(data.video || '');
			setImageURLs(data.images || []);
			setParts(
				(data.recipeParts?.length ? data.recipeParts : [{ title: '', steps: [], ingredients: [] }]).map((part) => ({
					title: part.title || '',
					steps: part.steps?.length ? [...part.steps] : [''],
					ingredients: (part.ingredients || []).map((ingredient) => ({
						// Nom de la fiche ingrédient s'il existe (c'est celui affiché sur le site)
						name: names.get(ingredient.id) || ingredient.name || '',
						quantity: ingredient.quantity && ingredient.quantity !== '0' ? String(ingredient.quantity) : '',
						unit: ingredient.unit || '',
						...(ingredient.unitId ? { unitId: ingredient.unitId } : {}),
					})),
				}))
			);
			setStatus('ready');
		})().catch((error) => {
			console.error('Chargement de la recette impossible :', error);
			if (!cancelled) setStatus('missing');
		});

		return () => { cancelled = true; };
	}, [id]);

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

	// ---- Ce qui manque avant l'enregistrement ----
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
	if (!filledParts.some((part) => part.steps.length > 0)) missing.push('au moins une étape');
	const videoInvalid = Boolean(video.trim()) && !isValidVideoUrl(video.trim());

	// ---- Photos : envoyées dès leur sélection ----
	const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(event.target.files || []).slice(0, MAX_IMAGES - imageURLs.length);
		event.target.value = '';
		if (files.length === 0) return;

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

	const removeImage = (url: string) => {
		setImageURLs((current) => current.filter((item) => item !== url));
		setRemovedImages((current) => [...current, url]);
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!id || !recette || saving || uploading) return;

		if (missing.length > 0) {
			toast.error(`Il manque : ${missing.join(', ')}.`);
			return;
		}
		if (videoInvalid) {
			toast.error('Le lien vidéo doit venir de TikTok, Instagram, YouTube ou Facebook.');
			return;
		}

		const recipeTitle = title.trim();
		const catalogByKey = new Map(catalog.map((item) => [ingredientNameKey(item.name), item] as const));
		let rank = 0;
		const draftParts = filledParts.map((part, partIndex) => ({
			title: filledParts.length === 1 ? recipeTitle : part.title || `Partie ${partIndex + 1}`,
			steps: part.steps,
			ingredients: part.ingredients.map((ingredient) => {
				rank += 1;
				const name = formatIngredientName(ingredient.name) || ingredient.name.trim();
				const known = catalogByKey.get(ingredientNameKey(name));
				return {
					id: known?.id || `${slugify(name) || 'ingredient'}-${rank}`,
					name: known?.name || name,
					quantity: ingredient.quantity.trim(),
					unit: ingredient.unit,
					...(ingredient.unitId ? { unitId: ingredient.unitId } : {}),
				};
			}),
		}));

		setSaving(true);
		try {
			// La recette est déjà publiée : les ingrédients nouveaux reçoivent tout de suite leur fiche
			const { recipeParts, created } = await syncRecipeIngredientsWithCatalog(draftParts);

			await updateDoc(doc(db, 'recipes', id), {
				title: recipeTitle,
				type,
				preparationTime: preparationTime ?? 0,
				cookingTime: cookingTime ?? 0,
				...(servings && servings > 0 ? { servings } : {}),
				position: position || 'none',
				video: video.trim(),
				images: imageURLs,
				// Photo retirée : son crédit (image sous licence libre) ne vaut plus
				...(removedImages.length > 0 ? { imageCredit: deleteField() } : {}),
				recipeParts,
				titleKeywords: recipeTitle.toLowerCase().split(' '),
				updatedAt: new Date(),
			});

			// Les photos retirées ne sont effacées du stockage qu'une fois la recette enregistrée
			await Promise.all(
				removedImages
					.filter((url) => isOptimizableImage(url))
					.map((url) => deleteObject(ref(storage, url)).catch((error) => console.error('Photo non supprimée du stockage :', error)))
			);

			// La fiche publique est en cache : on la fait régénérer avec les nouvelles données
			revalidateRecipe({ id, url: recette.url });
			toast.success(created.length > 0 ? `Recette enregistrée. Ajouté au catalogue : ${created.join(', ')}` : 'Recette enregistrée');
			router.back();
		} catch (error) {
			console.error('Enregistrement de la recette impossible :', error);
			toast.error("La recette n'a pas pu être enregistrée. Réessayez.");
		} finally {
			setSaving(false);
		}
	};

	if (status === 'loading') {
		return <div className="add-recipe-container"><p role="status">Chargement de la recette…</p></div>;
	}

	if (status === 'missing') {
		return (
			<div className="add-recipe-container">
				<Breadcrumb />
				<header className="add-recipe-header">
					<h1>Recette introuvable</h1>
					<p className="subtitle">Cette recette n&apos;existe pas ou a été supprimée.</p>
				</header>
			</div>
		);
	}

	const severalParts = parts.length > 1;

	return (
		<div className="add-recipe-container">
			<Breadcrumb />
			<header className="add-recipe-header">
				<h1>Modifier la recette</h1>
				<p className="subtitle">Les changements sont visibles sur le site dès l&apos;enregistrement.</p>
			</header>

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
								<h2>Ingrédients</h2>
								<IngredientListEditor
									ingredients={part.ingredients}
									onChange={(ingredients) => updatePart(partIndex, { ingredients })}
									catalog={catalog}
									units={allUnits}
									onCreateUnit={(index) => setUnitTarget({ partIndex, index })}
								/>
							</div>
							<div>
								<h2>Étapes</h2>
								<StepListEditor steps={part.steps} onChange={(steps) => updatePart(partIndex, { steps })} />
							</div>
						</div>
					</section>
				))}

				<button
					type="button"
					className="recipe-add-part"
					onClick={() => setParts((current) => [...current, { title: '', ingredients: [{ name: '', quantity: '', unit: '' }], steps: [''] }])}
				>
					<span className="pi pi-plus" aria-hidden="true"></span>
					Ajouter une partie (pâte, garniture, glaçage…)
				</button>

				{/* ---- Photos ---- */}
				<section className="recipe-card">
					<h2>Photos</h2>
					<div className="recipe-photos">
						{imageURLs.map((url, index) => (
							<div key={url} className="recipe-photo">
								{/* eslint-disable-next-line @next/next/no-img-element -- simple aperçu dans un formulaire */}
								<img src={url} alt={`Photo ${index + 1}`} />
								<button type="button" className="recipe-photo-remove" aria-label={`Retirer la photo ${index + 1}`} onClick={() => removeImage(url)}>
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

				{/* ---- Enregistrement ---- */}
				<footer className="recipe-submit-bar">
					<p className="recipe-submit-status" aria-live="polite">
						{missing.length > 0 ? <>Il manque : {missing.join(', ')}.</> : 'Les changements ne sont pas encore enregistrés.'}
					</p>
					<div className="recipe-submit-actions">
						<button type="button" className="recipe-link-button" onClick={() => router.back()}>Annuler</button>
						<Button
							type="submit"
							label={saving ? 'Enregistrement…' : uploading ? 'Envoi des photos…' : 'Enregistrer'}
							icon="pi pi-check"
							loading={saving}
							disabled={saving || uploading}
						/>
					</div>
				</footer>
			</form>
		</div>
	);
}

export default function EditRecette() {
	return (
		<Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Chargement…</div>}>
			<EditRecetteContent />
		</Suspense>
	);
}
