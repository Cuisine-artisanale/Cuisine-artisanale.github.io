import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/config/firebase-admin';
import { sendEmail } from '@/lib/services/emailService';
import { getRecipeApprovedEmailTemplate } from '@/lib/services/emailTemplates';
import { getRecipeUrl } from '@/lib/utils/recipe-url';

const FRONTEND_URL =
	process.env.NEXT_PUBLIC_FRONTEND_URL ||
	process.env.FRONTEND_URL ||
	'https://www.cuisine-artisanale.fr';

/** Id de document Firestore */
const ID_REGEX = /^[A-Za-z0-9_-]{1,200}$/;

/**
 * Prévient l'auteur d'une recette qu'elle vient d'être publiée, avec le lien vers sa fiche.
 *
 * Réservé aux admins (header Authorization: Bearer <ID token>).
 * Corps : { recipeId: string, modified?: boolean } — id dans "recipes" ; `modified` ajoute
 * un paragraphe indiquant que la recette a été retouchée avant publication.
 * Le destinataire est l'adresse du compte qui a créé la recette, jamais une valeur du client ;
 * l'admin qui a validé la reçoit en copie cachée.
 */
export async function POST(request: NextRequest) {
	const authHeader = request.headers.get('authorization') || '';
	const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

	if (!idToken) {
		return NextResponse.json({ success: false, error: 'Authentification requise' }, { status: 401 });
	}

	const auth = getFirebaseAdminAuth();
	const db = getFirebaseAdminDb();

	let uid: string;
	let adminEmail: string | undefined;
	try {
		({ uid, email: adminEmail } = await auth.verifyIdToken(idToken));
	} catch {
		return NextResponse.json({ success: false, error: 'Session invalide' }, { status: 401 });
	}

	const adminSnap = await db.collection('users').doc(uid).get();
	if (adminSnap.get('role') !== 'admin') {
		return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 });
	}

	let recipeId: unknown;
	let modified: unknown;
	try {
		({ recipeId, modified } = await request.json());
	} catch {
		// validé ci-dessous
	}
	if (typeof recipeId !== 'string' || !ID_REGEX.test(recipeId)) {
		return NextResponse.json({ success: false, error: 'Recette invalide' }, { status: 400 });
	}

	const recipeSnap = await db.collection('recipes').doc(recipeId).get();
	if (!recipeSnap.exists) {
		return NextResponse.json({ success: false, error: 'Recette introuvable' }, { status: 404 });
	}
	const recipe = recipeSnap.data() ?? {};

	const authorId = typeof recipe.createdBy === 'string' ? recipe.createdBy : '';
	// Recette créée ou importée par l'admin lui-même : personne à prévenir
	if (!authorId || authorId === uid) {
		return NextResponse.json({ success: true, sent: false, reason: 'no-author' });
	}

	let email: string | undefined;
	let displayName: string | undefined;
	try {
		({ email, displayName } = await auth.getUser(authorId));
	} catch {
		return NextResponse.json({ success: true, sent: false, reason: 'author-not-found' });
	}
	if (!email) {
		return NextResponse.json({ success: true, sent: false, reason: 'no-email' });
	}

	const recipeUrl = FRONTEND_URL + getRecipeUrl({ id: recipeId, url: recipe.url, title: recipe.title });

	const result = await sendEmail({
		to: email,
		// L'admin qui a validé reçoit le même email, sans que l'auteur voie son adresse
		...(adminEmail && adminEmail !== email ? { bcc: adminEmail } : {}),
		subject: 'Votre recette est publiée - Cuisine Artisanale',
		html: getRecipeApprovedEmailTemplate({
			displayName: displayName || 'Utilisateur',
			recipeTitle: String(recipe.title || ''),
			recipeUrl,
			modified: modified === true,
		}),
		from: process.env.RESEND_FROM_EMAIL || 'a.sabatier@cuisine-artisanale.fr',
	});

	if (!result.success) {
		console.error('Email de publication non envoyé :', result.error);
		return NextResponse.json({ success: false, error: result.error || 'Erreur lors de l\'envoi' }, { status: 500 });
	}

	return NextResponse.json({ success: true, sent: true });
}
