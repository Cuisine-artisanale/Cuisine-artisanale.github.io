import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import { fileURLToPath } from 'url';

// Récupération du __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lire le fichier JSON manuellement
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'src/firebase/serviceAccountKey.json'), 'utf-8')
);

// Initialisation Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();


const shareDir = path.join(__dirname, 'public', 'share');

if (!fs.existsSync(shareDir)) {
  fs.mkdirSync(shareDir, { recursive: true });
}

async function generateSharePages() {
	console.log('Connexion à Firestore...');
	const recettesSnapshot = await db.collection('recipes').get();
	console.log(`Nombre de recettes trouvées : ${recettesSnapshot.size}`);

  recettesSnapshot.forEach(doc => {
	const recette = doc.data();
	const url = recette.url;
	const title = recette.title;
	const description = `Découvrez la recette ${title}, un délicieux plat ${recette.type || ''}.`;
	const image = recette.images?.[0] || '';

	const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${title} | Cuisine Artisanale</title>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://www.Cuisine-artisanale.fr/recettes/${url}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
</head>
<body>
  <script>
	window.location.href = "https://www.Cuisine-artisanale.fr/recettes/${url}";
  </script>
</body>
</html>
	`;

	fs.writeFileSync(path.join(shareDir, `${url}.html`), html);
	console.log(`Page générée : ${url}.html`);
  });

  console.log('Toutes les pages de partage ont été générées !');
}

generateSharePages().catch(console.error);
