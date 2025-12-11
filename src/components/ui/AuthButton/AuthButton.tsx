import React from "react";
import { Button } from "primereact/button";
import { auth } from "@/lib/config/firebase";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { useAuth } from "@/contexts/AuthContext/AuthContext";

interface AuthButtonProps {
  onClick?: () => void; // Ajout de la prop onClick
}

const AuthButton: React.FC<AuthButtonProps> = ({ onClick }) => {
  const { user, logout } = useAuth(); // Utilisation du contexte

  const handleLogin = async () => {
	try {
	  const provider = new GoogleAuthProvider();
	  await signInWithPopup(auth, provider);
	} catch (error) {
	  console.error("Error during login: ", error);
	}
  };

  return user ? (
	<Button label={`Logout`} onClick={() => { logout(); if (onClick) onClick(); }}  />
  ) : (
	<Button label="Login with Google" onClick={() => { handleLogin(); if (onClick) onClick(); }}  />
  );
};

export default AuthButton;
