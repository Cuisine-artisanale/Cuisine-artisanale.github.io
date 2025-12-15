import { NextRequest, NextResponse } from "next/server"; 
import { initializeApp, getApps, getApp, deleteApp, cert } from "firebase-admin/app"; 
import { getAuth } from "firebase-admin/auth"; 
import { sendEmail } from "@/lib/services/emailService"; 
import { getVerificationEmailTemplate } from "@/lib/services/emailTemplates"; 
import fs from "fs"; 
import path from "path";

// Fonction pour initialiser Firebase Admin
async function initializeFirebaseAdmin(): Promise<{ success: boolean; error?: string }> {
	if (getApps().length > 0) {
		// Vérifier que les credentials sont valides en testant un appel simple
		try {
			const auth = getAuth();
			await auth.listUsers(1); // Test simple pour vérifier les credentials
			return { success: true };
		} catch (testError: any) {
			console.error("❌ Les credentials Firebase Admin existants sont invalides:", testError.message);
			console.log("🔄 Tentative de réinitialisation avec de nouveaux credentials...");
			
			// Supprimer l'instance invalide et réinitialiser
			try {
				const app = getApp();
				await deleteApp(app);
			} catch (deleteError) {
				// Ignorer les erreurs de suppression
				console.log("Note: Impossible de supprimer l'instance existante, continuation...");
			}
			
			// Continuer pour essayer de réinitialiser avec de bons credentials
		}
	}

	try { 
		// Définir le chemin du service account key
		const serviceAccountPath = path.join(process.cwd(), "src/firebase/serviceAccountKey.json");
		
		// Essayer d'utiliser le service account key en local 
		if (fs.existsSync(serviceAccountPath)) { 
			// En développement local, utiliser le fichier service account 
			const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8")); 
			initializeApp({ 
				credential: cert(serviceAccount), 
				projectId: serviceAccount.project_id || "recettes-cuisine-a1bf2",
			}); 
			console.log("✅ Firebase Admin initialisé avec service account key"); 
			
			// Tester les credentials
			try {
				const auth = getAuth();
				await auth.listUsers(1);
				return { success: true };
			} catch (testError: any) {
				console.error("❌ Les credentials du fichier serviceAccountKey.json sont invalides:", testError.message);
				return { 
					success: false, 
					error: "Le fichier serviceAccountKey.json contient des credentials invalides. Veuillez le régénérer depuis la console Firebase." 
				};
			}
		} 
		
		// En production (Vercel, etc.), utiliser la variable d'environnement 
		const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
		if (serviceAccountEnv) {
			try {
				const serviceAccount = JSON.parse(serviceAccountEnv);
				initializeApp({ 
					credential: cert(serviceAccount), 
					projectId: serviceAccount.project_id || "recettes-cuisine-a1bf2",
				}); 
				console.log("✅ Firebase Admin initialisé avec FIREBASE_SERVICE_ACCOUNT_KEY"); 
				
				// Tester les credentials
				try {
					const auth = getAuth();
					await auth.listUsers(1);
					return { success: true };
				} catch (testError: any) {
					console.error("❌ Les credentials de FIREBASE_SERVICE_ACCOUNT_KEY sont invalides:", testError.message);
					return { 
						success: false, 
						error: "La variable FIREBASE_SERVICE_ACCOUNT_KEY contient des credentials invalides." 
					};
				}
			} catch (parseError: any) {
				console.error("❌ Erreur lors du parsing de FIREBASE_SERVICE_ACCOUNT_KEY:", parseError);
				return { 
					success: false, 
					error: "Erreur lors du parsing de FIREBASE_SERVICE_ACCOUNT_KEY. Vérifiez que c'est un JSON valide." 
				};
			}
		}
		
		// Dernier recours : utiliser Application Default Credentials (uniquement en production Vercel)
		if (process.env.VERCEL) {
			try {
				initializeApp({ 
					projectId: process.env.FIREBASE_PROJECT_ID || "recettes-cuisine-a1bf2",
				}); 
				console.log("✅ Firebase Admin initialisé avec Application Default Credentials"); 
				
				// Tester les credentials
				try {
					const auth = getAuth();
					await auth.listUsers(1);
					return { success: true };
				} catch (testError: any) {
					console.error("❌ Application Default Credentials invalides:", testError.message);
					return { 
						success: false, 
						error: "Application Default Credentials invalides. Configurez FIREBASE_SERVICE_ACCOUNT_KEY dans Vercel." 
					};
				}
			} catch (initError: any) {
				console.error("❌ Erreur lors de l'initialisation avec Application Default Credentials:", initError);
				return { 
					success: false, 
					error: "Impossible d'initialiser Firebase Admin avec Application Default Credentials." 
				};
			}
		}
		
		// Aucune méthode d'authentification trouvée
		const isLocal = !process.env.VERCEL && process.env.NODE_ENV !== "production";
		const hasEnvVar = !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
		
		let errorMessage = "Aucune méthode d'authentification Firebase Admin trouvée.\n\n";
		
		if (isLocal) {
			errorMessage += "📁 En développement local, vous devez :\n";
			errorMessage += "1. Télécharger votre clé de compte de service depuis https://console.firebase.google.com/\n";
			errorMessage += "2. Créer le dossier src/firebase/ s'il n'existe pas\n";
			errorMessage += `3. Placer le fichier JSON dans : ${serviceAccountPath}\n\n`;
			errorMessage += `Le fichier existe actuellement : ${fs.existsSync(serviceAccountPath) ? "✅ Oui" : "❌ Non"}\n`;
		} else {
			errorMessage += "🔐 En production, configurez la variable d'environnement FIREBASE_SERVICE_ACCOUNT_KEY dans Vercel.\n\n";
			errorMessage += `La variable est configurée : ${hasEnvVar ? "✅ Oui" : "❌ Non"}\n`;
		}
		
		return { 
			success: false, 
			error: errorMessage
		};
	} catch (error: any) { 
		console.error("❌ Erreur lors de l'initialisation de Firebase Admin:", error.message || error); 
		return { 
			success: false, 
			error: error.message || "Erreur inconnue lors de l'initialisation de Firebase Admin" 
		};
	}
}


