import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { GoogleAuth } from "google-auth-library";
import { recipesData } from "./recipes";
import { ingredientsData } from "./ingredients";

import cors from "cors";

const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const corsHandler = cors({ origin: true });

admin.initializeApp();
const db = admin.firestore();

const INDEXING_API_URL =
	"https://indexing.googleapis.com/v3/urlNotifications:publish";

// Fonction pour notifier Google à la création d'une recette
export const notifyGoogleIndexingOnNewRecipe = onDocumentCreated(
	"recipes/{recipeId}",
	async (event) => {
		const recipe = event.data?.data();

		if (!recipe) {
			console.error("Snapshot vide ou recette introuvable");
			return;
		}

		// Crée le slug de l'URL de la recette
		const slug = recipe.title
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[^\w\s-]/g, "")
			.trim()
			.replace(/\s+/g, "-")
			.toLowerCase();

		const recipeUrl = `https://www.Cuisine-artisanale.fr/recettes/${slug}`;

		const serviceAccount = JSON.parse(process.env.GOOGLE_INDEXING_KEY || "{}");

		try {
			const auth = new GoogleAuth({
				keyFile: serviceAccount, // chemin vers ta clé JSON
				scopes: "https://www.googleapis.com/auth/indexing",
			});

			const client = await auth.getClient();

			const res = await client.request({
				url: INDEXING_API_URL,
				method: "POST",
				data: {
					url: recipeUrl,
					type: "URL_UPDATED", // URL nouvelle ou mise à jour
				},
			});

			console.log(`Indexing request envoyée pour ${recipeUrl}:`, res.data);
		} catch (error) {
			console.error("Erreur lors de la notification Google Indexing:", error);
		}
	}
);

// Définir les types des données Firestore
interface RecipeRequest {
	title: string;
}

const transporter = nodemailer.createTransport({
	host: "ssl0.ovh.net",
	port: 465,
	secure: true,
	auth: {
		user: process.env.EMAIL,
		pass: process.env.APP_PASSWORD,
	},
});

// Définition de la fonction avec les types Firebase pour event
export const sendEmailOnNewRecipeRequest = onDocumentUpdated(
	"recipesRequest/{objectId}",
	async (event) => {
		const newValue = event.data?.after.data() as RecipeRequest;
		if (!newValue) {
			console.error("Snapshot is undefined");
			return;
		}

		const name = newValue.title;

		const mailOptions = {
			from: "a.sabatier@cuisine-artisanale.fr",
			to: "ssabatieraymeric@gmail.com",
			subject: "Nouvelle demande de recette",
			text: `Une nouvelle demande de recette a été ajoutée : ${name}`,
		};

		try {
			await transporter.sendMail(mailOptions);
			console.log("Email envoyé !");
		} catch (error) {
			console.error("Erreur d'envoi d'email :", error);
		}
	}
);

export const sendWeeklyRecipeEmail = async (email: string) => {
	try {
		const weeklyRef = db.collection("weeklyRecipe").doc("current");
		const weeklySnap = await weeklyRef.get();

		if (!weeklySnap.exists) {
			throw new Error("Aucune recette de la semaine trouvée.");
		}

		const recipe = weeklySnap.data();

		// Crée le slug pour l’URL de la recette
		const slug = recipe.title
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[^\w\s-]/g, "")
			.trim()
			.replace(/\s+/g, "_")
			.toLowerCase();

		const recipeUrl = `https://www.Cuisine-artisanale.fr/recettes/${slug}`;

		// Lien de désabonnement
		const unsubscribeUrl = `https://www.Cuisine-artisanale.fr/unsubscribe?email=${encodeURIComponent(
			email
		)}`;

		const mailOptions = {
			from: "a.sabatier@cuisine-artisanale.fr",
			to: email,
			subject: `🍰 Votre recette de la semaine : ${recipe.title}`,
			html: `
		<div style="
			font-family: 'Segoe UI', sans-serif;
			background-color: #FFF9F5;
			color: #2C1810;
			padding: 24px;
			border-radius: 12px;
			max-width: 600px;
			margin: 0 auto;
			border: 1px solid #E8D5CC;
			box-shadow: 0 5px 15px rgba(44,24,16,0.08);
		">
			<h1 style="text-align:center; color:#8B4513; margin-top:0;">🍪 ${recipe.title
				}</h1>
			<p style="text-align:center; font-size:16px; color:#7D4F50;">Bonjour gourmand(e) !</p>

			<p style="font-size:15px; line-height:1.6; color:#2C1810;">
			Découvrez notre nouvelle recette ${recipe.type.toLowerCase()} de la semaine : simple, savoureuse et parfaite pour vos repas du dimanche 😋
			</p>

			<div style="text-align:center; margin:25px 0;">
			<img src="${recipe.images[0]}"
				alt="${recipe.title}"
				style="width:100%; max-width:480px; border-radius:10px; border:1px solid #E8D5CC;" />
			</div>

			<div style="text-align:center;">
			<a href="${recipeUrl}"
				style="
				background-color:#8B4513;
				color:#FFF;
				padding:12px 24px;
				border-radius:8px;
				text-decoration:none;
				font-weight:bold;
				display:inline-block;
				transition:background 0.3s;
				"
				onmouseover="this.style.backgroundColor='#A0522D';"
				onmouseout="this.style.backgroundColor='#8B4513';"
			>
				👉 Voir la recette complète
			</a>
			</div>

			<hr style="margin:30px 0; border:none; border-top:1px solid #E8D5CC;">

			<p style="font-size:14px; color:#7D4F50; text-align:center;">
			Vous recevez cet email car vous êtes inscrit(e) à la newsletter de
			<a href="https://www.aymeric-sabatier.fr/Cuisine-artisanale"
				style="color:#8B4513; text-decoration:none; font-weight:bold;">
				Cuisine Artisanale
			</a> 🍰
			<br/>
			<small>
				<a href="${unsubscribeUrl}"
				style="color:#A0522D; text-decoration:none;">
				Se désabonner
				</a>
			</small>
			</p>
		</div>
		`,
		};

		await transporter.sendMail(mailOptions);
		console.log("Email envoyé avec succès à", email);
	} catch (error) {
		console.error("Erreur lors de l'envoi de l'email :", error);
	}
};

