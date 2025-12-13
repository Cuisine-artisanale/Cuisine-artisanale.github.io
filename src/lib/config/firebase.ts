import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage, auth };

