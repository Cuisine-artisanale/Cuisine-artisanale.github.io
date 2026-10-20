/**
 * Photos sous licence libre des recettes : envoi dans Firebase Storage et rattachement aux recettes.
 *
 * Le fichier scripts/data/photos-recettes.json liste, par recette, la photo retenue avec son auteur,
 * sa licence et sa page d'origine. Il sert aussi de preuve de licence : le script y inscrit l'adresse
 * de l'image envoyée et, pour les recettes déjà en ligne, les photos qu'elle a remplacées.
 *
 *   node scripts/import-photos.mjs                    essai à blanc : liste ce qui serait fait
 *   node scripts/import-photos.mjs --write            télécharge, redimensionne et envoie les photos manquantes
 *   node scripts/import-photos.mjs --write --apply    en plus, remplace la photo des recettes déjà publiées
 *
 * Les recettes en attente de validation déposées sans photo sont complétées avec --write ; celles qui
 * ne sont pas encore déposées reçoivent leur photo par scripts/import-recipes.mjs, qui lit ce fichier.
 * Le crédit (auteur, licence) est enregistré dans le champ "imageCredit" et affiché sous la photo.
 * Peut être relancé : une photo déjà envoyée ou déjà rattachée n'est pas refaite.
 *
 * Identifiants : variable FIREBASE_SERVICE_ACCOUNT_KEY (JSON) ou src/firebase/serviceAccountKey.json.
 */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const MANIFEST = path.join('scripts', 'data', 'photos-recettes.json');
const MAX_WIDTH = 1600;

function loadServiceAccount() {
	if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
	const file = path.join(process.cwd(), 'src', 'firebase', 'serviceAccountKey.json');
	if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
	throw new Error('Aucun identifiant Firebase Admin (FIREBASE_SERVICE_ACCOUNT_KEY ou src/firebase/serviceAccountKey.json)');
}

const slugify = (title) =>
	title
		.replace(/œ/gi, 'oe')
		.replace(/æ/gi, 'ae')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^\w\s-]/g, '')
		.trim()
		.replace(/\s+/g, '-')
		.toLowerCase();

const args = process.argv.slice(2);
const write = args.includes('--write');
const apply = args.includes('--apply');

const photos = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const saveManifest = () => fs.writeFileSync(MANIFEST, JSON.stringify(photos, null, 2) + '\n');

const serviceAccount = loadServiceAccount();
const bucketName = `${serviceAccount.project_id}.firebasestorage.app`;
initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id, storageBucket: bucketName });
const db = getFirestore();
const bucket = getStorage().bucket();

// ---- 1. Envoi des photos manquantes ----
const toUpload = photos.filter((photo) => !photo.imageUrl);
console.log(`${toUpload.length} photo(s) à envoyer sur ${photos.length}.`);
for (const photo of toUpload) {
	if (!write) {
		console.log(` - ${photo.title} ← ${photo.originalFile}`);
		continue;
	}
	try {
		const response = await fetch(photo.originalFile, {
			headers: { 'User-Agent': 'CuisineArtisanale/1.0 (https://www.cuisine-artisanale.fr)' },
		});
		if (!response.ok) throw new Error(`téléchargement refusé (${response.status})`);
		const original = Buffer.from(await response.arrayBuffer());
		// rotate() applique l'orientation EXIF avant qu'elle ne soit retirée avec les métadonnées
		const image = await sharp(original).rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();

		const storagePath = `recipes/${photo.title}/${Date.now()}_${slugify(photo.title)}.webp`;
		const token = randomUUID();
		await bucket.file(storagePath).save(image, {
			resumable: false,
			metadata: {
				contentType: 'image/webp',
				cacheControl: 'public, max-age=31536000',
				metadata: { firebaseStorageDownloadTokens: token },
			},
		});
		photo.storagePath = storagePath;
		photo.imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
		photo.retrievedAt = new Date().toISOString().slice(0, 10);
		saveManifest();
		console.log(` ✅ ${photo.title} (${Math.round(image.length / 1024)} Ko)`);
	} catch (error) {
		console.log(` ❌ ${photo.title} : ${error.message}`);
	}
}

// ---- 2. Recettes déjà publiées : remplacement de la photo ----
const existing = photos.filter((photo) => photo.recipeId && photo.imageUrl && !photo.appliedAt);
console.log(`\n${existing.length} recette(s) publiée(s) dont la photo reste à remplacer.`);
for (const photo of existing) {
	if (!write || !apply) {
		console.log(` - ${photo.title}`);
		continue;
	}
	const ref = db.collection('recipes').doc(photo.recipeId);
	const snap = await ref.get();
	if (!snap.exists) {
		console.log(` ❌ ${photo.title} : recette introuvable (${photo.recipeId})`);
		continue;
	}
	// Les anciennes photos restent dans le stockage et leurs adresses sont gardées ici : retour arrière possible
	photo.previousImages = snap.get('images') || [];
	await ref.update({
		images: [photo.imageUrl],
		imageCredit: {
			author: photo.author,
			license: photo.license,
			sourceUrl: photo.sourceUrl,
			...(photo.licenseUrl ? { licenseUrl: photo.licenseUrl } : {}),
		},
	});
	photo.appliedAt = new Date().toISOString().slice(0, 10);
	saveManifest();
	console.log(` ✅ ${photo.title}`);
}

// ---- 3. Recettes en attente de validation, déposées sans photo ----
const pendingSnap = await db.collection('recipesRequest').get();
const byTitle = new Map(photos.filter((photo) => !photo.recipeId && photo.imageUrl).map((photo) => [photo.title, photo]));
const pending = pendingSnap.docs.filter((doc) => byTitle.has(doc.get('title')) && !(doc.get('images') || []).length);
console.log(`\n${pending.length} recette(s) en attente sans photo à compléter.`);
for (const doc of pending) {
	const photo = byTitle.get(doc.get('title'));
	if (!write) {
		console.log(` - ${photo.title}`);
		continue;
	}
	// Le titre ne change pas : la mise à jour ne déclenche pas l'email d'alerte à l'admin
	await doc.ref.update({
		images: [photo.imageUrl],
		imageCredit: {
			author: photo.author,
			license: photo.license,
			sourceUrl: photo.sourceUrl,
			...(photo.licenseUrl ? { licenseUrl: photo.licenseUrl } : {}),
		},
	});
	console.log(` ✅ ${photo.title}`);
}

if (!write) console.log("\nEssai à blanc : rien n'a été envoyé ni modifié. Relancer avec --write.");
else if (!apply && existing.length > 0) console.log('\nPhotos des recettes publiées inchangées. Relancer avec --write --apply pour les remplacer.');
