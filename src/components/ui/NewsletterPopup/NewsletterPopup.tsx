"use client";
import React, { useEffect, useState } from "react";
import emailjs from "@emailjs/browser";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import "./NewsletterPopup.css";

const NewsletterPopup: React.FC = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [closing, setClosing] = useState(false);

  const db = getFirestore();

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

  const sendEmail = async (e: React.FormEvent) => {
	e.preventDefault();

	if (!email) return;

	try {
	  // Enregistre l'email dans Firestore
	  await addDoc(collection(db, "abonnes"), {
		email,
		date: serverTimestamp(),
		subscribed: true,
	  });

	  // Envoie via EmailJS
	  await emailjs.send(
		"service_vxtc0is",	  // 🔹 Ton Service ID
		"template_ejada8v",	 // 🔹 Ton Template ID
		{
		  user_email: email,
		  recette_nom: "Recette de la semaine",
		  recette_url: "https://www.aymeric-sabatier.fr/Cuisine-artisanale",
		  company_name: "Cuisine Artisanale"
		},
		"5xnfDEFOuf9OciDAG"   // 🔹 Ta clé publique EmailJS
	  );

	  setStatus("✅ Merci ! Vous êtes inscrit(e) avec succès !");
	  setEmail("");
	  setTimeout(() => setShowPopup(false), 3000);
	} catch (error) {
	  console.error(error);
	  setStatus("❌ Une erreur est survenue. Réessayez plus tard.");
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

			<form onSubmit={sendEmail}>
			  <input
				type="email"
				placeholder="Votre email"
				value={email}
				onChange={(e) => setEmail(e.target.value)}
				required
			  />
			  <button type="submit">S’abonner 🍰</button>
			</form>

			{status && <p className="newsletter-status">{status}</p>}
		  </motion.div>
		</motion.div>
	  )}
	</AnimatePresence>
  );
};

export default NewsletterPopup;
