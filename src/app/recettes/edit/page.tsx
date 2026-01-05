"use client";
import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/config/firebase';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { Breadcrumb } from '@/components/layout';
import type { Recipe, RecipePart } from '@/types/recipe.types';
import './edit-recette.css';

function EditRecetteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams?.get('id');

  const [recette, setRecette] = useState<Recipe | null>(null);
  const [title, setTitle] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [preparationTime, setPreparationTime] = useState<number>(0);
  const [cookingTime, setCookingTime] = useState<number>(0);
  const [video, setVideo] = useState<string>('');
  const [images, setImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [imageURLs, setImageURLs] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [recipeParts, setRecipeParts] = useState<RecipePart[]>([]);

  // Fetch the recette data from Firestore
  const getRecette = async (id: string) => {
    const recetteRef = doc(db, 'recipes', id);

    try {
      const recetteSnap = await getDoc(recetteRef);

      if (!recetteSnap.exists()) {
        console.log("Pas de recette trouvée avec cet ID");
        return;
      }

      const recetteData = recetteSnap.data() as Recipe;

      setRecette(recetteData);
      setTitle(recetteData.title);
      setType(recetteData.type);
      setPreparationTime(recetteData.preparationTime);
      setCookingTime(recetteData.cookingTime);
      setVideo(recetteData.video || '');
      setImageURLs(recetteData.images || []);

      // Gérer recipeParts : si la recette a des recipeParts, les utiliser
      // Sinon, créer un recipePart par défaut
      if (recetteData.recipeParts && recetteData.recipeParts.length > 0) {
        setRecipeParts(recetteData.recipeParts);
      } else {
        // Si pas de recipeParts, créer un par défaut
        const defaultRecipePart: RecipePart = {
          title: recetteData.title || 'Recette',
          steps: [],
          ingredients: []
        };
        setRecipeParts([defaultRecipePart]);
      }
    } catch (error) {
      console.error("Erreur lors de la récupération de la recette :", error);
    }
  };

  useEffect(() => {
    if (id) {
      getRecette(id);
    }
  }, [id]);

  // Handle form submission to update the recipe
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!id || !recette) return;

    // Préserver les champs existants qui ne sont pas modifiés dans ce formulaire
    const updatedRecette: Partial<Recipe> & { selectedIngredients?: string[] } = {
      title,
      type,
      preparationTime,
      cookingTime,
      recipeParts: recipeParts,
      video,
      images: imageURLs,
      // Préserver les champs existants
      position: recette.position || '',
      selectedIngredients: (recette as any).selectedIngredients || [],
      createdBy: recette.createdBy,
      createdAt: recette.createdAt,
    };

    const recetteRef = doc(db, 'recipes', id);

    try {
      await updateDoc(recetteRef, updatedRecette);
      router.back();
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la recette :", error);
    }
  };

  // Fonctions pour gérer les recipeParts
  const addRecipePart = () => {
    setRecipeParts([...recipeParts, {
      title: `Partie ${recipeParts.length + 1}`,
      steps: [],
      ingredients: []
    }]);
  };

  const removeRecipePart = (partIndex: number) => {
    if (recipeParts.length > 1) {
      setRecipeParts(recipeParts.filter((_, i) => i !== partIndex));
    }
  };

  const updateRecipePartTitle = (partIndex: number, title: string) => {
    const updatedParts = [...recipeParts];
    updatedParts[partIndex] = {
      ...updatedParts[partIndex],
      title
    };
    setRecipeParts(updatedParts);
  };

  // Fonctions pour gérer les steps d'une partie spécifique
  const addStep = (partIndex: number) => {
    const updatedParts = [...recipeParts];
    updatedParts[partIndex] = {
      ...updatedParts[partIndex],
      steps: [...(updatedParts[partIndex].steps || []), '']
    };
    setRecipeParts(updatedParts);
  };

  const handleStepChange = (partIndex: number, stepIndex: number, value: string) => {
    const updatedParts = [...recipeParts];
    const updatedSteps = [...(updatedParts[partIndex].steps || [])];
    updatedSteps[stepIndex] = value;
    updatedParts[partIndex] = {
      ...updatedParts[partIndex],
      steps: updatedSteps
    };
    setRecipeParts(updatedParts);
  };

  const removeStep = (partIndex: number, stepIndex: number) => {
    const updatedParts = [...recipeParts];
    updatedParts[partIndex] = {
      ...updatedParts[partIndex],
      steps: (updatedParts[partIndex].steps || []).filter((_, i) => i !== stepIndex)
    };
    setRecipeParts(updatedParts);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Valider les fichiers avant de les ajouter
    const newImages: File[] = Array.from(e.target.files || []);

    // Filtrer les fichiers valides (images uniquement)
    const validImages = newImages.filter(file => {
      if (!file.type.startsWith('image/')) {
        console.warn(`${file.name} n'est pas une image. Fichier ignoré.`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB max
        console.warn(`${file.name} dépasse 5MB. Fichier ignoré.`);
        return false;
      }
      return true;
    });

    setImages((prevImages) => [...prevImages, ...validImages]);
    setSuccessMessage(`${validImages.length} image(s) sélectionnée(s)`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleUpload = async () => {
    if (images.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    const urls: string[] = [];
    let completedUploads = 0;

    // Télécharger les nouvelles images
    for (let image of images) {
      // Créer un nom unique pour éviter les conflits
      const timestamp = Date.now();
      const fileName = `${timestamp}_${image.name}`;
      const storageRef = ref(storage, `recipes/${title}/${fileName}`);
      const uploadTask = uploadBytesResumable(storageRef, image);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            // Mettre à jour la progression
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(Math.round(progress));
          },
          (error) => {
            console.error("Upload failed:", error);
            setSuccessMessage(`❌ Erreur: ${error.message}`);
            reject(error);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              urls.push(downloadURL);
              completedUploads++;
              setUploadProgress((completedUploads / images.length) * 100);
              resolve();
            } catch (error) {
              console.error("Erreur lors de la récupération de l'URL:", error);
              reject(error);
            }
          }
        );
      });
    }

    // Ajouter les nouvelles URLs aux anciennes
    setImageURLs((prevURLs) => [...prevURLs, ...urls]);
    setImages([]); // Réinitialiser la liste des images à uploader
    setUploading(false);
    setUploadProgress(0);
    setSuccessMessage(`✅ ${urls.length} image(s) uploadée(s) avec succès!`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const removeSelectedImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleImageDelete = async (imageURL: string) => {
    const imageRef = ref(storage, imageURL);
    try {
      await deleteObject(imageRef);
      setImageURLs(imageURLs.filter((url) => url !== imageURL));
    } catch (error) {
      console.error("Erreur lors de la suppression de l'image :", error);
    }
  };

  const typeOptions = [
    { name: 'Entrée', value: 'Entrée' },
    { name: 'Plat', value: 'Plat' },
    { name: 'Dessert', value: 'Dessert' }
  ];

  return (
    <div className="edit-recette">
      <Breadcrumb />
      <h1>Editer la recette</h1>
      {recette && (
        <div>
          <form onSubmit={handleSubmit} className="form-recette">
            <div>
              <section className="form-recette-section-text">
                <div className="form-field">
                  <label htmlFor="title">*Titre:</label>
                  <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="recipe-parts-section">
                  <h3>*Parties de la recette:</h3>
                  {recipeParts.map((part, partIndex) => (
                    <div key={partIndex} className="recipe-part-container" style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <input
                          type="text"
                          value={part.title}
                          onChange={(e) => updateRecipePartTitle(partIndex, e.target.value)}
                          placeholder="Titre de la partie"
                          style={{ flex: 1, marginRight: '1rem', padding: '0.5rem' }}
                          required
                        />
                        {recipeParts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRecipePart(partIndex)}
                            className="btn-delete-step"
                            title="Supprimer cette partie"
                          >
                            🗑️ Supprimer la partie
                          </button>
                        )}
                      </div>
                      <div className="steps-section">
                        <h4>Étapes de préparation:</h4>
                        {(part.steps || []).map((step, stepIndex) => (
                          <div key={stepIndex} className="step-container">
                            <input
                              type="text"
                              value={step}
                              onChange={(e) => handleStepChange(partIndex, stepIndex, e.target.value)}
                              placeholder={`Étape ${stepIndex + 1}`}
                              required
                            />
                            <button
                              type="button"
                              onClick={() => removeStep(partIndex, stepIndex)}
                              className="btn-delete-step"
                              title="Supprimer cette étape"
                            >
                              ❌
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addStep(partIndex)}
                          className="btn-add-step"
                        >
                          + Ajouter une étape
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addRecipePart}
                    className="btn-add-step"
                    style={{ marginTop: '1rem' }}
                  >
                    + Ajouter une partie
                  </button>
                </div>

                <div className="form-field">
                  <label htmlFor="type">*Type:</label>
                  <select
                    id="type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    required
                  >
                    <option value="">Sélectionner un type</option>
                    {typeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="preparationTime">*Temps de préparation (minutes):</label>
                  <input
                    type="number"
                    id="preparationTime"
                    value={preparationTime}
                    onChange={(e) => setPreparationTime(parseInt(e.target.value) || 0)}
                    min="0"
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="cookingTime">*Temps de cuisson (minutes):</label>
                  <input
                    type="number"
                    id="cookingTime"
                    value={cookingTime}
                    onChange={(e) => setCookingTime(parseInt(e.target.value) || 0)}
                    min="0"
                    required
                  />
                </div>
              </section>

              <section className="form-recette-section-media">
                <div className="form-field">
                  <label htmlFor="video">Vidéo:</label>
                  <input
                    type="text"
                    id="video"
                    value={video}
                    onChange={(e) => setVideo(e.target.value)}
                    placeholder="ex: https://youtube.com/watch?v=..."
                  />
                </div>

                {/* Section Messages de succès/erreur */}
                {successMessage && (
                  <div className="success-message-banner">
                    {successMessage}
                  </div>
                )}

                <div className="form-recette-image">
                  <h3>📸 Ajouter des images</h3>
                  <p className="image-info">Max 5MB par image • Formats: JPG, PNG, WebP</p>

                  <div className="file-upload-area">
                    <label htmlFor="file-input" className="file-upload-label">
                      <span className="file-icon">📁</span>
                      <p>Cliquez pour sélectionner des images ou glissez-les ici</p>
                    </label>
                    <input
                      id="file-input"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileChange}
                      className="file-input"
                    />
                  </div>

                  {/* Afficher les images sélectionnées (avant upload) */}
                  {images.length > 0 && (
                    <div className="selected-images-section">
                      <h4>Images sélectionnées ({images.length}):</h4>
                      <div className="selected-images-grid">
                        {images.map((image, index) => (
                          <div key={index} className="selected-image-item">
                            <div className="selected-image-preview">
                              <img
                                src={URL.createObjectURL(image)}
                                alt={`Selected ${index + 1}`}
                              />
                            </div>
                            <small className="image-name">
                              {image.name.substring(0, 10)}...
                            </small>
                            <button
                              type="button"
                              onClick={() => removeSelectedImage(index)}
                              className="btn-remove-selected"
                              title="Supprimer cette image"
                            >
                              ❌
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={handleUpload}
                        disabled={uploading || images.length === 0}
                        className="btn-upload"
                      >
                        {uploading ? `📤 Upload... ${uploadProgress}%` : "📤 Uploader les images"}
                      </button>
                    </div>
                  )}

                  {/* Afficher les images existantes (après upload) */}
                  {imageURLs.length > 0 && (
                    <div className="uploaded-images-section">
                      <h3>✅ Images uploadées ({imageURLs.length}):</h3>
                      <section className="uploaded-images-grid">
                        {imageURLs.map((url, index) => (
                          <div key={index} className="uploaded-image-item">
                            <div className="uploaded-image-preview">
                              <img
                                src={url}
                                alt={`Recipe ${index + 1}`}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleImageDelete(url)}
                              className="btn-delete-image"
                            >
                              🗑️ Supprimer
                            </button>
                          </div>
                        ))}
                      </section>
                    </div>
                  )}
                </div>

                <div className="form-submit-section">
                  <button type="submit" className="btn-submit">
                    💾 Sauvegarder les modifications
                  </button>
                </div>
              </section>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function EditRecettePage() {
  return (
    <Suspense fallback={<div className="loading-fallback">Chargement...</div>}>
      <EditRecetteContent />
    </Suspense>
  );
}
