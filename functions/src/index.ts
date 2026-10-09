import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { GoogleAuth } from "google-auth-library";

import cors from "cors";
import * as dotenv from "dotenv";
import * as path from "path";

// Import du service d'email centralisé
import { createEmailServiceFromEnv } from "./services/emailService";
import {
	getWeeklyRecipeEmailTemplate,
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
	{
		document: "recipesRequest/{objectId}",
		secrets: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
	},
	async (event) => {
		console.log("🔔 sendEmailOnNewRecipeRequest déclenchée");
		console.log("📋 Document ID:", event.params.objectId);

		const beforeData = event.data?.before.data();
		const afterData = event.data?.after.data() as RecipeRequest;

		if (!afterData) {
			console.error("❌ Snapshot after est undefined");
			return;
		}

		// Vérifier que le titre existe et n'est pas vide
		const name = afterData.title;
		if (!name || name.trim() === "") {
			console.log("⏭️ Titre vide, email non envoyé");
			return;
		}

		// Vérifier si c'est une vraie mise à jour (le titre est passé de vide à non-vide, ou a changé)
		const beforeTitle = beforeData?.title || "";

		// Si le titre avant était vide et maintenant il y a un titre, c'est une nouvelle demande
		// Si le titre a changé, c'est aussi une mise à jour importante
		if (beforeTitle && beforeTitle.trim() !== "" && beforeTitle === name) {
			console.log("⏭️ Titre inchangé, email non envoyé (mise à jour sans changement de titre)");
			return;
		}

		// Vérifier si on a déjà envoyé un email pour ce document (pour éviter les doublons)
		// On peut utiliser un flag ou vérifier les logs, mais pour simplifier, on envoie si le titre est nouveau
		console.log(`📧 Nouvelle demande de recette détectée: "${beforeTitle}" → "${name}"`);

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

			// Utiliser la même adresse que la newsletter qui fonctionne
			const fromEmail = process.env.RESEND_FROM_EMAIL ||
				process.env.EMAIL_FROM ||
				"a.sabatier@cuisine-artisanale.fr";

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

		// Utiliser la même adresse que la newsletter qui fonctionne
		const fromEmail = process.env.RESEND_FROM_EMAIL ||
			process.env.EMAIL_FROM ||
			"a.sabatier@cuisine-artisanale.fr";

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
		secrets: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
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
