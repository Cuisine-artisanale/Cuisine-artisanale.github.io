"use client";
import React, { useEffect, useState, useRef } from 'react';
import './RecetteDesc.css';
import { VideoEmbed, SkeletonLoader } from '@/components/ui';
import Image from 'next/image';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getRecipeUrl } from '@/lib/utils/recipe-url';
import { doc, getDoc, deleteDoc, onSnapshot, query, where, getDocs, collection, orderBy, serverTimestamp, addDoc, updateDoc } from '@firebase/firestore';
import { db } from '@/lib/config/firebase';
import { Button } from 'primereact/button';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { toggleLikeRecipes, unlikeRecipes, countRecipeLikes, hasUserLikedRecipe, getSimilarRecipes } from '@/lib/services/recipe.service';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import { Rating } from 'primereact/rating';
import { InputTextarea } from 'primereact/inputtextarea';
import { shareRecipe } from '@/lib/services/share.service';
import { exportRecipePDF, printRecipe } from '@/lib/services/export.service';
import RecipeMetadata from '@/app/recettes/recipe-metadata';
import type { Recipe, RecipePart, Ingredient } from '@/types';
import {
  addRecipeToDo,
  isRecipeInToDo,
  removeRecipeToDo,
  addIngredientsToShoppingList
} from '@/lib/services/shopping.service';
import { Dialog } from 'primereact/dialog';
import { Checkbox } from 'primereact/checkbox';

interface RecetteDescProps {
	recipeId?: string;
}

