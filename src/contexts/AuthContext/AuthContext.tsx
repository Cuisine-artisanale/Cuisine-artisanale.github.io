"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "@/lib/config/firebase";
import {
  User,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  updateProfile
} from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, getDocs } from "firebase/firestore";

// Flag pour désactiver temporairement la vérification email
// Mettre à true pour réactiver la vérification email
const REQUIRE_EMAIL_VERIFICATION = false;

interface AuthContextType {
  user: User | null;
  role: string | null;
  displayName?: string | null;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  refreshUserData: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserRole = async (userId: string) => {
	const db = getFirestore();
	const userRef = doc(db, "users", userId);
	const userDoc = await getDoc(userRef);
	if (userDoc.exists()) {
	  return userDoc.data().role;
	}
	return null;
  };

  const fetchUserDisplayName = async (userId: string, googleDisplayName: string | null) => {
	try {
	  const db = getFirestore();
	  const userRef = doc(db, "users", userId);
	  const userDoc = await getDoc(userRef);

	  // D'abord vérifier Firestore
	  if (userDoc.exists() && userDoc.data().displayName) {
		return userDoc.data().displayName;
	  }

	  // Sinon utiliser le displayName de Google
	  return googleDisplayName || null;
	} catch (err) {
	  console.error("Error fetching display name:", err);
	  return googleDisplayName || null;
	}
  };

  const createUserInFirestore = async (userId: string, email: string, displayName: string, emailVerified: boolean = false) => {
	const db = getFirestore();
	const userRef = doc(db, "users", userId);
	await setDoc(userRef, {
	  email: email,
	  role: "user",
	  createdAt: new Date(),
	  displayName: displayName,
	  emailVerified: emailVerified,
	  ...(emailVerified && { emailVerifiedAt: new Date() })
	});
  };

  const refreshUserData = async () => {
	if (!user) return;
	try {
	  const db = getFirestore();
	  const userRef = doc(db, "users", user.uid);
	  const userDoc = await getDoc(userRef);

	  if (userDoc.exists()) {
		const userData = userDoc.data();
		setRole(userData.role || null);
	  }

	  // Récupérer le displayName : d'abord Firestore, puis Google
	  const displayNameFromFirestore = await fetchUserDisplayName(user.uid, user.displayName);
	  setDisplayName(displayNameFromFirestore);
	} catch (err) {
	  console.error("Error refreshing user data:", err);
	  setError(err instanceof Error ? err.message : "Error refreshing user data");
	}
  };

  useEffect(() => {
	const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
	  try {
		if (currentUser) {
		  // Set user even if email is not verified (we'll handle protection in routes)
		  setUser(currentUser);

		  const userRole = await fetchUserRole(currentUser.uid);

		  if (!userRole) {
			await createUserInFirestore(currentUser.uid, currentUser.email || "", currentUser.displayName || "");
			setRole("user");
		  } else {
			setRole(userRole);
		  }

		  // Récupérer le displayName : d'abord Firestore, puis Google
		  const displayNameFromFirestore = await fetchUserDisplayName(currentUser.uid, currentUser.displayName);
		  setDisplayName(displayNameFromFirestore);
		} else {
		  setUser(null);
		  setRole(null);
		  setDisplayName(null);
		}
	  } catch (err) {
		console.error("Error in auth state change:", err);
		setError(err instanceof Error ? err.message : "An error occurred");
	  } finally {
		setLoading(false);
	  }
	});

