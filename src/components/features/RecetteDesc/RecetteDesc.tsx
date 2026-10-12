"use client";
import React, { useEffect, useState, useRef } from 'react';
import { DEPARTEMENT_NAMES } from '@/constants/departements';
import './RecetteDesc.css';
import VideoEmbed from '@/components/ui/VideoEmbed/VideoEmbed';
import Image from 'next/image';
import { isOptimizableImage } from '@/lib/utils/image';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { getRecipeUrl } from '@/lib/utils/recipe-url';
import { formatAmount, isConvertibleToMetric, resolveUnit, type UnitDef } from '@/lib/utils/units';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { revalidateRecipe } from '@/lib/utils/revalidate-recipe';
import { useUnits } from '@/hooks/useUnits';
import { loadFirestore } from '@/lib/config/firestore-lazy';
import { Button } from 'primereact/button';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import { Rating } from 'primereact/rating';
import { InputTextarea } from 'primereact/inputtextarea';
import { shareRecipe } from '@/lib/services/share.service';
import { exportRecipePDF, printRecipe } from '@/lib/services/export.service';
import type { Recipe, Ingredient } from '@/types';
import type { RecipeReview, SimilarRecipe } from '@/lib/server/recipes';
import { Dialog } from 'primereact/dialog';
import { Checkbox } from 'primereact/checkbox';

/** Date d'un avis, au même format sur le serveur et dans le navigateur (pas d'écart à l'hydratation). */
function formatReviewDate(iso?: string): string {
	if (!iso) return '';
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' });
}

// Chargé uniquement à l'ouverture du mode cuisine
const CookingMode = dynamic(() => import('@/components/features/CookingMode/CookingMode'), { ssr: false });

/** Durée lisible : 45 → « 45 min », 90 → « 1 h 30 ». */
function formatDuration(minutes: number): string {
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest ? `${hours} h ${String(rest).padStart(2, '0')}` : `${hours} h`;
}

interface RecetteDescProps {
	/** Recette chargée côté serveur (premier rendu complet, SEO) */
	initialRecipe?: Recipe;
	/** Catalogue d'unités chargé côté serveur */
	initialUnits?: UnitDef[];
	/** Pseudo public de l'auteur */
	authorName?: string | null;
	/** Compteur de likes stocké sur la recette */
	initialLikesCount?: number;
	initialReviews?: RecipeReview[];
	similarRecipes?: SimilarRecipe[];
}

