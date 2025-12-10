/**
 * Script de migration pour ajouter le champ 'url' (slug) aux recettes existantes
 * qui n'ont pas encore ce champ
 *
 * Utilise Firebase Admin SDK pour avoir les permissions d'écriture complètes
 */

import admin from "firebase-admin";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialiser Firebase Admin avec le service account
const serviceAccountPath = join(__dirname, "../src/firebase/serviceAccountKey.json");

// Vérifier que le fichier existe
if (!fs.existsSync(serviceAccountPath)) {
	console.error(`❌ Fichier service account introuvable: ${serviceAccountPath}`);
	process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Génère un slug à partir d'un titre
 */
function slugify(title) {
	return title
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "") // Supprime les accents
		.replace(/[^\w\s-]/g, "") // Supprime les caractères spéciaux
		.trim()
		.replace(/\s+/g, "-") // Remplace les espaces par des tirets
		.replace(/-+/g, "-") // Remplace les tirets multiples par un seul
		.toLowerCase();
}

async function migrateRecipeUrls() {
	try {
		console.log("🔥 Connexion à Firestore avec Admin SDK...");
		const recipesRef = db.collection("recipes");
		const querySnapshot = await recipesRef.get();

		console.log(`📖 ${querySnapshot.size} recettes trouvées\n`);

		let updatedCount = 0;
		let skippedCount = 0;

		for (const docSnap of querySnapshot.docs) {
			const recipe = docSnap.data();
			const recipeId = docSnap.id;

			// Vérifier si la recette a déjà un champ 'url'
			if (recipe.url) {
				console.log(`⏭️  Recette "${recipe.title}" (${recipeId}) a déjà un slug: ${recipe.url}`);
				skippedCount++;
				continue;
			}

			// Générer un slug à partir du titre
			if (!recipe.title) {
				console.warn(`⚠️  Recette ${recipeId} n'a pas de titre, ignorée`);
				skippedCount++;
				continue;
			}

			const slug = slugify(recipe.title);

			// Mettre à jour la recette avec le slug
			const recipeRef = db.collection("recipes").doc(recipeId);
			await recipeRef.update({
				url: slug
			});

			console.log(`✅ Recette "${recipe.title}" (${recipeId}) mise à jour avec le slug: ${slug}`);
			updatedCount++;
		}

		console.log("\n📊 Résumé de la migration:");
		console.log(`   - Recettes mises à jour: ${updatedCount}`);
		console.log(`   - Recettes ignorées: ${skippedCount}`);
		console.log(`   - Total: ${querySnapshot.size}`);
		console.log("\n✅ Migration terminée avec succès !");

	} catch (error) {
		console.error("❌ Erreur lors de la migration:", error);
		process.exit(1);
	}
}

// Exécuter la migration
migrateRecipeUrls().then(() => {
	process.exit(0);
}).catch((error) => {
	console.error("Erreur fatale:", error);
	process.exit(1);
});

