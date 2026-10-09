"use client";
import React, { useEffect, useState, useRef } from 'react';
import { DEPARTEMENT_NAMES } from '@/constants/departements';
import './RecetteDesc.css';
import VideoEmbed from '@/components/ui/VideoEmbed/VideoEmbed';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader/SkeletonLoader';
import Image from 'next/image';
import { isOptimizableImage } from '@/lib/utils/image';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { getRecipeUrl } from '@/lib/utils/recipe-url';
import { formatAmount, type UnitDef } from '@/lib/utils/units';
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
	const amount = (ing: Ingredient) => formatAmount(ing.quantity, unitIndex, { unit: ing.unit, unitId: ing.unitId, factor });

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
			<div className="recette-desc-button-container">
				<div className="recette-desc-button-container-left">
					<Button
						icon="pi pi-arrow-left"
						onClick={() => router.back()}
						className="p-button-text"
						tooltipOptions={{ position: 'bottom' }}
					/>
					<Button
						icon="pi pi-home"
						onClick={() => router.push("/recettes/")}
						className="p-button-text"
						tooltipOptions={{ position: 'bottom' }}
					/>
					<Button
						icon={hasLiked ? 'pi pi-heart-fill' : 'pi pi-heart'}
						label={likesCount > 0 ? String(likesCount) : undefined}
						aria-label={hasLiked ? 'Ne plus aimer cette recette' : 'Aimer cette recette'}
						onClick={handleLike}
						className="p-button-text"
						severity={hasLiked ? 'danger' : 'info'}
						tooltipOptions={{ position: 'bottom' }}
					/>
					{user && (
						<Button
							icon={isInToDo ? 'pi pi-check-circle' : 'pi pi-bookmark'}
							onClick={isInToDo ? handleRemoveFromToDo : handleAddToToDo}
							className="p-button-text"
							severity={isInToDo ? 'success' : 'info'}
							loading={checkingToDo}
							tooltip={isInToDo ? 'Retirer de "à faire"' : 'Ajouter à "à faire"'}
							tooltipOptions={{ position: 'bottom' }}
						/>
					)}
					<Button
						icon="pi pi-share-alt"
						onClick={handleShare}
						className="p-button-text"
						tooltip="Partager cette recette"
						tooltipOptions={{ position: 'bottom' }}
					/>
					<Button
						icon="pi pi-download"
						onClick={handleDownloadPDF}
						className="p-button-text"
						loading={isExporting}
						disabled={isExporting}
						tooltip="Télécharger en PDF"
						tooltipOptions={{ position: 'bottom' }}
					/>
					<Button
						icon="pi pi-print"
						onClick={handlePrintRecipe}
						className="p-button-text"
						tooltip="Imprimer la recette"
						tooltipOptions={{ position: 'bottom' }}
					/>
					</div>
				{role === 'admin' && (
				<div className="recette-desc-admin-buttons">
					<Button
						icon="pi pi-pencil"
						onClick={() => router.push(`/recettes/edit?id=${id}`)}
						className="p-button-text"
					/>
					<Button
						icon="pi pi-trash"
						onClick={confirmDelete}
						className="p-button-text p-button-danger"
					/>
				</div>
				)}
			</div>

			{recette ? (
				<>
					<h1 className="recette-desc-title">{recette.title}</h1>

					{/* Creator Info */}
					{recette.createdBy && authorName && (
						<div className="recette-creator-info">
							<p>
								Créée par <a href={`/profil?id=${recette.createdBy}`} className="creator-link">
									{authorName}
								</a>
							</p>
						</div>
					)}

					{/* Affichage de la note moyenne en haut */}
					<div className="recette-overall-rating">
						{averageRating && (
							<div className="recette-average-rating-display">
								<Rating value={parseFloat(averageRating)} readOnly cancel={false} />
								<span className="rating-text">{averageRating} / 5 ({reviews.length} avis)</span>
							</div>
						)}
						{!averageRating && (
							<p className="no-rating-text">Aucun avis pour le moment</p>
						)}
					</div>
				</>
			) : (
				<>
					<SkeletonLoader type="text" height="32px" width="60%" style={{ marginBottom: '16px' }} />
					<SkeletonLoader type="text" height="20px" width="40%" />
				</>
			)}

			<div className="recette-desc-description">
				<div className="recette-desc-info">
				<div className="recette-desc-info-left">
					<p>
					<strong>Type:</strong> {recette?.type}
					</p>
					{recette?.position && (
					<div className="recette-desc-position">
						<p>
						<strong>Departement:</strong> {departements.get(recette.position) || "Inconnu"}
						</p>
					</div>
					)}
					<div className="recette-desc-timing">
					<p>
						<i className="pi pi-clock"></i>
						<strong>Temps de préparation:</strong> {recette?.preparationTime} min
					</p>
					<p>
						<i className="pi pi-hourglass"></i>
						<strong>Temps de cuisson:</strong> {recette?.cookingTime} min
					</p>
					<p>
						<i className="pi pi-users"></i>
						<strong>Quantités pour :</strong>{' '}
						{baseServings
							? `${baseServings} personne${baseServings > 1 ? 's' : ''}`
							: 'nombre de personnes non précisé'}
					</p>
					</div>
					{recette?.video && (
					<h3 className='recette-desc-video'>
						<strong>Vidéo associée :</strong>
						<VideoEmbed url={recette.video} />
					</h3>
					)}
				</div>
				<div className="recette-desc-info-right">
					{recette?.images && recette.images.length > 0 && (
					<div className="recette-desc-gallery">
						<div className="recette-desc-main-image">
						<Image
							src={recette.images[currentImageIndex]}
							alt={`${recette.title} - Image ${currentImageIndex + 1}`}
							width={600}
							height={400}
							priority={currentImageIndex === 0}
							sizes="(max-width: 768px) 100vw, 50vw"
							unoptimized={!isOptimizableImage(recette.images[currentImageIndex])}
						/>
						</div>
						{recette.images.length > 1 && (
						<div className="recette-desc-thumbnails">
							{recette.images.map((image, index) => (
							<div
								key={index}
								className={`recette-desc-thumbnail ${index === currentImageIndex ? 'active' : ''}`}
								onClick={() => handleImageClick(index)}
							>
								<Image
								src={image}
								alt={`${recette.title} - Thumbnail ${index + 1}`}
								width={100}
								height={100}
								sizes="100px"
								unoptimized={!isOptimizableImage(image)}
								/>
							</div>
							))}
						</div>
						)}
					</div>
					)}
				</div>
				</div>
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
				{recette?.recipeParts.map((part, index) => (
				<div key={index} className="recette-desc-part">
					<h2>{part.title}</h2>
					<section>
					<div className="recette-desc-part-ingredients">
						<h3>Ingrédients</h3>
						<ul>
						{part.ingredients.map((ingredient, idx) => (
							<li key={idx}>
							<p>
								{ingredient.name}
								{amount(ingredient).text && (
									<> - <span className={factor !== 1 ? 'recette-desc-quantity-scaled' : undefined}>{amount(ingredient).text}</span></>
								)}
							</p>
							</li>
						))}
						</ul>
					</div>

					<div className="recette-desc-part-steps">
						<h3>Étapes de préparation</h3>
						<ol>
						{part.steps.map((step, idx) => (
							<li key={idx}>
							<h4>{step}</h4>
							</li>
						))}
						</ol>
					</div>
					</section>
				</div>
				))}
			</div>
			<div className="recette-reviews-section">
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
