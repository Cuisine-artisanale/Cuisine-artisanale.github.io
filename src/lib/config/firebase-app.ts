import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
	apiKey: "AIzaSyCRqPaeQ_8kRByuf8l9_Fkcbmdgy_0aWI4",
	authDomain: "recettes-cuisine-a1bf2.firebaseapp.com",
	projectId: "recettes-cuisine-a1bf2",
	storageBucket: "recettes-cuisine-a1bf2.firebasestorage.app",
	messagingSenderId: "854150054780",
	appId: "1:854150054780:web:e3866880aea3e01d5c1af9",
	measurementId: "G-1J6YNX5LZM"
};

/**
 * App Firebase + Auth uniquement (léger) : utilisé par le layout (AuthContext).
 * Firestore (~320 Ko) est dans firebase.ts et se charge à la demande via firestore-lazy.ts.
 */
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
