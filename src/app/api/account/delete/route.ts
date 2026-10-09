import { NextRequest, NextResponse } from 'next/server';
import type { Firestore, Query } from 'firebase-admin/firestore';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/config/firebase-admin';

/** Connexion exigée dans les 10 dernières minutes pour une action irréversible. */
const RECENT_LOGIN_SECONDS = 10 * 60;

/**
 * Auteur neutre auquel sont rattachés les posts d'un compte supprimé.
 * Ce n'est pas un vrai compte : aucun utilisateur ne peut avoir cet identifiant,
 * donc seuls les admins peuvent encore modifier ou supprimer ces posts.
 */
const DELETED_USER = { userId: 'deleted-user', userName: 'Utilisateur supprimé' };

/** Rattache les posts de l'utilisateur à l'auteur neutre (ils restent en ligne). */
async function anonymizePosts(db: Firestore, uid: string) {
  for (;;) {
    const snapshot = await db.collection('posts').where('userId', '==', uid).limit(400).get();
    if (snapshot.empty) return;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.update(doc.ref, DELETED_USER));
    await batch.commit();
    if (snapshot.size < 400) return;
  }
}

async function deleteQuery(db: Firestore, query: Query) {
  // Par pages de 400 (limite d'un lot Firestore : 500 écritures)
  for (;;) {
    const snapshot = await query.limit(400).get();
    if (snapshot.empty) return;
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    if (snapshot.size < 400) return;
  }
}

/**
 * Supprime le compte de l'utilisateur connecté et ses données personnelles.
 *
 * Requiert un ID token Firebase récent (header Authorization: Bearer <token>).
 * Les données sont effacées avant le compte Auth : en cas d'échec, l'utilisateur
 * peut toujours se reconnecter et relancer la suppression.
 * Les recettes publiées sont conservées (contenu du site), sans profil d'auteur,
 * et les posts sont rattachés à un auteur neutre « Utilisateur supprimé ».
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!idToken) {
    return NextResponse.json({ success: false, error: 'Authentification requise' }, { status: 401 });
  }

  const auth = getFirebaseAdminAuth();

  let uid: string;
  let authTime: number;
  try {
    ({ uid, auth_time: authTime } = await auth.verifyIdToken(idToken, true));
  } catch {
    return NextResponse.json({ success: false, error: 'Session invalide, veuillez vous reconnecter' }, { status: 401 });
  }

  if (Date.now() / 1000 - authTime > RECENT_LOGIN_SECONDS) {
    return NextResponse.json(
      { success: false, code: 'requires-recent-login', error: 'Reconnexion récente requise' },
      { status: 403 }
    );
  }

  try {
    const db = getFirebaseAdminDb();

    await Promise.all([
      deleteQuery(db, db.collection('likes').where('userId', '==', uid)),
      deleteQuery(db, db.collection('reviews').where('userId', '==', uid)),
      deleteQuery(db, db.collection('shoppingLists').where('userId', '==', uid)),
      anonymizePosts(db, uid),
      deleteQuery(db, db.collection('recipesRequest').where('createdBy', '==', uid)),
      // Document + sous-collections (jetons TikTok, historique d'import)
      db.recursiveDelete(db.doc(`users/${uid}`)),
      db.recursiveDelete(db.doc(`tiktokImports/${uid}`)),
    ]);

    await auth.deleteUser(uid);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur suppression de compte:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la suppression du compte. Veuillez réessayer.' },
      { status: 500 }
    );
  }
}
