import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/config/firebase-admin';
import { runIngredientReview } from '@/lib/server/ingredient-review';
import { sendEmail } from '@/lib/services/emailService';
import { SITE_URL } from '@/lib/server/recipes';

// L'analyse par l'IA peut prendre plusieurs dizaines de secondes
export const maxDuration = 60;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'ssabatieraymeric@gmail.com';

async function run(notify: boolean) {
	const result = await runIngredientReview();

	if (notify && result.created > 0) {
		await sendEmail({
			to: ADMIN_EMAIL,
			subject: `Catalogue d'ingrédients : ${result.created} nouvelle(s) proposition(s)`,
			html: `
        <p>La vérification hebdomadaire du catalogue d'ingrédients a relevé
        <strong>${result.created}</strong> nouvelle(s) proposition(s) de correction
        (${result.pending} en attente au total, ${result.checked} ingrédients vérifiés).</p>
        <p><a href="${SITE_URL}/admin-panel/ingredients">Voir les propositions</a></p>
        ${result.aiUsed ? '' : "<p><em>L'orthographe n'a pas été vérifiée : le service d'IA est indisponible.</em></p>"}
      `,
			from: process.env.RESEND_FROM_EMAIL || 'a.sabatier@cuisine-artisanale.fr',
		}).catch((error) => console.error('Email de vérification du catalogue non envoyé :', error));
	}

	return result;
}

/**
 * Tâche planifiée (Vercel Cron, voir vercel.json) : chaque lundi matin.
 * Vercel envoie « Authorization: Bearer <CRON_SECRET> » ; tout autre appel est refusé.
 */
export async function GET(request: NextRequest) {
	const secret = process.env.CRON_SECRET;
	if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
		return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
	}

	try {
		return NextResponse.json({ success: true, ...(await run(true)) });
	} catch (error) {
		console.error('Erreur vérification du catalogue :', error);
		return NextResponse.json({ success: false, error: 'Erreur lors de la vérification' }, { status: 500 });
	}
}

/**
 * Lancement manuel depuis la page admin Ingrédients.
 * Requiert un ID token Firebase d'un compte admin (header Authorization: Bearer <token>).
 */
export async function POST(request: NextRequest) {
	const authorization = request.headers.get('authorization') || '';
	const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
	if (!token) {
		return NextResponse.json({ success: false, error: 'Authentification requise' }, { status: 401 });
	}

	try {
		const { uid } = await getFirebaseAdminAuth().verifyIdToken(token);
		const user = await getFirebaseAdminDb().collection('users').doc(uid).get();
		if (user.get('role') !== 'admin') {
			return NextResponse.json({ success: false, error: 'Réservé aux administrateurs' }, { status: 403 });
		}
	} catch {
		return NextResponse.json({ success: false, error: 'Session invalide' }, { status: 401 });
	}

	try {
		const { aiError, ...result } = await run(false);
		return NextResponse.json({ success: true, ...result, aiAvailable: !aiError });
	} catch (error) {
		console.error('Erreur vérification du catalogue :', error);
		return NextResponse.json({ success: false, error: 'Erreur lors de la vérification' }, { status: 500 });
	}
}