	return () => unsubscribe();
  }, []);

  const logout = async () => {
	try {
	  setError(null);
	  await signOut(auth);
	  setRole(null);
	  window.location.href = "/";
	} catch (err) {
	  console.error("Error signing out:", err);
	  setError(err instanceof Error ? err.message : "Error signing out");
	}
  };

  const signInWithGoogle = async () => {
	try {
	  setError(null);
	  const provider = new GoogleAuthProvider();
	  const result = await signInWithPopup(auth, provider);

	  if (result.user) {
		const userRole = await fetchUserRole(result.user.uid);
		if (!userRole) {
		  // Les utilisateurs Google ont leur email vérifié automatiquement
		  await createUserInFirestore(result.user.uid, result.user.email || "", result.user.displayName || "", true);
		  setRole("user");
		}
	  }
	} catch (err) {
	  console.error("Error signing in with Google:", err);
	  setError(err instanceof Error ? err.message : "Error signing in with Google");
	  throw err;
	}
  };

  const signInWithEmail = async (email: string, password: string) => {
	try {
	  setError(null);
	  const result = await signInWithEmailAndPassword(auth, email, password);

	  // Check if email is verified (seulement si la vérification est activée)
	  if (REQUIRE_EMAIL_VERIFICATION && !result.user.emailVerified) {
		await signOut(auth);
		throw new Error("Veuillez vérifier votre email avant de vous connecter. Un email de vérification vous a été envoyé.");
	  }
	  const userRole = await fetchUserRole(result.user.uid);
	  if (userRole) {
		setRole(userRole);
	  }

	} catch (err: any) {
	  console.error("Error signing in with email:", err);
	  setError(err.message || "Error signing in with email");
	  throw err;
	}
  };

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
	try {
	  setError(null);

	  // Create user account
	  console.log('Creating user account...');
	  const result = await createUserWithEmailAndPassword(auth, email, password);
	  console.log('User account created:', result.user.uid);

	  // Update profile with display name
	  console.log('Updating profile with display name...');
	  await updateProfile(result.user, {
		displayName: displayName
	  });

	  // Send verification email via API route Next.js (seulement si la vérification est activée)
	  if (REQUIRE_EMAIL_VERIFICATION) {
		console.log('Sending verification email via API route (Resend) to:', email);
		try {
		  const response = await fetch('/api/send-verification-email', {
			method: 'POST',
			headers: {
			  'Content-Type': 'application/json',
			},
			body: JSON.stringify({
			  email: email,
			  displayName: displayName,
			  uid: result.user.uid, // Passer l'UID pour vérifier l'existence de l'utilisateur
			}),
		  });

		  const responseData = await response.json();

		  if (!response.ok) {
			console.error("❌ Erreur API route:", responseData);
			throw new Error(responseData.error || responseData.message || 'Erreur lors de l\'envoi de l\'email');
		  }

		  console.log('✅ Verification email sent successfully via API route (Resend)!', responseData);
		} catch (emailError: any) {
		  console.error("❌ Erreur lors de l'envoi de l'email de vérification:", emailError);
		  console.error("❌ Détails de l'erreur:", {
			message: emailError.message,
			stack: emailError.stack,
			response: emailError.response
		  });

		  // Si l'envoi d'email échoue, on continue quand même pour créer l'utilisateur
		  // L'utilisateur pourra demander un renvoi d'email plus tard
		  if (emailError.message?.includes('Trop de demandes') || emailError.message?.includes('too-many-requests')) {
			throw new Error('Trop de demandes. Veuillez réessayer dans quelques minutes.');
		  }
		  throw new Error(emailError.message || 'Erreur lors de l\'envoi de l\'email de vérification. Veuillez réessayer.');
		}
	  } else {
		console.log('⚠️ Envoi d\'email de vérification désactivé (REQUIRE_EMAIL_VERIFICATION = false)');
	  }

	  // Create user in Firestore
	  // Si la vérification est désactivée, considérer l'email comme vérifié
	  console.log('Creating user document in Firestore...');
	  await createUserInFirestore(result.user.uid, email, displayName, !REQUIRE_EMAIL_VERIFICATION);
	  console.log('User document created in Firestore');

	  if (REQUIRE_EMAIL_VERIFICATION) {
		// Don't sign out - let the user stay logged in but restrict access to protected routes
		console.log('User remains logged in but email not verified yet');
	  } else {
		console.log('✅ User created and logged in (email verification disabled)');
	  }
	} catch (err: any) {
	  console.error("❌ Error signing up with email:", err);
	  console.error("Error code:", err.code);
	  console.error("Error message:", err.message);
	  setError(err.message || "Error signing up with email");
	  throw err;
	}
  };

  return (
	<AuthContext.Provider value={{
	  user,
	  role,
	  displayName,
	  logout,
	  signInWithGoogle,
	  signInWithEmail,
	  signUpWithEmail,
	  refreshUserData,
	  loading,
	  error
	}}>
	  {children}
	</AuthContext.Provider>
  );
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
};
