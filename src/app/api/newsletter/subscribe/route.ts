import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { sendEmail } from "@/lib/services/emailService";
import { getWelcomeEmailTemplate } from "@/lib/services/emailTemplates";

// Configuration Firebase
const firebaseConfig = {
	apiKey: "AIzaSyCRqPaeQ_8kRByuf8l9_Fkcbmdgy_0aWI4",
	authDomain: "recettes-cuisine-a1bf2.firebaseapp.com",
	projectId: "recettes-cuisine-a1bf2",
	storageBucket: "recettes-cuisine-a1bf2.firebasestorage.app",
	messagingSenderId: "854150054780",
	appId: "1:854150054780:web:e3866880aea3e01d5c1af9",
	measurementId: "G-1J6YNX5LZM"
};

// Initialiser Firebase si ce n'est pas déjà fait
let app;
if (!getApps().length) {
	app = initializeApp(firebaseConfig);
} else {
	app = getApps()[0];
}

const db = getFirestore(app);

/**
 * API route pour s'abonner à la newsletter
 * Remplace EmailJS par un système unifié
 */
export async function POST(request: NextRequest) {
	try {
		const { email } = await request.json();

		if (!email || !email.includes("@")) {
			return NextResponse.json(
				{ success: false, error: "Email invalide" },
				{ status: 400 }
			);
		}

		// Vérifier si l'email existe déjà
		const abonnesRef = collection(db, "abonnes");
		const q = query(abonnesRef, where("email", "==", email));
		const existingSubscribers = await getDocs(q);

		let isNewSubscriber = existingSubscribers.empty;

		// Ajouter ou mettre à jour l'abonné
		if (isNewSubscriber) {
			// Nouvel abonné
			await addDoc(abonnesRef, {
				email,
				date: serverTimestamp(),
				subscribed: true,
			});

			// Envoyer un email de bienvenue
			try {
				const welcomeEmailHtml = getWelcomeEmailTemplate(email.split("@")[0]);
				await sendEmail({
					to: email,
					subject: "Bienvenue sur Cuisine Artisanale ! 🎉",
					html: welcomeEmailHtml,
					from: "a.sabatier@cuisine-artisanale.fr",
				});
			} catch (emailError) {
				console.error("Erreur lors de l'envoi de l'email de bienvenue:", emailError);
				// On continue même si l'email de bienvenue échoue
			}
		} else {
			// Mettre à jour l'abonné existant pour le réactiver
			const doc = existingSubscribers.docs[0];
			await updateDoc(doc.ref, {
				subscribed: true,
				date: serverTimestamp(),
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

