import { getFirestore } from "firebase/firestore";
import { app, auth } from "./firebase-app";

/**
 * Firestore. Importer ce module charge le SDK Firestore (~320 Ko) :
 * dans les composants affichés à tous les visiteurs, préférer loadFirestore() (firestore-lazy.ts).
 */
const db = getFirestore(app);

export { db, auth };
