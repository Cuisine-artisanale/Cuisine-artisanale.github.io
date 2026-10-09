import { getStorage } from "firebase/storage";
import { app } from "./firebase-app";

/** Firebase Storage (upload des photos) : uniquement pour les formulaires d'ajout / d'édition. */
export const storage = getStorage(app);
