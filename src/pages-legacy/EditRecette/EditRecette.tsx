import React, { useEffect, useState } from 'react';
import './EditRecette.css';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, updateDoc } from '@firebase/firestore';
import { db, storage } from '@/lib/config/firebase';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from 'primereact/inputnumber';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';


interface Recette{
  id: string;
  title: string;
  type: string;
  cookingTime: number;
  preparationTime: number;
  ingredients: Ingredient[];
  video: string;
  steps: string[];
  position: string;
  images?: string[];
}

interface Ingredient {
  id: string;
  name: string;
  quantity: string;
  unit: string;
}

const EditRecette: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams?.get('id');

  const [recette, setRecette] = useState<Recette | null>(null);
  const [title, setTitle] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [preparationTime, setPreparationTime] = useState<number>(0);
  const [cookingTime, setCookingTime] = useState<number>(0);
  const [steps, setSteps] = useState<string[]>([]);
  const [video, setVideo] = useState<string>('');
  const [images, setImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [imageURLs, setImageURLs] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Fetch the recette data from Firestore
  const getRecette = async (id: string) => {
	const recetteRef = doc(db, 'recipes', id);

	try {
	  const recetteSnap = await getDoc(recetteRef);

	  if (!recetteSnap.exists()) {
		console.log("Pas de recette trouvée avec cet ID");
		return;
	  }

	  const recetteData = recetteSnap.data() as Recette;

	  setRecette(recetteData);
	  setTitle(recetteData.title);
	  setType(recetteData.type);
	  setPreparationTime(recetteData.preparationTime);
	  setCookingTime(recetteData.cookingTime);
	  setSteps(recetteData.steps);
	  setVideo(recetteData.video || '');
	  setImageURLs(recetteData.images || []);

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

	if (!id) return;

	const updatedRecette = {
	  title,
	  type,
	  preparationTime,
	  cookingTime,
	  steps,
	  video,
	  images: imageURLs,
	};

	const recetteRef = doc(db, 'recipes', id);

	try {
	  await updateDoc(recetteRef, updatedRecette);
	  router.back();
	} catch (error) {
	  console.error("Erreur lors de la mise à jour de la recette :", error);
	}
  };

  const addStep = () => setSteps([...steps, '']);
  const handleStepChange = (index: number, value: string) => {
	const updatedSteps = [...steps];
	updatedSteps[index] = value;
	setSteps(updatedSteps);
  };
  const removeStep = (index: number) => setSteps(steps.filter((_, i) => i !== index));


  const handleFileChange = (e: { target: { files: any; }; }) => {
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

  return (
	<div className="EditRecette">
	  <h1>Editer la recette</h1>
	  {recette && (
		<div>
		  <form onSubmit={handleSubmit} className="formRecette">
			<div>
			  <section className="formRecette_sectionText">
				<div>
				  <label htmlFor="title">*Titre:</label>
				  <InputText
					type="text"
					id="title"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
				  />
				</div>
				<div className="steps-section">
				  <h3>*Étapes de préparation:</h3>
				  {steps.map((step, index) => (
					<div key={index} className="step-container">
					  <InputText
						type="text"
						value={step}
						onChange={(e) => handleStepChange(index, e.target.value)}
						placeholder={`Étape ${index + 1}`}
						required
					  />
					  <Button type="button" onClick={() => removeStep(index)} className="delete-step-btn">
						❌
					  </Button>
					</div>
				  ))}
				  <Button type="button" onClick={addStep} className="add-step-btn">+ Ajouter une étape</Button>
				</div>

				<div>
				  <label htmlFor="type">*Type:</label>
				  <Dropdown
					id="type"
					value={type}
					options={[{ name: 'Entrée', id: '1' }, { name: 'Plat', id: '2' }, {name: 'Dessert', id: '3'}]} // Exemple d'options
					onChange={(e) => setType(e.value)}
					optionLabel="name"
					optionValue="id"
				  />
				</div>

				<div>
				  <label htmlFor="preparationTime">*Temps de préparation:</label>
				  <InputNumber
					id="preparationTime"
					value={preparationTime}
					onChange={(e) => setPreparationTime(e.value ?? 0)}
				  />
				</div>
				<div>
				  <label htmlFor="cookingTime">*Temps de cuisson:</label>
				  <InputNumber
					id="cookingTime"
					value={cookingTime}
					onChange={(e) => setCookingTime(e.value ?? 0)}
				  />
				</div>
			  </section>

			  <section className="formRecette_sectionMedia">
				<div>
				  <label htmlFor="video">Vidéo:</label>
				  <InputText
					type="text"
					id="video"
					value={video}
					onChange={(e) => setVideo(e.target.value)}
					placeholder="ex: https://youtube.com/watch?v=..."
				  />
				</div>

				{/* Section Messages de succès/erreur */}
				{successMessage && (
				  <div style={{ padding: '10px', marginBottom: '15px', backgroundColor: '#f0f9ff', borderLeft: '4px solid #0066cc', borderRadius: '4px' }}>
					{successMessage}
				  </div>
				)}

				<div className='formRecette_image'>
				  <h3>📸 Ajouter des images</h3>
				  <p style={{ fontSize: '0.9em', color: '#666' }}>Max 5MB par image • Formats: JPG, PNG, WebP</p>

				  <div style={{ marginBottom: '15px', padding: '15px', border: '2px dashed #ccc', borderRadius: '8px', backgroundColor: '#fafafa' }}>
					<label htmlFor="file-input" style={{ cursor: 'pointer', display: 'block', textAlign: 'center' }}>
					  <span style={{ fontSize: '2em' }}>📁</span>
					  <p>Cliquez pour sélectionner des images ou glissez-les ici</p>
					</label>
					<input
					  id="file-input"
					  type="file"
					  multiple
					  accept="image/*"
					  onChange={handleFileChange}
					  style={{ display: 'none' }}
					/>
				  </div>

				  {/* Afficher les images sélectionnées (avant upload) */}
				  {images.length > 0 && (
					<div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#fffacd', borderRadius: '4px' }}>
					  <h4>Images sélectionnées ({images.length}):</h4>
					  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
						{images.map((image, index) => (
						  <div key={index} style={{ position: 'relative', textAlign: 'center' }}>
							<div style={{ width: '80px', height: '80px', overflow: 'hidden', borderRadius: '4px', border: '1px solid #ddd' }}>
							  <img
								src={URL.createObjectURL(image)}
								alt={`Selected ${index + 1}`}
								style={{ width: '100%', height: '100%', objectFit: 'cover' }}
							  />
							</div>
							<small style={{ display: 'block', marginTop: '5px', wordBreak: 'break-word' }}>
							  {image.name.substring(0, 10)}...
							</small>
							<Button
							  type="button"
							  onClick={() => removeSelectedImage(index)}
							  style={{ marginTop: '5px', padding: '4px 8px', fontSize: '0.8em' }}
							  className="p-button-sm p-button-danger"
							>
							  ❌
							</Button>
						  </div>
						))}
					  </div>
					  <Button
						onClick={handleUpload}
						disabled={uploading || images.length === 0}
						style={{ marginTop: '10px', width: '100%' }}
						className="p-button-success"
					  >
						{uploading ? `📤 Upload... ${uploadProgress}%` : "📤 Uploader les images"}
					  </Button>
					</div>
				  )}

				  {/* Afficher les images existantes (après upload) */}
				  {imageURLs.length > 0 && (
					<div className="uploaded-images">
					  <h3>✅ Images uploadées ({imageURLs.length}):</h3>
					  <section className="recette-images" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '10px' }}>
						{imageURLs.map((url, index) => (
						  <div key={index} className="image-container" style={{ textAlign: 'center' }}>
							<div style={{ width: '120px', height: '120px', overflow: 'hidden', borderRadius: '8px', border: '1px solid #ddd' }}>
							  <img
								src={url}
								alt={`Recipe ${index + 1}`}
								style={{ width: '100%', height: '100%', objectFit: 'cover' }}
							  />
							</div>
							<Button
							  type="button"
							  onClick={() => handleImageDelete(url)}
							  className="delete-image-btn p-button-sm p-button-danger"
							  style={{ marginTop: '8px', width: '100%' }}
							>
							  🗑️ Supprimer
							</Button>
						  </div>
						))}
					  </section>
					</div>
				  )}
				</div>

				<div style={{ marginTop: '20px' }}>
				  <Button type="submit" className="p-button-lg" style={{ width: '100%' }}>
					💾 Sauvegarder les modifications
				  </Button>
				</div>
			  </section>
			</div>
		  </form>
		</div>
	  )}
	</div>
  );
};

export default EditRecette;
