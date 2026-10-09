import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "@/lib/config/firebase-admin";
import { sendEmail } from "@/lib/services/emailService";
import { getWelcomeEmailTemplate } from "@/lib/services/emailTemplates";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * API route pour s'abonner à la newsletter.
 * Utilise Firebase Admin : la collection "abonnes" n'est plus accessible depuis le client.
 */
export async function POST(request: NextRequest) {
	try {
		const { email: rawEmail } = await request.json();
		const email = typeof rawEmail === "string" ? rawEmail.trim() : "";

		if (!EMAIL_REGEX.test(email)) {
			return NextResponse.json(
				{ success: false, error: "Email invalide" },
				{ status: 400 }
			);
		}

		const abonnesRef = getFirebaseAdminDb().collection("abonnes");
		const existingSubscribers = await abonnesRef.where("email", "==", email).limit(1).get();
		const isNewSubscriber = existingSubscribers.empty;

		if (isNewSubscriber) {
			await abonnesRef.add({
				email,
				date: FieldValue.serverTimestamp(),
				subscribed: true,
			});

			try {
				const welcomeEmailHtml = getWelcomeEmailTemplate(email.split("@")[0]);
				await sendEmail({
					to: email,
					subject: "Bienvenue sur Cuisine Artisanale ! 🎉",
					html: welcomeEmailHtml,
					from: process.env.RESEND_FROM_EMAIL || "a.sabatier@cuisine-artisanale.fr",
				});
			} catch (emailError) {
				console.error("Erreur lors de l'envoi de l'email de bienvenue:", emailError);
				// On continue même si l'email de bienvenue échoue
			}
		} else {
			await existingSubscribers.docs[0].ref.update({
				subscribed: true,
				date: FieldValue.serverTimestamp(),
			});
		}

		return NextResponse.json({
			success: true,
			message: isNewSubscriber
				? "Inscription réussie ! Vérifiez votre email pour le message de bienvenue."
				: "Vous êtes déjà inscrit(e) ! Votre abonnement a été réactivé.",
		});
	} catch (error: any) {
		console.error("Erreur lors de l'inscription à la newsletter:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Erreur lors de l'inscription. Veuillez réessayer plus tard.",
			},
			{ status: 500 }
		);
	}
}
