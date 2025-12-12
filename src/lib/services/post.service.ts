import { db } from "@/lib/config/firebase";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";

export const toggleLikePost = async (postId: string, userId: string) => {
  try {
	const postRef = doc(db, "posts", postId);

	// Vérifier si l'utilisateur a déjà liké (Firestore le gère côté serveur)
	await updateDoc(postRef, {
	  likes: arrayUnion(userId),
	});

  } catch (error) {
	console.error("Error liking post: ", error);
  }
};

export const unlikePost = async (postId: string, userId: string) => {
  try {
	const postRef = doc(db, "posts", postId);

	// Supprimer l'utilisateur de la liste des likes
	await updateDoc(postRef, {
	  likes: arrayRemove(userId),
	});

  } catch (error) {
	console.error("Error unliking post: ", error);
  }
};