// ------------------- Cron planifié (dimanche 09:00) -------------------
export const sendWeeklyRecipe = onSchedule(
	{
		schedule: "0 9 * * 0", // chaque dimanche à 09:00
		timeZone: "Europe/Paris", // fuseau horaire
	},
	async (event) => {
		try {
			// Sélectionner une recette aléatoire
			const recipesRef = db.collection("recipes");
			const snapshot = await recipesRef.get();
			const recipes = snapshot.docs.map(
				(doc: { id: any; data: () => any }) => ({ id: doc.id, ...doc.data() })
			);
			const randomRecipe = recipes[Math.floor(Math.random() * recipes.length)];

			// Mettre à jour la recette de la semaine dans Firestore
			const weeklyRef = db.collection("weeklyRecipe").doc("current");
			const today = new Date();
			const currentWeek = `${today.getFullYear()}-W${Math.ceil(
				(((today as any) - (new Date(today.getFullYear(), 0, 1) as any)) /
					86400000 +
					new Date(today.getFullYear(), 0, 1).getDay() +
					1) /
				7
			)}`;
			await weeklyRef.set({
				...randomRecipe,
				week: currentWeek,
				createdAt: admin.firestore.FieldValue.serverTimestamp(),
			});

			console.log("Recette de la semaine mise à jour :", randomRecipe.title);

			// Récupérer tous les abonnés depuis Firestore
			const subscribersSnap = await db
				.collection("abonnes")
				.where("subscribed", "==", true)
				.get();
			if (subscribersSnap.empty) {
				console.log("Aucun abonné trouvé pour la newsletter");
				return;
			}

			const subscribers = subscribersSnap.docs.map(
				(doc: { data: () => { (): any; new(): any; email: any } }) =>
					doc.data().email
			) as string[];

			// Envoyer l'email à chaque abonné
			for (const email of subscribers) {
				await sendWeeklyRecipeEmail(email);
			}

			console.log(
				"Emails de la recette de la semaine envoyés à tous les abonnés !"
			);
		} catch (err) {
			console.error("Erreur dans le cron de la recette de la semaine :", err);
		}
	}
);

export const unsubscribe = onRequest((req, res) => {
	corsHandler(req, res, async () => {
		const email = req.query.email as string;

		if (!email) {
			res.status(400).json({ success: false, message: "Email manquant" });
			return;
		}

		try {
			const abonnésRef = db.collection("abonnes");
			const snapshot = await abonnésRef.where("email", "==", email).get();

			if (snapshot.empty) {
				res
					.status(404)
					.json({ success: false, message: "Aucun abonné trouvé" });
				return;
			}

			await Promise.all(
				snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) =>
					doc.ref.update({ subscribed: false })
				)
			);

			res.status(200).json({ success: true, message: "Désabonnement réussi" });
		} catch (error) {
			console.error("Erreur lors du désabonnement :", error);
			res
				.status(500)
				.json({ success: false, message: "Erreur interne du serveur" });
		}
	});
});

