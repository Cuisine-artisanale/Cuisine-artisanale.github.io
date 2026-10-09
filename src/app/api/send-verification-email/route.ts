import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/config/firebase-admin";
import { sendEmail } from "@/lib/services/emailService";
import { getVerificationEmailTemplate } from "@/lib/services/emailTemplates";

const FRONTEND_URL =
	process.env.NEXT_PUBLIC_FRONTEND_URL ||
	process.env.FRONTEND_URL ||
	"https://www.cuisine-artisanale.fr";

/**
 * Envoie l'email de vérification à l'utilisateur connecté.
 *
 * Requiert un ID token Firebase (header Authorization: Bearer <token>).
 * L'adresse de destination est celle du compte, jamais une valeur fournie par le client.
 */
export async function POST(request: NextRequest) {
	const authHeader = request.headers.get("authorization") || "";
	const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

	if (!idToken) {
		return NextResponse.json({ success: false, error: "Authentification requise" }, { status: 401 });
	}

	let displayName: string | undefined;
	try {
		({ displayName } = await request.json());
	} catch {
		// corps optionnel
	}

	try {
		const auth = getFirebaseAdminAuth();

		let uid: string;
		try {
			({ uid } = await auth.verifyIdToken(idToken));
		} catch {
			return NextResponse.json({ success: false, error: "Session invalide, veuillez vous reconnecter" }, { status: 401 });
		}

		const userRecord = await auth.getUser(uid);

		if (!userRecord.email) {
			return NextResponse.json({ success: false, error: "Aucune adresse email sur ce compte" }, { status: 400 });
		}

		if (userRecord.emailVerified) {
			return NextResponse.json({ success: true, message: "Email déjà vérifié" });
		}

		const verificationLink = await auth.generateEmailVerificationLink(userRecord.email, {
			url: `${FRONTEND_URL}/verify-email`,
		});

		const emailHtml = getVerificationEmailTemplate({
			displayName: (typeof displayName === "string" && displayName.trim()) || userRecord.displayName || "Utilisateur",
			verificationLink,
		});

		const result = await sendEmail({
			to: userRecord.email,
			subject: "Vérifiez votre email - Cuisine Artisanale",
			html: emailHtml,
			from: process.env.RESEND_FROM_EMAIL || "a.sabatier@cuisine-artisanale.fr",
		});

		if (!result.success) {
			console.error("Erreur lors de l'envoi de l'email:", result.error);
			return NextResponse.json(
				{ success: false, error: result.error || "Erreur lors de l'envoi de l'email" },
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
		const tooMany = error?.code === "auth/too-many-requests" || /TOO_MANY_ATTEMPTS/.test(error?.message || "");
		return NextResponse.json(
			{
				success: false,
				error: tooMany ? "Trop de demandes. Veuillez réessayer dans quelques minutes." : "Erreur lors de l'envoi de l'email de vérification",
			},
			{ status: tooMany ? 429 : 500 }
		);
	}
}