/**
 * API route pour envoyer un email de vérification
 * Utilise la même logique que la newsletter (API route Next.js + Resend)
 */
export async function POST(request: NextRequest) {
	try {
		const { email, displayName, uid } = await request.json();

		if (!email || !email.includes("@")) {
			return NextResponse.json(
				{ success: false, error: "Email invalide" },
				{ status: 400 }
			);
		}

		// Initialiser Firebase Admin si ce n'est pas déjà fait
		const initResult = await initializeFirebaseAdmin();
		if (!initResult.success) {
			return NextResponse.json(
				{
					success: false,
					error: initResult.error || "Erreur de configuration Firebase Admin. Veuillez vérifier les credentials.",
				},
				{ status: 500 }
			);
		}

		// Vérifier que l'utilisateur existe dans Firebase Auth
		const auth = getAuth();
		let userRecord;
		try {
			if (uid) {
				userRecord = await auth.getUser(uid);
			} else {
				userRecord = await auth.getUserByEmail(email);
			}
		} catch (authError: any) {
			console.error("Erreur lors de la récupération de l'utilisateur:", authError);
			
			// Vérifier si c'est une erreur de credentials
			if (authError.code === 'app/invalid-credential' || 
				authError.message?.includes('credential') || 
				authError.message?.includes('OAuth2')) {
				return NextResponse.json(
					{
						success: false,
						error: "Erreur d'authentification Firebase Admin. Les credentials sont invalides. Veuillez vérifier votre configuration.",
					},
					{ status: 500 }
				);
			}
			
			// Attendre un peu et réessayer (délai de propagation pour les nouveaux utilisateurs)
			await new Promise((resolve) => setTimeout(resolve, 1000));
			try {
				if (uid) {
					userRecord = await auth.getUser(uid);
				} else {
					userRecord = await auth.getUserByEmail(email);
				}
			} catch (retryError: any) {
				// Vérifier si c'est une erreur de credentials
				if (retryError.code === 'app/invalid-credential' || 
					retryError.message?.includes('credential') || 
					retryError.message?.includes('OAuth2')) {
					return NextResponse.json(
						{
							success: false,
							error: "Erreur d'authentification Firebase Admin. Les credentials sont invalides. Veuillez vérifier votre configuration.",
						},
						{ status: 500 }
					);
				}
				
				return NextResponse.json(
					{
						success: false,
						error: "Utilisateur non trouvé dans Firebase Auth. Veuillez réessayer dans quelques secondes.",
					},
					{ status: 404 }
				);
			}
		}

		// Générer le lien de vérification Firebase
		const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL ||
			process.env.FRONTEND_URL ||
			"https://www.cuisine-artisanale.fr";

		const continueUrl = `${frontendUrl}/verify-email`;
		const verificationLink = await auth.generateEmailVerificationLink(
			userRecord.email || email,
			{
				url: continueUrl,
			}
		);

		// Utiliser le template d'email centralisé
		const emailHtml = getVerificationEmailTemplate({
			displayName: displayName || "Utilisateur",
			verificationLink,
		});

		// Envoyer l'email via le service centralisé (même que la newsletter)
		// Utiliser le même domaine vérifié que la newsletter
		const result = await sendEmail({
			to: email,
			subject: "Vérifiez votre email - Cuisine Artisanale",
			html: emailHtml,
			from: process.env.RESEND_FROM_EMAIL || "a.sabatier@cuisine-artisanale.fr",
		});

		if (!result.success) {
			console.error("Erreur lors de l'envoi de l'email:", result.error);
			return NextResponse.json(
				{
					success: false,
					error: result.error || "Erreur lors de l'envoi de l'email",
				},
				{ status: 500 }
			);
		}

		return NextResponse.json({
			success: true,
			message: "Email envoyé avec succès",
			messageId: result.messageId,
		});
	} catch (error: any) {
		console.error("Erreur lors de l'envoi de l'email de vérification:", error);
    return NextResponse.json(
			{
				success: false,
				error: error.message || "Erreur lors de l'envoi de l'email de vérification",
			},
      { status: 500 }
    );
  }
}