// Cloud Function pour scraper et créer plusieurs recettes
export const scrapAndCreateRecipes = onRequest((req, res) => {
	corsHandler(req, res, async () => {
		// Vérifier le token admin
		const token = req.query.token as string;
		const adminToken = process.env.ADMIN_GENERATE_TOKEN;

		if (!token || token !== adminToken) {
			res
				.status(403)
				.json({ success: false, message: "Token invalide ou manquant" });
			return;
		}

		try {
			// Récupérer tous les titres de recettes existantes
			const existingRecipes = await db.collection("recipes").get();
			const existingTitles = new Set(
				existingRecipes.docs.map(
					(doc: FirebaseFirestore.QueryDocumentSnapshot) =>
						doc.data().title.toLowerCase().trim()
				)
			);

			const createdRecipes = [];
			let successCount = 0;
			let skippedCount = 0;
			let errorCount = 0;

			// Insérer chaque recette
			for (const recipe of recipesData) {
				const recipeTitleLower = recipe.title.toLowerCase().trim();

				// Vérifier si la recette existe déjà
				if (existingTitles.has(recipeTitleLower)) {
					skippedCount++;
					createdRecipes.push({
						title: recipe.title,
						status: "skipped",
						reason: "Recette déjà existante",
					});
					console.log(`⏭️ Ignorée (déjà existante): ${recipe.title}`);
					continue;
				}

				try {
					const docRef = await db.collection("recipes").add(recipe);
					await db
						.collection("recipes")
						.doc(docRef.id)
						.update({ id: docRef.id });
					createdRecipes.push({
						id: docRef.id,
						title: recipe.title,
						status: "success",
					});
					successCount++;
					console.log(`✓ Recette créée: ${recipe.title} (ID: ${docRef.id})`);
				} catch (error) {
					errorCount++;
					createdRecipes.push({
						title: recipe.title,
						status: "failed",
						error: error instanceof Error ? error.message : "Erreur inconnue",
					});
					console.error(`✗ Erreur pour ${recipe.title}:`, error);
				}
			}

			res.status(201).json({
				success: true,
				message: `${successCount} recette(s) créée(s), ${skippedCount} ignorée(s), ${errorCount} erreur(s)`,
				totalRecipes: recipesData.length,
				successCount,
				skippedCount,
				errorCount,
				recipes: createdRecipes,
			});
		} catch (error) {
			console.error("Erreur lors du scraping/création des recettes :", error);
			res.status(500).json({
				success: false,
				message: "Erreur interne du serveur",
				error: error instanceof Error ? error.message : "Erreur inconnue",
			});
		}
	});
});

// Cloud Function pour importer les ingrédients
export const importIngredients = onRequest((req, res) => {
	corsHandler(req, res, async () => {
		// Vérifier le token admin
		const token = req.query.token as string;
		const adminToken = process.env.ADMIN_GENERATE_TOKEN;

		if (!token || token !== adminToken) {
			res
				.status(403)
				.json({ success: false, message: "Token invalide ou manquant" });
			return;
		}

		try {
			// Récupérer les ingrédients existants
			const existingIngredients = await db.collection("ingredients").get();
			const existingNames = new Set(
				existingIngredients.docs.map(
					(doc: FirebaseFirestore.QueryDocumentSnapshot) =>
						doc.data().name.toLowerCase().trim()
				)
			);

			const createdIngredients = [];
			let successCount = 0;
			let skippedCount = 0;
			let errorCount = 0;

			// Créer chaque ingrédient
			for (const ingredient of ingredientsData) {
				const ingredientNameLower = ingredient.name.toLowerCase().trim();

				// Vérifier si l'ingrédient existe déjà
				if (existingNames.has(ingredientNameLower)) {
					skippedCount++;
					createdIngredients.push({
						title: ingredient.name,
						status: "skipped",
						reason: "Déjà existant",
					});
					console.log(`⏭️ Ignoré (existant): ${ingredient.name}`);
					continue;
				}

				try {
					const ingredientData = {
						name: ingredient.name,
						unit: ingredient.unit,
						price: ingredient.price,
						createdAt: admin.firestore.FieldValue.serverTimestamp(),
					};

					const docRef = await db.collection("ingredients").add(ingredientData);
					createdIngredients.push({
						id: docRef.id,
						title: ingredient.name,
						status: "success",
					});
					successCount++;
					console.log(
						`✓ Ingrédient créé: ${ingredient.name} (ID: ${docRef.id})`
					);
				} catch (error) {
					errorCount++;
					createdIngredients.push({
						title: ingredient.name,
						status: "failed",
						error: error instanceof Error ? error.message : "Erreur inconnue",
					});
					console.error(`✗ Erreur pour ${ingredient.name}:`, error);
				}
			}

			res.status(201).json({
				success: true,
				message: `${successCount} ingrédient(s) créé(s), ${skippedCount} ignoré(s), ${errorCount} erreur(s)`,
				totalIngredients: ingredientsData.length,
				successCount,
				skippedCount,
				errorCount,
				ingredients: createdIngredients,
			});
		} catch (error) {
			console.error("Erreur lors de l'import des ingrédients :", error);
			res.status(500).json({
				success: false,
				message: "Erreur interne du serveur",
				error: error instanceof Error ? error.message : "Erreur inconnue",
			});
		}
	});
});

