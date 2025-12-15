import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { sendEmail } from "@/lib/services/emailService";
import { getVerificationEmailTemplate } from "@/lib/services/emailTemplates";

if (!getApps().length) {
  let serviceAccount;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    // ✅ PRODUCTION (Vercel)
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } else {
    // ✅ LOCAL
    serviceAccount = require("@/firebase/serviceAccountKey.json");
  }

  initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
    }),
  });

  console.log("✅ Firebase Admin initialisé correctement");
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

		// Vérifier que l'utilisateur existe dans Firebase Auth
		const auth = getAuth();
		const list = await auth.listUsers(5);
		console.log("👥 Users seen by Admin:", list.users.map((u: any) => u.uid));

		let userRecord;
		try {
			if (uid) {
				userRecord = await auth.getUser(uid);
			} else {
				userRecord = await auth.getUserByEmail(email);
			}
		} catch (authError: any) {
			console.error("Erreur lors de la récupération de l'utilisateur:", authError);
			// Attendre un peu et réessayer (délai de propagation)
			await new Promise((resolve) => setTimeout(resolve, 1000));
			try {
				if (uid) {
					userRecord = await auth.getUser(uid);
				} else {
					userRecord = await auth.getUserByEmail(email);
				}
			} catch (retryError: any) {
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
		const result = await sendEmail({
			to: email,
			subject: "Vérifiez votre email - Cuisine Artisanale",
			html: emailHtml,
			from: process.env.RESEND_FROM_EMAIL || "Cuisine Artisanale <onboarding@resend.dev>",
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

