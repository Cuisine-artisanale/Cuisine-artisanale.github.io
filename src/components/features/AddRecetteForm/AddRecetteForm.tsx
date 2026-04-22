"use client";
import React, { useEffect, useState } from 'react';
import './AddRecetteForm.css';
import { Breadcrumb } from '@/components/layout';

import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Dropdown, DropdownChangeEvent } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { AutoComplete } from 'primereact/autocomplete';

import { db, storage } from '@/lib/config/firebase';
import { collection, addDoc, updateDoc, doc, query, getDocs } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { toast } from 'react-toastify';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import { AddIngredientForm } from '@/components/features';
import type { Ingredient, Department, RecipePart } from '@/types';


const AddRecetteForm: React.FC = () => {
  const { user } = useAuth();
  let recetteId: string = '';

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;
  const { showToast } = useToast();

  const prevStep = () => {
	if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const [title, setTitle] = useState('');
  const [type, setType] = useState<number | null>(null);
  const [preparationTime, setPreparationTime] = useState<number | null>(null);
  const [cookingTime, setCookingTime] = useState<number | null>(null);
  const [video, setVideo] = useState('');
  const [videoError, setVideoError] = useState('');
  const [tiktokImportUrl, setTiktokImportUrl] = useState('');
  const [tiktokImporting, setTiktokImporting] = useState(false);
  const [isRecetteCreated, setIsRecetteCreated] = useState<boolean>(false);
  const [recipeParts, setRecipeParts] = useState<RecipePart[]>([{
	title: 'Recette 1',
	steps: [],
	ingredients: {},
	selectedIngredients: []
  }]);

  const [regions, setRegions] = useState<Department[]>([]);
  const [ingredientsList, setIngredientsList] = useState<Ingredient[]>([]);
  const defaultDepartment: Department = { nom: "Aucun département", code: "none" };
  const [position, setPosition] = useState<Department>(defaultDepartment);

  const [images, setImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imageURLs, setImageURLs] = useState<string[]>([]);

  	const [filteredIngredients, setFilteredIngredients] = useState<Ingredient[][]>(
		recipeParts.map(() => [])
	);
	const [showAddIngredientDialog, setShowAddIngredientDialog] = useState(false);
	const [newIngredientName, setNewIngredientName] = useState('');
	const [currentPartIndex, setCurrentPartIndex] = useState<number | null>(null);

	const [queries, setQueries] = useState<string[]>(recipeParts.map(() => ''));

	const handleQueryChange = (value: string, partIndex: number) => {
		setQueries(prev => {
			const newQueries = [...prev];
			newQueries[partIndex] = value; // mettre à jour uniquement l'index correspondant
			return newQueries;
		});
	};

	const nextStep = (e?: React.FormEvent) => {
		e?.preventDefault();
		let isValid = true;
		let message = '';

		switch (currentStep) {
			case 1:
			if (!title.trim()) {
				isValid = false;
				message = 'Veuillez entrer un titre pour votre recette.';
			}
			break;

			case 2:
			if (!type || preparationTime === null || cookingTime === null) {
				isValid = false;
				message = 'Veuillez remplir le type de plat et les temps de préparation/cuisson.';
			}
			break;

			case 3:
			if (!recipeParts.some(part => part.selectedIngredients.length > 0)) {
				isValid = false;
				message = 'Veuillez ajouter au moins un ingrédient.';
			}
			break;

			case 4:
			if (!recipeParts.every(part => part.steps.length > 0 && part.steps.every(s => s.trim() !== ''))) {
				isValid = false;
				message = 'Veuillez décrire au moins une étape de préparation.';
			}
			break;

			default:
			break;
		}

		if (!isValid) {
			toast.error(message);
			return;
		}

		// si tout est bon, on passe à l’étape suivante
		if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
	};


	const searchIngredients = (query: string, partIndex: number) => {
		const filtered = ingredientsList.filter(
			ing => ing.name.toLowerCase().includes(query.toLowerCase()) &&
				!recipeParts[partIndex].selectedIngredients.includes(ing.id)
		);
		// ajoute l'option de création si le query n'est pas vide
		const suggestions =
			query.trim() !== ''
				? [
					{
					id: 'new',
					name: `➕ Créer "${query}"`,
					isNew: true,
					rawName: query,
					},
					...filtered,
				]
			: filtered;

		setFilteredIngredients(prev => {
			const newFiltered = [...prev];
			newFiltered[partIndex] = suggestions;
			return newFiltered;
		});
	};

	const addIngredient = (ingredient: Ingredient, partIndex: number) => {
		const newParts = [...recipeParts];
		newParts[partIndex].selectedIngredients.push(ingredient.id);
		newParts[partIndex].ingredients[ingredient.id] = '0';
		setRecipeParts(newParts);

		// On vide le champ uniquement ici
		handleQueryChange('', partIndex);
	};

	const removeIngredient = (partIndex: number, ingredientId: string) => {
		const newParts = [...recipeParts];
		newParts[partIndex].selectedIngredients = newParts[partIndex].selectedIngredients.filter(id => id !== ingredientId);
		delete newParts[partIndex].ingredients[ingredientId];
		setRecipeParts(newParts);
	};

  const types = [
	{ id: 1, name: 'Entrée' },
	{ id: 2, name: 'Plat' },
	{ id: 3, name: 'Dessert' },
	{ id: 4, name: 'Boisson' },
  ];

  const addStep = (partIndex: number) => {
	const newParts = [...recipeParts];
	newParts[partIndex].steps.push('');
	setRecipeParts(newParts);
  };

   const removeStep = (partIndex: number, stepIndex: number) => {
	 const newParts = [...recipeParts];
	 newParts[partIndex].steps = newParts[partIndex].steps.filter((_, i) => i !== stepIndex);
	 setRecipeParts(newParts);
   };

  const handleStepChange = (partIndex: number, stepIndex: number, value: string) => {
	const newParts = [...recipeParts];
	newParts[partIndex].steps[stepIndex] = value;
	setRecipeParts(newParts);
   };

  const handleIngredientQuantityChange = (partIndex: number, ingredientId: string, value: string) => {
	const newParts = [...recipeParts];
	newParts[partIndex].ingredients[ingredientId] = value;
	setRecipeParts(newParts);
  };

  function generateKeywords(title: string): string[] {
	return title.toLowerCase().split(" ");
  }

  // Utiliser la fonction slugify centralisée
  const slugify = (str: string) => {
	const slug = str
	  .normalize("NFD")
	  .replace(/[\u0300-\u036f]/g, "")
	  .replace(/[^\w\s-]/g, "")
	  .trim()
	  .replace(/\s+/g, "-") // Utiliser des tirets au lieu d'underscores
	  .replace(/-+/g, "-") // Remplacer les tirets multiples par un seul
	  .toLowerCase();
	return slug;
  };

  function generateUrl(title: string): string {
	return slugify(title);
  }

  function isValidVideoUrl(url: string) {
	const regex = /^(https?:\/\/)?(www\.)?(tiktok\.com|instagram\.com|youtu\.be|youtube\.com|facebook\.com)\/.+$/i;
	return regex.test(url);
  }

  function isValidTikTokUrl(url: string) {
	return /^(https?:\/\/)?(www\.)?(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)\/.+$/i.test(url);
  }

  const handleImportTikTokByUrl = async () => {
	if (!user) {
	  toast.error("Vous devez être connecté pour importer une vidéo TikTok.");
	  return;
	}

	const trimmedUrl = tiktokImportUrl.trim();
	if (!trimmedUrl || !isValidTikTokUrl(trimmedUrl)) {
	  toast.error("Veuillez saisir une URL TikTok valide.");
	  return;
	}

	try {
	  setTiktokImporting(true);
	  const idToken = await user.getIdToken();
	  const response = await fetch('/api/tiktok/import-url', {
		method: 'POST',
		headers: {
		  'Content-Type': 'application/json',
		  Authorization: `Bearer ${idToken}`,
		},
		body: JSON.stringify({ videoUrl: trimmedUrl }),
	  });

	  const data = await response.json();
	  if (!response.ok || !data?.success) {
		throw new Error(data?.error || "Erreur lors de l'import TikTok.");
	  }

	  if (data.duplicate) {
		toast.info('Cette vidéo TikTok est déjà importée.');
	  } else {
		const aiNote = data.aiUsed
		  ? 'IA active'
		  : `fallback ${data.aiError ? `(${data.aiError})` : '(sans IA)'}`;
		toast.success(`Vidéo TikTok importée dans la modération - ${aiNote}.`);
	  }
	  setTiktokImportUrl('');
	} catch (error: any) {
	  toast.error(error?.message || "Erreur lors de l'import de la vidéo TikTok.");
	} finally {
	  setTiktokImporting(false);
	}
  };

  const handleSubmit = async (event: React.FormEvent) => {
	console.log('Submitting form...');
	event.preventDefault();

	setPreparationTime(preparationTime ?? 0);
	setCookingTime(cookingTime ?? 0);

	if (!title || !type || preparationTime === null || cookingTime === null ||
	  !recipeParts.every(part => part.steps.every(step => step.trim() !== ''))) {
	  alert('Veuillez remplir tous les champs');
	  return;
	}

	if (video && !isValidVideoUrl(video)) {
	  setVideoError("Veuillez entrer une URL vidéo TikTok, Instagram ou YouTube valide.");
	  return;
	} else {
	  setVideoError('');
	}

	const capitalizedTitle = title.charAt(0).toUpperCase() + title.slice(1);
	const selectedType = types.find(t => t.id === type)?.name;

	const formattedRecipeParts = recipeParts.map(part => ({
	  ...part,
	  ingredients: part.selectedIngredients.map(id => {
		const ingredient = ingredientsList.find(i => i.id === id.toString());
		return ingredient ? {
		  id: ingredient.id,
		  name: ingredient.name,
		  quantity: part.ingredients[id] || '0',
		  unit: ingredient.unit || ''
		} : null;
	  }).filter(Boolean)
	}));

	// Upload des images non encore téléversées à la soumission (évite d'oublier de cliquer sur "Télécharger")
	let finalImageUrls = [...imageURLs];
	if (images.length > 0) {
	  setUploading(true);
	  try {
		const uploadedUrls = await uploadImagesToStorage(images, capitalizedTitle);
		finalImageUrls = [...imageURLs, ...uploadedUrls];
	  } catch (error) {
		console.error('Error uploading images:', error);
		toast.error('Erreur lors du téléversement des images. Réessayez.');
		setUploading(false);
		return;
	  }
	  setUploading(false);
	}

	if (!isRecetteCreated) {
		console.log('Creating new recette...');
	  try {
		const docRef = await addDoc(collection(db, 'recipesRequest'), {
		  title: '',
		  type: '',
		  preparationTime: '',
		  cookingTime: '',
		  video: '',
		  images: [],
		  recipeParts: [],
		  position: '',
		  createdBy: '',
		  titleKeywords: [],
		  url: '',
		});


		recetteId = docRef.id;
		setIsRecetteCreated(true);
	  } catch (error) {
		console.error('Error creating recette:', error);
	  }
	  console.log('Recette ID after creation:', recetteId);
	  try {
		const recetteRef = doc(db, 'recipesRequest', recetteId);
		if (formattedRecipeParts.length == 1) {
		  formattedRecipeParts[0].title = capitalizedTitle;
		}
		await updateDoc(recetteRef, {
		  title: capitalizedTitle,
		  type: selectedType,
		  preparationTime,
		  cookingTime,
		  video,
		  id: recetteId,
		  createdAt: new Date(),
		  recipeParts: formattedRecipeParts,
		  position: position?.code || 'none',
		  createdBy: user?.uid,
		  images: finalImageUrls,
		  titleKeywords: generateKeywords(capitalizedTitle),
		  url: generateUrl(capitalizedTitle),
		});

		setTitle('');
		setType(null);
		setPreparationTime(0);
		setCookingTime(0);
		setVideo('');
		setRecipeParts([{ title: 'Recette 1', steps: [], ingredients: {}, selectedIngredients: [] }]);
		setPosition(defaultDepartment);
		setImages([]);
		setImageURLs([]);
		setIsRecetteCreated(false);
		navigateBack();
		toast.success('Recette envoyée à la vérification admin');
	  } catch (error) {
		console.error('Error updating recette:', error);
	  }
	}
  };

  useEffect(() => {
	fetch("https://geo.api.gouv.fr/departements")
	  .then(res => res.json())
	  .then(data => {
		const departmentsWithDefault = [
		  defaultDepartment,
		  ...data.map((dept: any) => ({
			nom: dept.nom,
			code: dept.code
		  }))
		];
		setRegions(departmentsWithDefault);
	  });
	fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
	try {
	  const recettesCollection = collection(db, "ingredients");
	  let recettesQuery = query(recettesCollection);
	  const querySnapshot = await getDocs(recettesQuery);
	  const recettesData: Ingredient[] = querySnapshot.docs.map((doc) => {
		const data = doc.data();
		return { name: data.name, id: doc.id, unit: data.unit || '' };
	  });
	  setIngredientsList(recettesData);
	} catch (error) {
	  console.error("Error getting recettes: ", error);
	}
  };

  const handleFileChange = (e: { target: { files: any; }; }) => {
	setImages([...e.target.files]);
  };

  /** Upload des fichiers vers Firebase Storage. Utilisé au clic sur "Télécharger" et à la soumission du formulaire. */
  const uploadImagesToStorage = async (files: File[], folderName: string): Promise<string[]> => {
	if (files.length === 0) return [];
	const urls: string[] = [];
	const safeFolder = folderName.trim() || 'sans-titre';

	for (const image of files) {
	  const storageRef = ref(storage, `recipes/${safeFolder}/${image.name}`);
	  const uploadTask = uploadBytesResumable(storageRef, image);

	  await new Promise<void>((resolve, reject) => {
		uploadTask.on(
		  "state_changed",
		  null,
		  (error) => {
			console.error("Upload failed:", error);
			reject(error);
		  },
		  async () => {
			const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
			urls.push(downloadURL);
			resolve();
		  }
		);
	  });
	}
	return urls;
  };

  const handleUpload = async () => {
	if (images.length === 0) return;
	setUploading(true);
	try {
	  const urls = await uploadImagesToStorage(images, title);
	  setImageURLs(prev => [...prev, ...urls]);
	  setImages([]);
	} catch (error) {
	  toast.error('Erreur lors du téléversement des images.');
	} finally {
	  setUploading(false);
	}
  };

  const navigateBack = () => {
	window.history.back();
  };

  	const removePart = (partIndex: number) => {
		const newParts = recipeParts.filter((_, i) => i !== partIndex);
		setRecipeParts(newParts);
	};

  return (
	<div className="add-recipe-container">
	  	<Breadcrumb />
	  	<header className="add-recipe-header">
			<h1>Composer votre propre recette</h1>
			<p className="subtitle">Les champs marqués d'un * sont obligatoires</p>
		</header>

		<section className="tiktok-import-panel">
			<h2>Importer depuis TikTok</h2>
			<p>Collez une URL TikTok pour envoyer rapidement une recette en modération.</p>
			<div className="tiktok-import-controls">
				<InputText
					value={tiktokImportUrl}
					onChange={(e) => setTiktokImportUrl(e.target.value)}
					placeholder="https://www.tiktok.com/@user/video/..."
					disabled={tiktokImporting || !user}
				/>
				<Button
					type="button"
					label={tiktokImporting ? 'Import...' : 'Importer URL TikTok'}
					onClick={handleImportTikTokByUrl}
					disabled={tiktokImporting || !user}
				/>
			</div>
			{!user && <p className="tiktok-import-hint">Connectez-vous pour importer une vidéo TikTok.</p>}
		</section>

		{/* Barre de progression */}
		<div className="step-progress">
			Étape {currentStep} sur {totalSteps}
			<div className="progress-bar">
			<div className="progress" style={{ width: `${(currentStep / totalSteps) * 100}%` }} />
			</div>
		</div>

	  	<form onSubmit={handleSubmit} className="recipe-form">
			<div className="form-grid">
				{currentStep === 1 && (
					<section className="form-section basic-info">

						<h2>Création de votre recette</h2>
						<div className="form-group">
							<label htmlFor="title">Titre *</label>
							<InputText id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Entrez le titre" required />
						</div>
						<p><i>Elle sera analysée et traitée dans les plus brefs délais par nos équipes.</i></p>
						<p><i>Si votre recette respecte nos critères, elle sera publiée sur notre plateforme.</i></p>
					</section>
				)}

				{currentStep === 2 && (
					<section className="form-section timing">
						<div className='type-section'>
							<h2>Type et origine</h2>
							<div className="form-group">
								<label htmlFor="type">Type de plat *</label>
								<Dropdown id="type" value={type} options={types} onChange={(e: DropdownChangeEvent) => setType(e.value)} optionLabel="name" optionValue="id" placeholder="Sélectionnez un type" required />
							</div>

							<div className="form-group">
								<label htmlFor="position">Département d'origine</label>
								<Dropdown id="position" value={position} options={regions} onChange={(e: DropdownChangeEvent) => setPosition(e.value)} optionLabel="nom" optionValue="code" placeholder="Sélectionnez un département" />
							</div>
						</div>

						<div className="time-inputs">
							<h2>Temps de préparation</h2>
							<div className="form-group">
								<label htmlFor="preparationTime">Préparation (min) *</label>
								<InputNumber id="preparationTime" value={preparationTime} onChange={(e) => setPreparationTime(e.value)} min={0} required mode="decimal" locale="fr-FR" />
							</div>
							<div className="form-group">
								<label htmlFor="cookingTime">Cuisson (min) *</label>
								<InputNumber id="cookingTime" value={cookingTime} onChange={(e) => setCookingTime(e.value)} min={0} required mode="decimal" locale="fr-FR" />
							</div>
						</div>
					</section>
				)}

			{currentStep === 3 && (
				<section className="form-section ingredients">
					<AddIngredientForm
						visible={showAddIngredientDialog}
						onHide={() => setShowAddIngredientDialog(false)}
						initialName={newIngredientName}
						onIngredientCreated={(newIngredient) => {
							// Optionnel : ajoute-le à ta liste globale si tu veux le garder en mémoire
							setIngredientsList((prev) => [...prev, newIngredient]);
							// Et directement à la recette courante
							addIngredient(newIngredient, currentPartIndex !== null ? currentPartIndex : 0);
							setShowAddIngredientDialog(false);
						}}
					/>
					<h2>Ingrédients *</h2>
					{recipeParts.map((part, partIndex) => {
						return (
							<div key={partIndex} className="part-ingredients">
							<h3>{part.title}</h3>

							<AutoComplete
								field="name"
								suggestions={filteredIngredients[partIndex] || []}
								completeMethod={(e) => searchIngredients(e.query, partIndex)}
								placeholder="Tapez un ingrédient"
								value={queries[partIndex]}
								onChange={(e) => {
									if (typeof e.value === 'string') {
										handleQueryChange(e.value, partIndex);
									}
								}}

								onSelect={(e) => {
									const selected = e.value;

									if (selected.id === 'new') {
										setNewIngredientName(selected.name.replace('➕ Créer "', '').replace('"', ''));
										setShowAddIngredientDialog(true);
										setCurrentPartIndex(partIndex);
									} else {
										addIngredient(selected, partIndex);
									}   // ajoute l'ingrédient
									handleQueryChange('', partIndex);	 // vide le champ après sélection
								}}
								dropdown

								onKeyDown={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault(); // éviter le submit du form
										const filtered = filteredIngredients[partIndex] || [];
										if (filtered.length > 0) {
											addIngredient(filtered[0], partIndex); // on prend le premier
										}
										handleQueryChange('', partIndex); // vide le champ
									}
								}}
							/>

							<section className="ingredient-quantities">
								{part.selectedIngredients.map((id) => {
									const ingredient = ingredientsList.find(i => i.id === id);
									return (
									<div key={id} className="ingredient-item">
										<span>{ingredient?.name}</span>
										<InputNumber
											value={part.ingredients[id] ? parseFloat(part.ingredients[id]) : null}
											onChange={(e) => handleIngredientQuantityChange(partIndex, id, e.value?.toString() || '0')}
											placeholder="Quantité"
											min={0}
											mode="decimal"
										/>
										<span>{ingredient?.unit}</span>
										<button
											type="button"
											className="remove-ingredient-btn"
											onClick={() => removeIngredient(partIndex, id)}
											title="Supprimer cet ingrédient"
										>
										❌
										</button>
									</div>
									);
								})}
							</section>
						</div>
					);
					})}
				</section>
				)}


			{currentStep === 4 && (
			<section className="form-section steps">
				<h2>🧑‍🍳 Étapes de préparation *</h2>
				<p className="section-subtitle">
				Ajoute les étapes de chaque partie de ta recette (ex: pâte à cookie, brownie...).
				</p>

				<Button
					type="button"
					label="Ajouter une sous-recette"
					icon="pi pi-plus"
					className="p-button-text p-button-sm"
					onClick={() =>{
						setRecipeParts([
						...recipeParts,
						{ title: `Recette ${recipeParts.length + 1}`, steps: [], ingredients: {}, selectedIngredients: [] }
						])
						showToast({
							severity: 'info',
							summary: 'Nouvelle sous-recette',
							detail: 'Penser a ajouter les ingrédients dans la page précédente.',
							life: 2000
						});
					}}
				/>

				{recipeParts.map((part, partIndex) => (
		<div key={partIndex} className="recipe-part-steps">
			<div className="part-header">
			<h3>{part.title}</h3>

				{/* 🔴 Bouton supprimer une sous-recette */}
				{partIndex !== 0 && (
					<button
						type="button"
						className="delete-part-btn"
						onClick={() => removePart(partIndex)}
						title="Supprimer cette sous-recette"
					>
						<i className="pi pi-trash"></i>
					</button>
				)}
			</div>

			{part.steps.map((step, stepIndex) => (
				<div key={stepIndex} className="step-card">
					<div className="step-header">
						<span className="step-number">{stepIndex + 1}</span>
						<label>Étape {stepIndex + 1}</label>
						<button
							type="button"
							className="delete-step-btn"
							onClick={() => removeStep(partIndex, stepIndex)}
							title="Supprimer cette étape"
						>
							<i className="pi pi-trash"></i>
						</button>
						</div>

						<textarea
							className="step-textarea"
							placeholder="Décris cette étape de préparation..."
							value={step}
							onChange={(e) => handleStepChange(partIndex, stepIndex, e.target.value)}
							rows={3}
						/>
					</div>
					))}

					<button
					type="button"
					className="add-step-btn"
					onClick={() => addStep(partIndex)}
					>
					<i className="pi pi-plus"></i> Ajouter une étape à {part.title}
					</button>
				</div>
				))}

				</section>
			)}

			{currentStep === 5 && (
				<section className="form-section media">
					<h2>📸 Médias</h2>
					<p className="section-subtitle">
					Ajoute une vidéo (facultatif) et téléverse quelques images illustrant ta recette.
					</p>

					{/* --- Lien vidéo --- */}
					<div className="form-group">
					<label htmlFor="video">Lien vidéo</label>
					<InputText
						id="video"
						value={video}
						onChange={(e) => setVideo(e.target.value)}
						placeholder="URL TikTok, Instagram, YouTube..."
						className="video-input"
					/>
					{videoError && <div className="error-message">{videoError}</div>}
					</div>

					{/* --- Upload d'images --- */}
					<div className="form-group upload-section">
					<h3>Images</h3>

					<div className="upload-actions">
						<label htmlFor="file-upload" className="custom-file-upload">
						<i className="pi pi-image"></i> Sélectionner des images
						</label>
						<input
						id="file-upload"
						type="file"
						multiple
						onChange={handleFileChange}
						accept="image/*"
						/>
						<Button
						label={uploading ? "Téléchargement..." : "Télécharger"}
						icon="pi pi-upload"
						onClick={handleUpload}
						disabled={images.length === 0 || uploading}
						/>
					</div>

					{images.length > 0 && !uploading && (
						<p className="upload-info">
						{images.length} image{images.length > 1 ? 's' : ''} sélectionnée{images.length > 1 ? 's' : ''}.
						</p>
					)}
					</div>

					{/* --- Aperçu des images --- */}
					{imageURLs.length > 0 && (
					<div className="image-grid">
						{imageURLs.map((url, index) => (
						<div key={index} className="image-card">
							<img src={url} alt={`Preview ${index + 1}`} className="image-preview" />
						</div>
						))}
					</div>
					)}
				</section>
				)}

		</div>

			<footer className="form-actions">
				{currentStep > 1 && (
					<Button type="button" label="Précédent" icon="pi pi-arrow-left" className="p-button-secondary" onClick={prevStep} />
				)}
				{currentStep < totalSteps ? (
					<Button type="button" label="Suivant" icon="pi pi-arrow-right" className="p-button-primary" onClick={nextStep} />
				) : (
					<Button
						type="submit"
						label={uploading ? 'Téléversement des images...' : 'Créer la recette'}
						icon="pi pi-check"
						className="p-button-success"
						disabled={uploading}
					/>
				)}
				<Button type="button" label="Annuler" icon="pi pi-times" className="cancel-button" onClick={navigateBack} />
			</footer>
		</form>
	</div>
  );
};

export default AddRecetteForm;