// Cloud Function pour mettre à jour les recettes avec les IDs des ingrédients
export const updateRecipesWithIngredientIds = onRequest((req, res) => {
	corsHandler(req, res, async () => {
		// Vérifier le token admin
		const token = req.query.token as string;
		const adminToken = process.env.ADMIN_GENERATE_TOKEN;

		if (!token || token !== adminToken) {
			res
				.status(403)
				.json({ success: false, message: "Token invalide ou manquant" });
			return;
		}

		try {
			// Récupérer tous les ingrédients avec leur ID
			const ingredientsSnapshot = await db.collection("ingredients").get();
			const ingredientMap = new Map<string, string>();

			ingredientsSnapshot.docs.forEach(
				(doc: FirebaseFirestore.QueryDocumentSnapshot) => {
					const ingredientName = doc.data().name.toLowerCase().trim();
					ingredientMap.set(ingredientName, doc.id);
				}
			);

			// Récupérer toutes les recettes
			const recipesSnapshot = await db.collection("recipes").get();
			let updatedCount = 0;
			let errorCount = 0;
			const updatedRecipes = [];

			// Mettre à jour chaque recette
			for (const recipeDoc of recipesSnapshot.docs) {
				try {
					const recipe = recipeDoc.data();
					const updatedRecipeParts: any[] = [];
					const selectedIngredientIds = new Set<string>();

					// Traiter chaque partie de la recette
					if (recipe.recipeParts && Array.isArray(recipe.recipeParts)) {
						for (const part of recipe.recipeParts) {
							const updatedPart = { ...part };
							const updatedIngredients: any[] = [];

							// Convertir les noms d'ingrédients en IDs
							if (part.ingredients && Array.isArray(part.ingredients)) {
								for (const ingredient of part.ingredients) {
									const ingredientNameLower = ingredient.name
										.toLowerCase()
										.trim();
									const ingredientId = ingredientMap.get(ingredientNameLower);

									if (ingredientId) {
										updatedIngredients.push({
											id: ingredientId,
											name: ingredient.name,
											quantity: ingredient.quantity,
											unit: ingredient.unit,
										});
										selectedIngredientIds.add(ingredientId);
									} else {
										console.warn(
											`Ingrédient non trouvé: ${ingredient.name} dans ${recipe.title}`
										);
									}
								}
							}

							updatedPart.ingredients = updatedIngredients;
							updatedRecipeParts.push(updatedPart);
						}
					}

					// Préparer les données mises à jour
					const updateData = {
						recipeParts: updatedRecipeParts,
						selectedIngredients: Array.from(selectedIngredientIds),
						createdBy: recipe.createdBy || "admin",
						likes: recipe.likes || [],
					};

					// Mettre à jour la recette
					await db.collection("recipes").doc(recipeDoc.id).update(updateData);

					updatedRecipes.push({
						id: recipeDoc.id,
						title: recipe.title,
						status: "success",
						ingredientCount: selectedIngredientIds.size,
					});

					updatedCount++;
					console.log(
						`✓ Recette mise à jour: ${recipe.title} (${selectedIngredientIds.size} ingrédients)`
					);
				} catch (error) {
					errorCount++;
					updatedRecipes.push({
						id: recipeDoc.id,
						title: recipeDoc.data().title,
						status: "failed",
						error: error instanceof Error ? error.message : "Erreur inconnue",
					});
					console.error(`✗ Erreur pour ${recipeDoc.data().title}:`, error);
				}
			}

			res.status(200).json({
				success: true,
				message: `${updatedCount} recette(s) mise(s) à jour, ${errorCount} erreur(s)`,
				updatedCount,
				errorCount,
				recipes: updatedRecipes,
			});
		} catch (error) {
			console.error("Erreur lors de la mise à jour des recettes :", error);
			res.status(500).json({
				success: false,
				message: "Erreur interne du serveur",
				error: error instanceof Error ? error.message : "Erreur inconnue",
			});
		}
	});
});
