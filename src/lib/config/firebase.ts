import {
	getFirestore,
	initializeFirestore,
	memoryLocalCache,
	persistentLocalCache,
	persistentMultipleTabManager,
	type Firestore,
} from "firebase/firestore";
import { app, auth } from "./firebase-app";

/**
 * Firestore. Importer ce module charge le SDK Firestore (~320 Ko) :
 * dans les composants affichés à tous les visiteurs, préférer loadFirestore() (firestore-lazy.ts).
 *
 * Dans le navigateur, les documents lus sont gardés sur l'appareil (IndexedDB) : carnet, favoris
 * et liste de courses restent consultables hors ligne, et les modifications faites sans réseau
 * sont envoyées au retour de la connexion. Le cache est vidé à la déconnexion (AuthContext).
 */
function createFirestore(): Firestore {
	try {
		return initializeFirestore(app, {
			localCache: typeof window === 'undefined'
				? memoryLocalCache()
				: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
		});
	} catch {
		// Déjà initialisé (rechargement à chaud en développement)
		return getFirestore(app);
	}
}

const db = createFirestore();

export { db, auth };
