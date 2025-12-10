import { SitemapStream, streamToPromise } from "sitemap";
import { createWriteStream } from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import dotenv from "dotenv";

dotenv.config();

const firebaseConfig = {
	apiKey: "AIzaSyCRqPaeQ_8kRByuf8l9_Fkcbmdgy_0aWI4",
	authDomain: "recettes-cuisine-a1bf2.firebaseapp.com",
	projectId: "recettes-cuisine-a1bf2",
	storageBucket: "recettes-cuisine-a1bf2.firebasestorage.app",
	messagingSenderId: "854150054780",
	appId: "1:854150054780:web:e3866880aea3e01d5c1af9",
	measurementId: "G-1J6YNX5LZM"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function generateSitemap() {
	const sitemapStream = new SitemapStream({ hostname: "https://www.cuisine-artisanale.fr" });

	const writeStream = createWriteStream("./public/sitemap.xml");
	sitemapStream.pipe(writeStream);

	const basePath = "/";

	// Static routes (public pages only)
	const staticRoutes = [
		{ url: `${basePath}`, changefreq: "weekly", priority: 1.0 },
		{ url: `${basePath}/recettes`, changefreq: "weekly", priority: 0.9 },
		{ url: `${basePath}/about`, changefreq: "monthly", priority: 0.7 },
		{ url: `${basePath}/map`, changefreq: "weekly", priority: 0.8 },
		{ url: `${basePath}/mentions-legales`, changefreq: "yearly", priority: 0.3 },
		{ url: `${basePath}/politique-confidentialite`, changefreq: "yearly", priority: 0.3 },
	];

	staticRoutes.forEach(route => sitemapStream.write(route));

	try {
		const recettesSnap = await getDocs(collection(db, "recipes"));
		recettesSnap.forEach(doc => {
			const recette = doc.data();
			const slug = recette.url || doc.id; // Utiliser le slug si disponible, sinon l'ID
			sitemapStream.write({
				url: `${basePath}/recettes/${slug}`,
				changefreq: "weekly",
				priority: 0.9
			});
		});

		sitemapStream.end();
		await streamToPromise(sitemapStream);
		console.log("✅ Sitemap généré avec succès !");
	} catch (error) {
		console.error("❌ Erreur lors de la génération du sitemap :", error);
	}
}

generateSitemap();