"use client";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./NewsletterPopup.css";

const NewsletterPopup: React.FC = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [closing, setClosing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 🔸 Vérifie si la popup doit s'afficher (toutes les 31 jours)
  useEffect(() => {
	const lastShown = localStorage.getItem("newsletter_last_shown");
	const oneMonth = 31 * 24 * 60 * 60 * 1000;
	const now = Date.now();

	if (!lastShown || now - parseInt(lastShown) > oneMonth) {
	  const timer = setTimeout(() => {
		setShowPopup(true);
		localStorage.setItem("newsletter_last_shown", now.toString());
	  }, 10000); // Affiche après 10 secondes
	  return () => clearTimeout(timer);
	}
  }, []);

  const subscribeToNewsletter = async (e: React.FormEvent) => {
	e.preventDefault();

	if (!email) return;

	setIsLoading(true);
	setStatus("");

	try {
	  // Utiliser la nouvelle API route unifiée
	  const response = await fetch("/api/newsletter/subscribe", {
		method: "POST",
		headers: {
		  "Content-Type": "application/json",
		},
		body: JSON.stringify({ email }),
	  });

	  const data = await response.json();

	  if (data.success) {
		setStatus("✅ " + data.message);
		setEmail("");
		setTimeout(() => setShowPopup(false), 3000);
	  } else {
		setStatus("❌ " + (data.error || "Une erreur est survenue. Réessayez plus tard."));
	  }
	} catch (error) {
	  console.error("Erreur lors de l'inscription:", error);
	  setStatus("❌ Une erreur est survenue. Réessayez plus tard.");
	} finally {
	  setIsLoading(false);
	}
  };

	const handleClose = () => {
	setClosing(true);
	setTimeout(() => {
		setShowPopup(false);
		setClosing(false);
	}, 400);
	};


  return (
	<AnimatePresence>
	  {showPopup && (
		<motion.div
		  className="newsletter-overlay"
		  initial={{ opacity: 0 }}
		  animate={{ opacity: 1 }}
		  exit={{ opacity: 0 }}
		>
		  <motion.div
			className={`newsletter-popup ${closing ? "closing" : ""}`}
			initial={{ x: 400, opacity: 0 }} // 👉 glisse depuis la droite
			animate={{ x: 0, opacity: 1 }}
			exit={{ x: 400, opacity: 0 }}
			transition={{ type: "spring", damping: 20, stiffness: 200 }}
			>

			<button onClick={handleClose} className="newsletter-close">
			  ✕
			</button>

			<h2>🍪 Rejoignez la newsletter</h2>
			<p>Recevez chaque dimanche une recette facile et gourmande !</p>

			<form onSubmit={subscribeToNewsletter}>
			  <input
				type="email"
				placeholder="Votre email"
				value={email}
				onChange={(e) => setEmail(e.target.value)}
				required
				disabled={isLoading}
			  />
			  <button type="submit" disabled={isLoading}>
				{isLoading ? "Inscription..." : "S'abonner 🍰"}
			  </button>
			</form>

			{status && <p className="newsletter-status">{status}</p>}
		  </motion.div>
		</motion.div>
	  )}
	</AnimatePresence>
  );
};

export default NewsletterPopup;