const RecetteDesc: React.FC<RecetteDescProps> = ({
	initialRecipe,
	initialUnits,
	authorName = null,
	initialLikesCount = 0,
	initialReviews = [],
	similarRecipes = [],
}) => {
	// Toutes les données d'affichage viennent du serveur : aucun appel Firestore au chargement
	// pour un visiteur anonyme (le SDK n'est téléchargé qu'à la connexion ou à la première action).
	const recette: Recipe | null = initialRecipe ?? null;
	const id = recette?.id ?? null;
	const router = useRouter();
	const {role, user} = useAuth();
	const { showToast } = useToast();
	const [likesCount, setLikesCount] = useState<number>(initialLikesCount);
	const [hasLiked, setHasLiked] = useState<boolean>(false);
	const userId = user?.uid;
	const departements = DEPARTEMENT_NAMES;
	const [currentImageIndex, setCurrentImageIndex] = useState(0);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	const [reviews, setReviews] = useState<RecipeReview[]>(initialReviews);
	const [newReview, setNewReview] = useState('');
	const [newRating, setNewRating] = useState<number | null>(null);
	const [isExporting, setIsExporting] = useState(false);
	const [isInToDo, setIsInToDo] = useState<boolean>(false);
	const [showAddIngredientsDialog, setShowAddIngredientsDialog] = useState(false);
	const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(new Set());

	// ---- Ajustement des portions ----
	// Avec un nombre de personnes renseigné : on choisit le nombre de personnes.
	// Sinon : on choisit un multiplicateur (×0,5, ×1, ×1,5…).
	const baseServings = recette?.servings && recette.servings > 0 ? recette.servings : null;
	const [servings, setServings] = useState<number | null>(baseServings);
	const [multiplier, setMultiplier] = useState<number>(1);

	useEffect(() => {
		setServings(baseServings);
		setMultiplier(1);
	}, [baseServings, recette?.id]);

	const factor = baseServings && servings ? servings / baseServings : multiplier;
	const { index: unitIndex } = useUnits(initialUnits);
	/** Quantité + unité ajustées au nombre de personnes, avec conversion (1 500 g → 1,5 kg) */
	// Préférence d'unités de l'appareil : unités de la recette, ou tout en g / ml
	const { preference: unitPreference, setPreference: setUnitPreference } = useUnitPreference();
	const metric = unitPreference === 'metric';
	// Le choix n'est proposé que si la recette contient une unité convertible (cuillère, tasse, verre…)
	const hasConvertibleUnits = Boolean(
		recette?.recipeParts.some((part) =>
			part.ingredients.some((ing) => isConvertibleToMetric(resolveUnit(unitIndex, ing.unitId, ing.unit)))
		)
	);
	const amount = (ing: Ingredient) => formatAmount(ing.quantity, unitIndex, { unit: ing.unit, unitId: ing.unitId, factor, metric });

	const changeServings = (delta: number) => {
		if (baseServings) {
			setServings((current) => Math.min(50, Math.max(1, (current ?? baseServings) + delta)));
		} else {
			setMultiplier((current) => Math.min(10, Math.max(0.5, Math.round((current + delta * 0.5) * 2) / 2)));
		}
	};

	const resetServings = () => {
		setServings(baseServings);
		setMultiplier(1);
	};

	const servingsLabel = baseServings
		? `${servings ?? baseServings} personne${(servings ?? baseServings) > 1 ? 's' : ''}`
		: `×${multiplier.toLocaleString('fr-FR')}`;
	const [checkingToDo, setCheckingToDo] = useState(false);
	const [cookingMode, setCookingMode] = useState(false);
	// La fiche est en cache côté serveur : on la fait régénérer après chaque action qui la modifie
	const refreshCache = () => revalidateRecipe({ id: recette?.id, url: recette?.url });
	const hasSteps = Boolean(recette?.recipeParts.some((p) => p.steps.some((s) => s && s.trim())));


	// Vérifier si la recette est dans "à faire"
	useEffect(() => {
		const checkRecipeInToDo = async () => {
			if (!userId || !id) {
				setIsInToDo(false);
				return;
			}
			try {
				const { isRecipeInToDo } = await import('@/lib/services/shopping.service');
				const inToDo = await isRecipeInToDo(userId, id);
				setIsInToDo(inToDo);
			} catch (error) {
				console.error("Error checking if recipe is in to do:", error);
			}
		};
		checkRecipeInToDo();
	}, [userId, id]);


	// Le nombre de likes vient du serveur (compteur de la recette). Firestore n'est chargé
	// que pour un utilisateur connecté, afin de savoir s'il a déjà aimé la recette.
	useEffect(() => {
		if (!id || !userId) {
			setHasLiked(false);
			return;
		}
		let cancelled = false;
		(async () => {
			try {
				const { db, doc, getDoc } = await loadFirestore();
				const likeSnap = await getDoc(doc(db, 'likes', `${userId}_${id}`));
				if (!cancelled) setHasLiked(likeSnap.exists());
			} catch (error) {
				console.error('Erreur lors de la lecture du like :', error);
			}
		})();
		return () => { cancelled = true; };
	}, [id, userId]);

	useEffect(() => {
		if (recette?.images && recette.images.length > 1) {
			intervalRef.current = setInterval(() => {
				setCurrentImageIndex((prevIndex) =>
				prevIndex === (recette?.images?.length ?? 0) - 1 ? 0 : prevIndex + 1
				);
			}, 5000);
		}
		return () => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
		}
		};
	}, [recette?.images]);

	// Les données structurées (JSON-LD) sont générées côté serveur dans app/recettes/[slug]/page.tsx




	const handleImageClick = (index: number) => {
		setCurrentImageIndex(index);
		if (intervalRef.current) {
		clearInterval(intervalRef.current);
		}
	};

	const handleDelete = async () => {
		if (!id) return;
		try {
			const { db, doc, deleteDoc } = await loadFirestore();
			await deleteDoc(doc(db, "recipes", id));
			showToast({
				severity: 'success',
				summary: 'Succès',
				detail: 'Recette supprimée avec succès'
			});
			refreshCache();
			router.push('/recettes');
		} catch (error) {
			console.error("Erreur lors de la suppression de la recette :", error);
			showToast({
				severity: 'error',
				summary: 'Erreur',
				detail: 'Erreur lors de la suppression de la recette'
			});
		}
	};

	const confirmDelete = () => {
		confirmDialog({
			message: 'Êtes-vous sûr de vouloir supprimer cette recette ?',
			header: 'Confirmation de suppression',
			icon: 'pi pi-exclamation-triangle',
			accept: handleDelete,
			reject: () => {}
		});
	};

	const handleLike = async () => {
		if (!userId) {
			showToast({
				severity: 'warn',
				summary: 'Connexion requise',
				detail: 'Vous devez être connecté pour aimer une recette'
			});
			return;
		}
		if (!id) {
			showToast({
				severity: 'error',
				summary: 'Erreur',
				detail: 'Impossible de trouver la recette'
			});
			return;
		}
		try {
			const { toggleLikeRecipes, unlikeRecipes } = await import('@/lib/services/recipe.service');
			if (hasLiked) {
				await unlikeRecipes(id, userId);
				setHasLiked(false);
				setLikesCount((count) => Math.max(0, count - 1));
			} else {
				await toggleLikeRecipes(id, userId);
				setHasLiked(true);
				setLikesCount((count) => count + 1);
			}
			refreshCache();
		} catch (error) {
			console.error("Erreur lors du like:", error);
			showToast({
				severity: 'error',
				summary: 'Erreur',
				detail: 'Une erreur est survenue lors du like'
			});
		}
	};

	const handleShare = async () => {
		if (!recette?.title || !id) {
			showToast({
				severity: 'warn',
				summary: 'Erreur',
				detail: 'Impossible de partager cette recette'
			});
			return;
		}

		try {
			await shareRecipe({
				title: recette.title,
				description: `Découvrez la recette ${recette.title} sur Cuisine Artisanale`,
				recipeId: id,
				imageUrl: recette.images?.[0],
			});

			showToast({
				severity: 'success',
				summary: 'Succès',
				detail: 'Recette partagée ou lien copié !'
			});
		} catch (error) {
			console.error("Erreur lors du partage:", error);
			showToast({
				severity: 'error',
				summary: 'Erreur',
				detail: 'Impossible de partager la recette'
			});
		}
	};

	const handleDownloadPDF = async () => {
		if (!recette) {
			showToast({
				severity: 'warn',
				summary: 'Erreur',
				detail: 'Impossible de télécharger cette recette'
			});
			return;
		}

		setIsExporting(true);
		try {
			await exportRecipePDF({
				title: factor !== 1 ? `${recette.title} (${servingsLabel})` : recette.title,
				type: recette.type,
				preparationTime: recette.preparationTime,
				cookingTime: recette.cookingTime,
				position: recette.position,
				departementName: departements.get(recette.position),
				recipeParts: recette.recipeParts.map(part => ({
					title: part.title,
					ingredients: part.ingredients.map(ing => ({
						name: ing.name,
						quantity: amount(ing).quantity,
						unit: amount(ing).unit
					})),
					steps: part.steps
				})),
				images: recette.images
			});

			showToast({
				severity: 'success',
				summary: 'Succès',
				detail: 'Recette téléchargée en PDF'
			});
		} catch (error) {
			console.error("Erreur lors du téléchargement:", error);
			showToast({
				severity: 'error',
				summary: 'Erreur',
				detail: 'Impossible de télécharger la recette'
			});
		} finally {
			setIsExporting(false);
		}
	};

	const handlePrintRecipe = () => {
		if (!recette) {
			showToast({
				severity: 'warn',
				summary: 'Erreur',
				detail: 'Impossible d\'imprimer cette recette'
			});
			return;
		}

		try {
			printRecipe({
				title: factor !== 1 ? `${recette.title} (${servingsLabel})` : recette.title,
				type: recette.type,
				preparationTime: recette.preparationTime,
				cookingTime: recette.cookingTime,
				position: recette.position,
				departementName: departements.get(recette.position),
				recipeParts: recette.recipeParts.map(part => ({
					title: part.title,
					ingredients: part.ingredients.map(ing => ({
						name: ing.name,
						quantity: amount(ing).quantity,
						unit: amount(ing).unit
					})),
					steps: part.steps
				})),
				images: recette.images
			});

			showToast({
				severity: 'success',
				summary: 'Succès',
				detail: 'Ouverture de la fenêtre d\'impression'
			});
		} catch (error) {
			console.error("Erreur lors de l'impression:", error);
			showToast({
				severity: 'error',
				summary: 'Erreur',
				detail: 'Impossible d\'imprimer la recette'
			});
		}
	};

	const handleAddToToDo = async () => {
		if (!user || !recette || !id) {
			showToast({
				severity: 'warn',
				summary: 'Connexion requise',
				detail: 'Vous devez être connecté pour ajouter une recette à "à faire"'
			});
			return;
		}

		setCheckingToDo(true);
		try {
			const { addRecipeToDo } = await import('@/lib/services/shopping.service');
			await addRecipeToDo(user.uid, { ...recette, id });
			setIsInToDo(true);

			// Récupérer tous les ingrédients de la recette
			const allIngredients: Ingredient[] = [];
			recette.recipeParts.forEach(part => {
				allIngredients.push(...part.ingredients);
			});

			if (allIngredients.length > 0) {
				// Ouvrir la modal pour proposer d'ajouter les ingrédients
				setSelectedIngredients(new Set(allIngredients.map(ing => ing.id)));
				setShowAddIngredientsDialog(true);
			} else {
				showToast({
					severity: 'success',
					summary: 'Ajouté',
					detail: 'Recette ajoutée à "à faire"'
				});
			}
		} catch (error) {
			console.error("Error adding recipe to do:", error);
			showToast({
				severity: 'error',
				summary: 'Erreur',
				detail: 'Impossible d\'ajouter la recette à "à faire"'
			});
		} finally {
			setCheckingToDo(false);
		}
	};

	const handleRemoveFromToDo = async () => {
		if (!user || !id) return;

		try {
			const { removeRecipeToDo } = await import('@/lib/services/shopping.service');
			await removeRecipeToDo(user.uid, id);
			setIsInToDo(false);
			showToast({
				severity: 'success',
				summary: 'Retiré',
				detail: 'Recette retirée de "à faire"'
			});
		} catch (error) {
			console.error("Error removing recipe from to do:", error);
			showToast({
				severity: 'error',
				summary: 'Erreur',
				detail: 'Impossible de retirer la recette de "à faire"'
			});
		}
	};

	const handleToggleIngredient = (ingredientId: string) => {
		const newSelected = new Set(selectedIngredients);
		if (newSelected.has(ingredientId)) {
			newSelected.delete(ingredientId);
		} else {
			newSelected.add(ingredientId);
		}
		setSelectedIngredients(newSelected);
	};

	const handleAddSelectedIngredients = async () => {
		if (!user || !recette || !id) return;

		try {
			// Récupérer les ingrédients sélectionnés
			const allIngredients: Ingredient[] = [];
			recette.recipeParts.forEach(part => {
				part.ingredients.forEach(ing => {
					if (selectedIngredients.has(ing.id)) {
						// Quantités ajustées au nombre de personnes choisi
						const a = amount(ing);
						allIngredients.push({ ...ing, quantity: a.quantity, unit: a.unit, ...(a.unitId ? { unitId: a.unitId } : {}) });
					}
				});
			});

			if (allIngredients.length === 0) {
				showToast({
					severity: 'warn',
					summary: 'Attention',
					detail: 'Veuillez sélectionner au moins un ingrédient'
				});
				return;
			}

			const { addIngredientsToShoppingList } = await import('@/lib/services/shopping.service');
			await addIngredientsToShoppingList(
				user.uid,
				allIngredients,
				id,
				recette.title
			);

			setShowAddIngredientsDialog(false);
			showToast({
				severity: 'success',
				summary: 'Ingrédients ajoutés',
				detail: `${allIngredients.length} ingrédient(s) ajouté(s) à votre liste de course`
			});
		} catch (error) {
			console.error("Error adding ingredients to shopping list:", error);
			showToast({
				severity: 'error',
				summary: 'Erreur',
				detail: 'Impossible d\'ajouter les ingrédients à la liste de course'
			});
		}
	};

  	const handleAddReview = async () => {
		if (!userId) {
			showToast({
				severity: 'warn',
				summary: 'Connexion requise',
				detail: 'Connectez-vous pour laisser un avis'
			});
			return;
		}

		if (!id || !newReview.trim() || !newRating) {
			showToast({
				severity: 'warn',
				summary: 'Champs manquants',
				detail: 'Ajoutez une note et un message'
			});
			return;
		}

		try {
			// Un avis par personne et par recette : l'id est imposé par les règles Firestore.
			// Envoyer un nouvel avis remplace le précédent.
			const { db, doc, setDoc, serverTimestamp } = await loadFirestore();
			const reviewId = `${userId}_${id}`;
			const review = {
				recipeId: id,
				userId,
				userName: user?.displayName || "Utilisateur",
				message: newReview.trim(),
				rating: newRating,
			};
			await setDoc(doc(db, "reviews", reviewId), { ...review, createdAt: serverTimestamp() });

			// Affichage immédiat : l'avis remplace l'éventuel avis précédent de l'utilisateur
			setReviews((prev) => [
				{ id: reviewId, ...review, createdAt: new Date().toISOString() },
				...prev.filter((r) => r.id !== reviewId),
			]);
			refreshCache();

			setNewReview('');
			setNewRating(null);
			showToast({
				severity: 'success',
				summary: 'Merci !',
				detail: 'Votre avis a été enregistré'
			});
		} catch (error) {
			console.error("Erreur lors de l'ajout de l'avis :", error);
			showToast({
				severity: 'error',
				summary: 'Erreur',
				detail: 'Impossible d’ajouter l’avis'
			});
		}
	};

	const averageRating = reviews.length > 0	? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1) : null;

	const deleteReview = async (id: string) => {
		try {
			const { db, doc, deleteDoc } = await loadFirestore();
			await deleteDoc(doc(db, "reviews", id));
			setReviews((prev) => prev.filter((review) => review.id !== id));
			refreshCache();

			showToast({
				severity: 'success',
				summary: 'Avis supprimé',
				detail: "L'avis a été supprimé"
			})
		} catch (error) {
			showToast({
				severity: 'error',
				summary: 'Erreur',
				detail: "Impossible de supprimer l'avis"
			})
		}
	};

  return (
	<>
		<div className="RecetteDesc">
			<ConfirmDialog />
			<div className="recipe-topbar">
				<button type="button" className="recipe-back" onClick={() => router.back()}>
					<span className="pi pi-arrow-left" aria-hidden="true"></span>
					Retour
				</button>
				{role === 'admin' && (
					<div className="recipe-admin">
						<button type="button" className="recipe-action" onClick={() => router.push(`/recettes/edit?id=${id}`)}>
							<span className="pi pi-pencil" aria-hidden="true"></span>
							Modifier
						</button>
						<button type="button" className="recipe-action is-danger" onClick={confirmDelete}>
							<span className="pi pi-trash" aria-hidden="true"></span>
							Supprimer
						</button>
					</div>
				)}
			</div>

			{recette && (
				<header className={`recipe-hero${recette.images && recette.images.length > 0 ? '' : ' has-no-image'}`}>
					{recette.images && recette.images.length > 0 && (
						<div className="recipe-hero-gallery">
							<div className="recipe-hero-image">
								<Image
									src={recette.images[currentImageIndex]}
									alt={`${recette.title} - photo ${currentImageIndex + 1}`}
									width={800}
									height={600}
									priority={currentImageIndex === 0}
									sizes="(max-width: 900px) 100vw, 50vw"
									unoptimized={!isOptimizableImage(recette.images[currentImageIndex])}
								/>
							</div>
							{recette.images.length > 1 && (
								<div className="recipe-hero-thumbnails">
									{recette.images.map((image, index) => (
										<button
											type="button"
											key={index}
											className={`recipe-hero-thumbnail${index === currentImageIndex ? ' is-active' : ''}`}
											aria-label={`Afficher la photo ${index + 1}`}
											aria-pressed={index === currentImageIndex}
											onClick={() => handleImageClick(index)}
										>
											<Image
												src={image}
												alt=""
												width={100}
												height={100}
												sizes="72px"
												unoptimized={!isOptimizableImage(image)}
											/>
										</button>
									))}
								</div>
							)}
						</div>
					)}

					<div className="recipe-hero-body">
						{recette.type && <span className="recipe-hero-type">{recette.type}</span>}
						<h1 className="recipe-hero-title">{recette.title}</h1>

						<p className="recipe-hero-meta">
							{recette.createdBy && authorName && (
								<span>
									Par <Link href={`/profil?id=${recette.createdBy}`} className="creator-link">{authorName}</Link>
								</span>
							)}
							<a href="#avis" className="recipe-hero-rating">
								{averageRating ? (
									<>
										<span className="pi pi-star-fill" aria-hidden="true"></span>
										{averageRating.replace('.', ',')} / 5 · {reviews.length} avis
									</>
								) : (
									<>
										<span className="pi pi-star" aria-hidden="true"></span>
										Donner le premier avis
									</>
								)}
							</a>
						</p>

						<ul className="recipe-facts">
							{recette.preparationTime > 0 && (
								<li>
									<span className="pi pi-clock" aria-hidden="true"></span>
									<span><small>Préparation</small>{formatDuration(recette.preparationTime)}</span>
								</li>
							)}
							{recette.cookingTime > 0 && (
								<li>
									<span className="pi pi-hourglass" aria-hidden="true"></span>
									<span><small>Cuisson</small>{formatDuration(recette.cookingTime)}</span>
								</li>
							)}
							{baseServings && (
								<li>
									<span className="pi pi-users" aria-hidden="true"></span>
									<span><small>Pour</small>{baseServings} personne{baseServings > 1 ? 's' : ''}</span>
								</li>
							)}
							{/* Recette sans département (position « none ») : rien n'est affiché */}
							{recette.position && departements.get(recette.position) && (
								<li>
									<span className="pi pi-map-marker" aria-hidden="true"></span>
									<span><small>Origine</small>{departements.get(recette.position)}</span>
								</li>
							)}
						</ul>

						<div className="recipe-actions">
							<button
								type="button"
								className={`recipe-action${hasLiked ? ' is-active' : ''}`}
								aria-pressed={hasLiked}
								onClick={handleLike}
							>
								<span className={`pi ${hasLiked ? 'pi-heart-fill' : 'pi-heart'}`} aria-hidden="true"></span>
								J&apos;aime{likesCount > 0 ? ` · ${likesCount}` : ''}
							</button>
							{user && (
								<button
									type="button"
									className={`recipe-action${isInToDo ? ' is-active' : ''}`}
									aria-pressed={isInToDo}
									onClick={isInToDo ? handleRemoveFromToDo : handleAddToToDo}
									disabled={checkingToDo}
								>
									<span className={`pi ${isInToDo ? 'pi-check-circle' : 'pi-bookmark'}`} aria-hidden="true"></span>
									{isInToDo ? 'Dans ma liste' : 'À faire'}
								</button>
							)}
							<button type="button" className="recipe-action" onClick={handleShare}>
								<span className="pi pi-share-alt" aria-hidden="true"></span>
								Partager
							</button>
							<button type="button" className="recipe-action" onClick={handleDownloadPDF} disabled={isExporting}>
								<span className={`pi ${isExporting ? 'pi-spin pi-spinner' : 'pi-download'}`} aria-hidden="true"></span>
								PDF
							</button>
							<button type="button" className="recipe-action" onClick={handlePrintRecipe}>
								<span className="pi pi-print" aria-hidden="true"></span>
								Imprimer
							</button>
						</div>
					</div>
				</header>
			)}

			<div className="recipe-body">
				<div className="recipe-tools">
				{recette && recette.recipeParts.some((p) => p.ingredients.length > 0) && (
				<div className="recette-desc-servings" role="group" aria-label="Ajuster les quantités">
					<span className="recette-desc-servings-label">
						<i className="pi pi-users" aria-hidden="true"></i>
						{baseServings ? 'Pour' : 'Quantités'}
					</span>
					<Button
						icon="pi pi-minus"
						rounded
						text
						aria-label={baseServings ? 'Une personne de moins' : 'Diminuer les quantités'}
						onClick={() => changeServings(-1)}
						disabled={baseServings ? (servings ?? baseServings) <= 1 : multiplier <= 0.5}
					/>
					<strong className="recette-desc-servings-value" aria-live="polite">{servingsLabel}</strong>
					<Button
						icon="pi pi-plus"
						rounded
						text
						aria-label={baseServings ? 'Une personne de plus' : 'Augmenter les quantités'}
						onClick={() => changeServings(1)}
						disabled={baseServings ? (servings ?? baseServings) >= 50 : multiplier >= 10}
					/>
					{factor !== 1 && (
						<Button label="Réinitialiser" text size="small" className="recette-desc-servings-reset" onClick={resetServings} />
					)}
				</div>
				)}
				{hasConvertibleUnits && (
				<div className="recette-desc-units" role="group" aria-label="Unités affichées">
					<span className="recette-desc-units-label">
						<i className="pi pi-calculator" aria-hidden="true"></i>
						Unités
					</span>
					<button
						type="button"
						className={`recette-desc-units-option${!metric ? ' is-active' : ''}`}
						aria-pressed={!metric}
						onClick={() => setUnitPreference('recipe')}
					>
						De la recette
					</button>
					<button
						type="button"
						className={`recette-desc-units-option${metric ? ' is-active' : ''}`}
						aria-pressed={metric}
						onClick={() => setUnitPreference('metric')}
					>
						Métriques (g, ml)
					</button>
				</div>
				)}
				{hasSteps && (
				<div className="recette-desc-cooking">
					<Button
						label="Mode cuisine"
						icon="pi pi-play"
						className="recette-desc-cooking-button"
						onClick={() => setCookingMode(true)}
					/>
					<span className="recette-desc-cooking-hint">Les étapes en grand, une par une, écran toujours allumé</span>
				</div>
				)}
				</div>
				{recette?.recipeParts.map((part, index) => (
				<section key={index} className="recipe-part">
					{/* Recette en une seule partie : son titre répète celui de la recette */}
					{(recette.recipeParts.length > 1 || part.title !== recette.title) && part.title && <h2>{part.title}</h2>}
					<div className="recipe-part-columns">
						{part.ingredients.length > 0 && (
						<div className="recipe-ingredients">
							<h3>Ingrédients</h3>
							<ul>
							{part.ingredients.map((ingredient, idx) => {
								const formatted = amount(ingredient);
								const changed = factor !== 1 || (metric && formatted.unitId !== resolveUnit(unitIndex, ingredient.unitId, ingredient.unit)?.id);
								return (
									<li key={idx}>
										<span className="recipe-ingredient-name">{ingredient.name}</span>
										{formatted.text && (
											<span className={`recipe-ingredient-amount${changed ? ' recette-desc-quantity-scaled' : ''}`}>{formatted.text}</span>
										)}
									</li>
								);
							})}
							</ul>
						</div>
						)}

						<div className="recipe-steps">
							<h3>Préparation</h3>
							<ol>
							{part.steps.map((step, idx) => (
								<li key={idx}><p>{step}</p></li>
							))}
							</ol>
						</div>
					</div>
				</section>
				))}

				{recette?.video && (
				<section className="recipe-part recipe-video">
					<h2>En vidéo</h2>
					<VideoEmbed url={recette.video} />
				</section>
				)}
			</div>
			<div className="recette-reviews-section" id="avis">
				<h2>Avis et commentaires</h2>

				<div className="recette-reviews-container">
					{/* Formulaire d'avis */}
					<div className="recette-review-form">
						<h3>Partager votre avis</h3>

						<div className="form-group">
							<label>Votre note</label>
							<Rating value={newRating ?? undefined} onChange={(e) => setNewRating(e.value ?? null)} cancel={false} />
						</div>

						<InputTextarea
							value={newReview}
							onChange={(e) => setNewReview(e.target.value)}
							rows={4}
							placeholder="Partagez votre expérience..."
							className="review-textarea"
						/>

						<Button
							label="Envoyer mon avis"
							icon="pi pi-send"
							onClick={handleAddReview}
							disabled={!user}
							className="submit-button"
						/>

						{!user && (
							<p className="login-required">Connectez-vous pour laisser un avis</p>
						)}
					</div>

					{/* Liste des avis */}
					<div className="recette-reviews-list-container">
						{reviews.length === 0 ? (
							<p className="no-reviews">Soyez le premier à laisser un avis !</p>
						) : (
							<ul className="recette-reviews-list">
								{reviews.map((r) => (
									<li key={r.id} className="recette-review">
										<div className="recette-review-header">
											<div className="review-user-info">
												<strong ><a href={`/profil?id=${r.userId}`}>{r.userName}</a></strong>
												<Rating value={r.rating} readOnly cancel={false} />
											</div>
											{user && (role == "admin" || r.userId === userId) && (
												<Button
													icon="pi pi-trash"
													onClick={() => deleteReview(r.id!)}
													className="p-button-danger p-button-rounded p-button-sm"
													tooltip="Supprimer l'avis"
													tooltipOptions={{ position: 'bottom' }}
												/>
											)}
										</div>
										<p className="review-message">{r.message}</p>
										<small className="review-date">{formatReviewDate(r.createdAt)}</small>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>
			</div>

			{/* Section Recettes similaires */}
			<div className="recette-similar-section">
				<h2>Recettes similaires</h2>
				{similarRecipes.length === 0 ? (
					<p className="no-similar">Pas d'autres recettes similaires disponibles</p>
				) : (
					<div className="similar-recipes-grid">
						{similarRecipes.map((recipe) => (
							<Link
								key={recipe.id}
								href={getRecipeUrl(recipe)}
								className="similar-recipe-card"
							>
								{recipe.images && recipe.images.length > 0 && (
									<Image
										src={recipe.images[0]}
										alt={`${recipe.title} - Recette similaire`}
										className="similar-recipe-image"
										width={300}
										height={200}
										loading="lazy"
										sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
										unoptimized={!isOptimizableImage(recipe.images[0])}
									/>
								)}
								<div className="similar-recipe-content">
									<h3>{recipe.title}</h3>
									<p className="recipe-type">{recipe.type}</p>
									{recipe.cookingTime && (
										<p className="recipe-time">
											<i className="pi pi-clock"></i> {recipe.cookingTime} min
										</p>
									)}
								</div>
							</Link>
						))}
					</div>
				)}
			</div>
		</div>

		{cookingMode && recette && (
			<CookingMode
				title={recette.title}
				servingsLabel={baseServings || factor !== 1 ? servingsLabel : undefined}
				parts={recette.recipeParts.map((part) => ({
					title: part.title,
					steps: part.steps,
					ingredients: part.ingredients.map((ing) => ({ name: ing.name, amount: amount(ing).text })),
				}))}
				onClose={() => setCookingMode(false)}
			/>
		)}

		{/* Modal pour ajouter les ingrédients à la liste de course */}
		<Dialog
			header="Ajouter les ingrédients à votre liste de course"
			visible={showAddIngredientsDialog}
			style={{ width: '90vw', maxWidth: '600px' }}
			onHide={() => {
				setShowAddIngredientsDialog(false);
				setSelectedIngredients(new Set());
			}}
			footer={
				<div>
					<Button
						label="Annuler"
						icon="pi pi-times"
						onClick={() => {
							setShowAddIngredientsDialog(false);
							setSelectedIngredients(new Set());
						}}
						className="p-button-text"
					/>
					<Button
						label="Ajouter à la liste"
						icon="pi pi-check"
						onClick={handleAddSelectedIngredients}
						className="p-button-primary"
					/>
				</div>
			}
		>
			<div className="add-ingredients-dialog">
				<p style={{ marginBottom: '1rem', color: 'var(--text-color-secondary)' }}>
					Sélectionnez les ingrédients que vous souhaitez ajouter à votre liste de course :
				</p>
				<div className="ingredients-list">
					{recette?.recipeParts.map((part, partIndex) => (
						<div key={partIndex} className="ingredients-part">
							{part.ingredients.length > 0 && (
								<>
									<h4 style={{ marginBottom: '0.5rem', color: 'var(--text-color)' }}>
										{part.title}
									</h4>
									{part.ingredients.map((ingredient) => (
										<div
											key={ingredient.id}
											className="ingredient-item"
											style={{
												display: 'flex',
												alignItems: 'center',
												padding: '0.75rem',
												marginBottom: '0.5rem',
												background: 'var(--surface-ground)',
												borderRadius: 'var(--border-radius)',
												cursor: 'pointer',
												transition: 'background 0.2s'
											}}
											onClick={() => handleToggleIngredient(ingredient.id)}
											onMouseEnter={(e) => {
												e.currentTarget.style.background = 'var(--surface-hover)';
											}}
											onMouseLeave={(e) => {
												e.currentTarget.style.background = 'var(--surface-ground)';
											}}
										>
											<Checkbox
												checked={selectedIngredients.has(ingredient.id)}
												onChange={() => handleToggleIngredient(ingredient.id)}
												style={{ marginRight: '1rem' }}
											/>
											<div style={{ flex: 1 }}>
												<div style={{ fontWeight: 500, color: 'var(--text-color)' }}>
													{ingredient.name}
												</div>
												{amount(ingredient).text && (
													<div style={{ fontSize: '0.9rem', color: 'var(--text-color-secondary)' }}>
														{amount(ingredient).text}
													</div>
												)}
											</div>
										</div>
									))}
								</>
							)}
						</div>
					))}
				</div>
			</div>
		</Dialog>
	</>
  );
};

export default RecetteDesc;
