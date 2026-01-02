import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { GoogleAuth } from "google-auth-library";
import { recipesData } from "./recipes";
import { ingredientsData } from "./ingredients";

import cors from "cors";
import * as dotenv from "dotenv";
import * as path from "path";

// Import du service d'email centralisé
import { createEmailServiceFromEnv } from "./services/emailService";
import {
	getWeeklyRecipeEmailTemplate,
	getVerificationEmailTemplate,
	getCustomEmailTemplate,
} from "./services/emailTemplates";

// Charger les variables d'environnement depuis .env.local en développement local
// En production, les secrets Firebase seront utilisés via process.env
if (process.env.NODE_ENV !== "production" || process.env.FUNCTIONS_EMULATOR) {
	dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
}

const admin = require("firebase-admin");
const corsHandler = cors({ origin: true });

admin.initializeApp();
const db = admin.firestore();

// Note: Le service d'email est initialisé dans chaque fonction qui en a besoin
// car les variables d'environnement peuvent ne pas être disponibles au niveau du module

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

// Définition de la fonction avec les types Firebase pour event
export const sendEmailOnNewRecipeRequest = onDocumentUpdated(
	"recipesRequest/{objectId}",
	async (event) => {
		console.log("🔔 sendEmailOnNewRecipeRequest déclenchée");

		const beforeData = event.data?.before.data();
		const afterData = event.data?.after.data() as RecipeRequest;

		if (!afterData) {
			console.error("❌ Snapshot after est undefined");
			return;
		}

		// Vérifier que le titre existe et n'est pas vide (pour éviter d'envoyer un email lors de la création initiale vide)
		const name = afterData.title;
		if (!name || name.trim() === "") {
			console.log("⏭️ Titre vide, email non envoyé (création initiale)");
			return;
		}

		// Vérifier si c'est une vraie mise à jour (le titre a changé)
		const beforeTitle = beforeData?.title || "";
		if (beforeTitle === name) {
			console.log("⏭️ Titre inchangé, email non envoyé");
			return;
		}

		console.log(`📧 Envoi d'email pour la nouvelle demande de recette: ${name}`);

		try {
			// Initialiser le service d'email dans la fonction
			let emailServiceInstance: ReturnType<typeof createEmailServiceFromEnv>;
			try {
				emailServiceInstance = createEmailServiceFromEnv();
				console.log("✅ Service d'email initialisé");
			} catch (initError: any) {
				console.error("❌ Erreur lors de l'initialisation du service d'email:", initError);
				console.error("⚠️ Vérifiez que RESEND_API_KEY est configurée dans les variables d'environnement");
				return;
			}

			const emailHtml = getCustomEmailTemplate(
				"📝 Nouvelle demande de recette",
				`<p>Une nouvelle demande de recette a été ajoutée :</p><p style="font-size: 18px; font-weight: bold; color: #8B4513;">${name}</p>`
			);

			// Utiliser onboarding@resend.dev par défaut (comme la newsletter)
			const fromEmail = process.env.RESEND_FROM_EMAIL ||
				process.env.EMAIL_FROM ||
				"Cuisine Artisanale <onboarding@resend.dev>";

			console.log(`📤 Envoi de l'email à ssabatieraymeric@gmail.com depuis ${fromEmail}`);

			const result = await emailServiceInstance.sendEmail({
				to: "ssabatieraymeric@gmail.com",
				subject: "Nouvelle demande de recette",
				html: emailHtml,
				from: fromEmail,
			});

			if (result.success) {
				console.log("✅ Email envoyé avec succès ! Message ID:", result.messageId);
			} else {
				console.error("❌ Erreur d'envoi d'email :", result.error);
			}
		} catch (error) {
			console.error("❌ Erreur d'envoi d'email :", error);
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

		// Crée le slug pour l'URL de la recette
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

		// Initialiser le service d'email dans la fonction
		let emailServiceInstance: ReturnType<typeof createEmailServiceFromEnv>;
		try {
			emailServiceInstance = createEmailServiceFromEnv();
		} catch (initError: any) {
			console.error("❌ Erreur lors de l'initialisation du service d'email:", initError);
			throw new Error("Service d'email non disponible. Vérifiez que RESEND_API_KEY est configurée.");
		}

		// Utiliser le template d'email centralisé
		const emailHtml = getWeeklyRecipeEmailTemplate({
			title: recipe.title,
			type: recipe.type || "recette",
			images: recipe.images || [],
			recipeUrl,
			unsubscribeUrl,
		});

		// Utiliser onboarding@resend.dev par défaut (comme la newsletter)
		const fromEmail = process.env.RESEND_FROM_EMAIL ||
			process.env.EMAIL_FROM ||
			"Cuisine Artisanale <onboarding@resend.dev>";

		const result = await emailServiceInstance.sendEmail({
			to: email,
			subject: `🍰 Votre recette de la semaine : ${recipe.title}`,
			html: emailHtml,
			from: fromEmail,
		});

		if (result.success) {
			console.log("✅ Email envoyé avec succès à", email);
		} else {
			console.error("❌ Erreur lors de l'envoi de l'email :", result.error);
			throw new Error(result.error);
		}
	} catch (error) {
		console.error("❌ Erreur lors de l'envoi de l'email :", error);
		throw error;
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

// Cloud Function pour envoyer un email de vérification rapidement via Resend
// Les secrets sont définis via: firebase functions:secrets:set RESEND_API_KEY
export const sendVerificationEmailFast = onRequest(
	{
		secrets: ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "FRONTEND_URL"],
	},
	async (req, res) => {
	corsHandler(req, res, async () => {
		// Gérer les requêtes OPTIONS (preflight CORS)
		if (req.method === "OPTIONS") {
			res.status(200).end();
			return;
		}

		// Vérifier que c'est une requête POST
		if (req.method !== "POST") {
			res.status(405).json({
				success: false,
				message: "Method not allowed. Cette fonction accepte uniquement les requêtes POST.",
				info: "Cette Cloud Function est appelée automatiquement lors de l'inscription ou du renvoi d'email de vérification.",
			});
			return;
		}

		try {
			const { email, displayName, uid } = req.body;

			if (!email) {
				res.status(400).json({
					success: false,
					message: "Email manquant",
				});
				return;
			}

			// Vérifier que l'utilisateur existe dans Firebase Auth
			let userRecord;
			try {
				if (uid) {
					// Si on a l'UID, l'utiliser pour récupérer l'utilisateur
					userRecord = await admin.auth().getUser(uid);
				} else {
					// Sinon, chercher par email
					userRecord = await admin.auth().getUserByEmail(email);
				}
			} catch (authError: any) {
				console.error("Erreur lors de la récupération de l'utilisateur:", authError);
				// Attendre un peu et réessayer (délai de propagation)
				await new Promise((resolve) => setTimeout(resolve, 1000));
				try {
					if (uid) {
						userRecord = await admin.auth().getUser(uid);
					} else {
						userRecord = await admin.auth().getUserByEmail(email);
					}
				} catch (retryError: any) {
					res.status(404).json({
						success: false,
						message: "Utilisateur non trouvé dans Firebase Auth. Veuillez réessayer dans quelques secondes.",
						error: retryError.message,
					});
					return;
				}
			}

			// Générer le lien de vérification Firebase
			const frontendUrl = process.env.FRONTEND_URL || "https://www.cuisine-artisanale.fr";

			// Valider que l'URL est valide
			if (!frontendUrl || !frontendUrl.startsWith("http://") && !frontendUrl.startsWith("https://")) {
				res.status(500).json({
					success: false,
					message: "Configuration invalide : FRONTEND_URL doit être une URL valide (commence par http:// ou https://)",
					error: `FRONTEND_URL actuel: "${frontendUrl}"`,
				});
				return;
			}

			const continueUrl = `${frontendUrl}/verify-email`;

			const verificationLink = await admin
				.auth()
				.generateEmailVerificationLink(userRecord.email || email, {
					url: continueUrl,
				});

			// Initialiser le service d'email dans le contexte de la fonction (secrets disponibles ici)
			let emailService: ReturnType<typeof createEmailServiceFromEnv>;
			try {
				emailService = createEmailServiceFromEnv();
			} catch (initError: any) {
				console.error("Erreur lors de l'initialisation du service d'email:", initError);
				res.status(500).json({
					success: false,
					message: "Service d'email non disponible",
					error: initError.message || "Veuillez configurer RESEND_API_KEY dans Firebase Functions",
					hint: "Utilisez: firebase functions:secrets:set RESEND_API_KEY",
				});
				return;
			}

			// Utiliser le template d'email centralisé
			const emailHtml = getVerificationEmailTemplate({
				displayName: displayName || "Utilisateur",
				verificationLink,
			});

			// Déterminer l'adresse email d'expéditeur
			// Utiliser RESEND_FROM_EMAIL si configuré, sinon utiliser une adresse par défaut vérifiée
			const fromEmail = process.env.RESEND_FROM_EMAIL ||
				process.env.EMAIL_FROM ||
				"Cuisine Artisanale <onboarding@resend.dev>"; // Adresse par défaut pour les tests

			// Envoyer l'email via le service centralisé
			const result = await emailService.sendEmail({
				to: email,
				subject: "Vérifiez votre email - Cuisine Artisanale",
				html: emailHtml,
				from: fromEmail,
			});

			if (!result.success) {
				console.error("Erreur lors de l'envoi de l'email:", result.error);

				// Message d'erreur plus explicite pour les problèmes de domaine
				let errorMessage = result.error;
				let hint = undefined;

				if (result.error?.includes("domain is not verified") || result.error?.includes("not verified")) {
					errorMessage = "Le domaine d'expéditeur n'est pas vérifié dans Resend";
					hint = "Vérifiez votre domaine sur https://resend.com/domains ou utilisez une adresse email vérifiée dans RESEND_FROM_EMAIL";
				}

				res.status(500).json({
					success: false,
					message: "Erreur lors de l'envoi de l'email",
					error: errorMessage,
					hint: hint,
					provider: emailService.getCurrentProvider(),
				});
				return;
			}

			console.log("✅ Email de vérification envoyé via Resend à:", email);
			res.status(200).json({
				success: true,
				message: "Email envoyé avec succès",
				messageId: result.messageId,
			});
		} catch (error: any) {
			console.error("Erreur dans sendVerificationEmailFast:", error);
			res.status(500).json({
				success: false,
				message: "Erreur interne du serveur",
				error: error.message,
			});
		}
	});
});