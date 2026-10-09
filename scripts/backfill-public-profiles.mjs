/**
 * Crée / met à jour "publicProfiles/{uid}" pour tous les utilisateurs existants,
 * et retire les adresses email stockées par erreur comme nom dans "likes" (lisibles publiquement).
 * À lancer une seule fois, après le déploiement de la Cloud Function syncPublicProfile
 * (qui prend ensuite le relais à chaque écriture dans "users").
 *
 *   npm run backfill:public-profiles
 *
 * Identifiants : variable FIREBASE_SERVICE_ACCOUNT_KEY (JSON) ou src/firebase/serviceAccountKey.json.
 */
import fs from 'fs';
import path from 'path';
import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  }
  const file = path.join(process.cwd(), 'src', 'firebase', 'serviceAccountKey.json');
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  throw new Error('Aucun identifiant Firebase Admin (FIREBASE_SERVICE_ACCOUNT_KEY ou src/firebase/serviceAccountKey.json)');
}

const serviceAccount = loadServiceAccount();
initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore();

const users = await db.collection('users').get();
let batch = db.batch();
let pending = 0;
let total = 0;

for (const userDoc of users.docs) {
  const data = userDoc.data();
  batch.set(db.collection('publicProfiles').doc(userDoc.id), {
    displayName: typeof data.displayName === 'string' && data.displayName.trim() ? data.displayName.trim() : 'Utilisateur',
    photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
    updatedAt: FieldValue.serverTimestamp(),
  });
  pending++;
  total++;
  if (pending === 400) {
    await batch.commit();
    batch = db.batch();
    pending = 0;
  }
}
if (pending > 0) await batch.commit();

console.log(`✅ ${total} profil(s) public(s) créé(s) ou mis à jour.`);

// Nettoyage des likes : l'ancien code utilisait l'email comme nom à défaut de pseudo
const displayNames = new Map(users.docs.map((d) => [d.id, d.data().displayName]));
const likes = await db.collection('likes').get();
batch = db.batch();
pending = 0;
let cleaned = 0;

for (const likeDoc of likes.docs) {
  const { userName, userId } = likeDoc.data();
  if (typeof userName === 'string' && userName.includes('@')) {
    const displayName = displayNames.get(userId);
    batch.update(likeDoc.ref, {
      userName: typeof displayName === 'string' && displayName.trim() ? displayName.trim() : 'Anonyme',
    });
    pending++;
    cleaned++;
    if (pending === 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
}
if (pending > 0) await batch.commit();

console.log(`✅ ${cleaned} like(s) nettoyé(s) (email remplacé par le pseudo).`);