const RecetteDesc: React.FC<RecetteDescProps> = ({ recipeId: propRecipeId }) => {
	const [id, setId] = useState<string | null>(null);
	const searchParams = useSearchParams();
	const queryRecipeId = searchParams?.get('id');
	const recipeId = propRecipeId || queryRecipeId;
	const router = useRouter();
	const {role, user} = useAuth();
	const { showToast } = useToast();
	const [likesCount, setLikesCount] = useState<number>(0);
	const [hasLiked, setHasLiked] = useState<boolean>(false);
	const userId = user?.uid;
	const [recette, setRecette] = React.useState<Recipe | null>(null);
	const [departements, setDepartements] = useState<Map<string, string>>(new Map());
	const [currentImageIndex, setCurrentImageIndex] = useState(0);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	const [reviews, setReviews] = useState<any[]>([]);
	const [newReview, setNewReview] = useState('');
	const [newRating, setNewRating] = useState<number | null>(null);
	const [similarRecipes, setSimilarRecipes] = useState<any[]>([]);
	const [loadingSimilar, setLoadingSimilar] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const [creatorInfo, setCreatorInfo] = useState<any>(null);
	const [isInToDo, setIsInToDo] = useState<boolean>(false);
	const [showAddIngredientsDialog, setShowAddIngredientsDialog] = useState(false);
	const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(new Set());
	const [checkingToDo, setCheckingToDo] = useState(false);


	const getRecetteById = async (docId: string) => {
		try {
			const recetteRef = doc(db, "recipes", docId);
			const recetteSnap = await getDoc(recetteRef);

			if (!recetteSnap.exists()) {
				console.log("Pas de recette trouvée avec cet ID");
				return;
			}

			const recetteData = recetteSnap.data() as Recipe;
			setId(docId);

			// Traitement des ingrédients pour chaque partie
			const updatedRecipeParts = await Promise.all(
				recetteData.recipeParts.map(async (part) => {
				const ingredientsDetails = await Promise.all(
					part.ingredients.map(async (ingredient) => {
					const ingredientRef = doc(db, 'ingredients', ingredient.id);
					const ingredientSnap = await getDoc(ingredientRef);

					if (ingredientSnap.exists()) {
						const ingredientData = ingredientSnap.data();
						return {
						id: ingredient.id,
						name: ingredientData.name,
						quantity: ingredient.quantity,
						unit: ingredientData.unit,
						};
					} else {
						console.warn(`Ingrédient avec l'ID ${ingredient.id} introuvable`);
						return null;
					}
					})
				);

				const filteredIngredients = ingredientsDetails.filter((ing) => ing !== null);
				return {
					...part,
					ingredients: filteredIngredients
				};
				})
			);

			setRecette({ ...recetteData, recipeParts: updatedRecipeParts });
		} catch (error) {
			console.error("Erreur lors de la récupération de la recette :", error);
		}
	};

	useEffect(() => {
		if (recipeId){
			getRecetteById(recipeId);
		}
	}, [recipeId]);

	// Vérifier si la recette est dans "à faire"
	useEffect(() => {
		const checkRecipeInToDo = async () => {
			if (!userId || !id) {
				setIsInToDo(false);
				return;
			}
			try {
				const inToDo = await isRecipeInToDo(userId, id);
				setIsInToDo(inToDo);
			} catch (error) {
				console.error("Error checking if recipe is in to do:", error);
			}
		};
		checkRecipeInToDo();
	}, [userId, id]);

	useEffect(() => {
		const fetchCreatorInfo = async () => {
			if (!recette?.createdBy) return;
			try {
				const creatorRef = doc(db, "users", recette.createdBy);
				const creatorSnap = await getDoc(creatorRef);
				if (creatorSnap.exists()) {
					setCreatorInfo(creatorSnap.data());
				}
			} catch (error) {
				console.error("Error fetching creator info:", error);
			}
		};
		fetchCreatorInfo();
	}, [recette?.createdBy]);

	useEffect(() => {
		fetch("https://geo.api.gouv.fr/departements")
			.then(res => res.json())
			.then(data => {
				const departementMap: Map<string, string> = new Map(data.map((dep: { code: string; nom: string }) => [dep.code, dep.nom]));
				setDepartements(departementMap);
			});
	}, []);


	useEffect(() => {
		if (!id) return;

		// Écouter les changements dans la collection likes pour cette recette
		const likesRef = collection(db, "likes");
		const q = query(likesRef, where("recetteId", "==", id));

		const unsubscribe = onSnapshot(q, (snapshot) => {
			setLikesCount(snapshot.size);

			// Vérifier si l'utilisateur actuel a liké
			if (userId) {
				const userLiked = snapshot.docs.some(doc => doc.data().userId === userId);
				setHasLiked(userLiked);
			} else {
				setHasLiked(false);
			}
		});

		return () => unsubscribe();
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

	useEffect(() => {
		if (!recette) return;

		// Calculate total time
		const totalMinutes = recette.preparationTime + recette.cookingTime;
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		const totalTimeStr = hours > 0
			? `PT${hours}H${minutes}M`
			: `PT${minutes}M`;

		// Build structured data with ratings
		const structuredData: any = {
			"@context": "https://schema.org",
			"@type": "Recipe",
			"name": recette.title,
			"image": recette.images?.[0] || "",
			"description": `Recette de ${recette.title} - Type: ${recette.type}`,
			"author": {
				"@type": "Person",
				"name": user?.displayName || "Cuisine Artisanale"
			},
			"recipeCuisine": departements.get(recette.position) || "France",
			"recipeCategory": recette.type,
			"prepTime": `PT${recette.preparationTime}M`,
			"cookTime": `PT${recette.cookingTime}M`,
			"totalTime": totalTimeStr,
			"recipeIngredient": recette.recipeParts.flatMap(part =>
				part.ingredients.map(ing => `${ing.quantity} ${ing.unit} ${ing.name}`)
			),
			"recipeInstructions": recette.recipeParts.flatMap(part =>
				part.steps.map(step => ({
					"@type": "HowToStep",
					"text": step
				}))
			)
		};

		// Add rating if reviews exist
		const averageRatingValue = reviews.length > 0
			? (reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)
			: null;

		if (averageRatingValue && parseFloat(averageRatingValue) > 0) {
			structuredData.aggregateRating = {
				"@type": "AggregateRating",
				"ratingValue": averageRatingValue,
				"ratingCount": reviews.length.toString()
			};
		}

		// Add video if exists
		if (recette.video) {
			structuredData.video = {
				"@type": "VideoObject",
				"name": recette.title,
				"description": `Vidéo de la recette ${recette.title}`,
				"thumbnailUrl": recette.images?.[0] || "",
				"uploadDate": new Date().toISOString(),
				"contentUrl": recette.video
			};
		}

		// Supprime tout ancien script JSON-LD
		const oldScript = document.getElementById("jsonld-recipe");
		if (oldScript) oldScript.remove();

		// Crée et insère le nouveau script
		const script = document.createElement("script");
		script.id = "jsonld-recipe";
		script.type = "application/ld+json";
		script.innerHTML = JSON.stringify(structuredData);
		document.head.appendChild(script);

		return () => {
			const existing = document.getElementById("jsonld-recipe");
			if (existing) existing.remove();
		};
	}, [recette, departements, reviews, user?.displayName]);

	useEffect(() => {
		if (!id) return;

		const reviewsRef = collection(db, "reviews");
		const q = query(reviewsRef, where("recipeId", "==", id), orderBy("createdAt", "desc"));

		const unsubscribe = onSnapshot(q, (snapshot) => {
			const fetchedReviews = snapshot.docs.map(doc => ({
			id: doc.id,
			...doc.data()
			}));
			setReviews(fetchedReviews);
		});

		return () => unsubscribe();
	}, [id]);

	// Charger les recettes similaires
	useEffect(() => {
		const loadSimilarRecipes = async () => {
			if (!id) return;
			setLoadingSimilar(true);
			try {
				const similar = await getSimilarRecipes(id, 3);
				setSimilarRecipes(similar);
			} catch (error) {
				console.error("Erreur lors du chargement des recettes similaires:", error);
				setSimilarRecipes([]);
			} finally {
				setLoadingSimilar(false);
			}
		};

		loadSimilarRecipes();
	}, [id]);


	const handleImageClick = (index: number) => {
		setCurrentImageIndex(index);
		if (intervalRef.current) {
		clearInterval(intervalRef.current);
		}
	};

	const handleDelete = async () => {
		if (!id) return;
		try {
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
			if (hasLiked) {
				await unlikeRecipes(id, userId);
			} else {
				await toggleLikeRecipes(id, userId);
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
				title: recette.title,
				type: recette.type,
				preparationTime: recette.preparationTime,
				cookingTime: recette.cookingTime,
				position: recette.position,
				departementName: departements.get(recette.position),
				recipeParts: recette.recipeParts.map(part => ({
					title: part.title,
					ingredients: part.ingredients.map(ing => ({
						name: ing.name,
						quantity: ing.quantity ?? '',
						unit: ing.unit ?? ''
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
				title: recette.title,
				type: recette.type,
				preparationTime: recette.preparationTime,
				cookingTime: recette.cookingTime,
				position: recette.position,
				departementName: departements.get(recette.position),
				recipeParts: recette.recipeParts.map(part => ({
					title: part.title,
					ingredients: part.ingredients.map(ing => ({
						name: ing.name,
						quantity: ing.quantity ?? '',
						unit: ing.unit ?? ''
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
						allIngredients.push(ing);
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
			const reviewsRef = collection(db, "reviews");
			await addDoc(reviewsRef, {
				recipeId: id,
				userId,
				userName: user?.displayName || "Utilisateur",
				message: newReview.trim(),
				rating: newRating,
				createdAt: serverTimestamp(),
			});

			setNewReview('');
			setNewRating(null);
			showToast({
				severity: 'success',
				summary: 'Merci !',
				detail: 'Votre avis a été ajouté'
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
			await deleteDoc(doc(db, "reviews", id));
			setReviews((prev) => prev.filter((review) => review.id !== id));

			showToast({
				severity: 'success',
				summary: 'Suppr',
				detail: 'Avis supprimer'
			})
		} catch (error) {
			showToast({
				severity: 'error',
				summary: 'Erreur',
				detail: 'Avis pas supprimer'
			})
		}
	};

  return (
	<>
		{recette && (
			<RecipeMetadata
				recipeId={id || undefined}
				title={recette.title}
				type={recette.type}
				image={recette.images?.[0]}
			/>
		)}
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
					{recette.createdBy && creatorInfo && (
						<div className="recette-creator-info">
							<p>
								Créée par <a href={`/profil?id=${recette.createdBy}`} className="creator-link">
									{creatorInfo.displayName || "Utilisateur"}
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
							unoptimized={true}
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
								unoptimized={true}
								/>
							</div>
							))}
						</div>
						)}
					</div>
					)}
				</div>
				</div>
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
								{ingredient.name} - {ingredient.quantity} {ingredient.unit}
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
											{user && role == "admin" && (
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
										<small className="review-date">{r.createdAt?.toDate?.().toLocaleString?.() || ''}</small>
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
				{loadingSimilar ? (
					<p className="loading">Chargement des recettes similaires...</p>
				) : similarRecipes.length === 0 ? (
					<p className="no-similar">Pas d'autres recettes similaires disponibles</p>
				) : (
					<div className="similar-recipes-grid">
						{similarRecipes.map((recipe) => (
							<Link
								key={recipe.id}
								href={getRecipeUrl(recipe)}
								className="similar-recipe-card"
								onClick={() => {
									setId(recipe.id);
									window.scrollTo(0, 0);
								}}
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
										unoptimized={true}
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
												{(ingredient.quantity || ingredient.unit) && (
													<div style={{ fontSize: '0.9rem', color: 'var(--text-color-secondary)' }}>
														{ingredient.quantity} {ingredient.unit}
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
