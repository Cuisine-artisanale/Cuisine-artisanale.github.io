"use client";
import React from 'react';
import Link from 'next/link';
import './AddRecette.css';
import { Button } from 'primereact/button';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext/AuthContext';

const AddRecette: React.FC = () => {
	const {user } = useAuth();

	const router = useRouter();

	const handleClick = () => {
	router.push("/recettes/add-recipe");
	};

	return (
	<>
	  <div className="AddRecette">
		<h2>Ajouter une recette</h2>
		<p>Partage tes recettes avec le monde !</p>
		<br />
		<br />
		<Button onClick={handleClick} disabled={!user}>Ajouter une recette</Button>
		{!user && <h3>Vous devez être connecté pour ajouter un post</h3>}

	  </div>

	  {/* Sur téléphone : l'import d'une vidéo TikTok, plus simple que le formulaire complet */}
	  <Link href="/recettes/add-recipe?mode=tiktok" className="AddRecette-mobile">
		<span className="pi pi-video" aria-hidden="true"></span>
		<span>
		  <strong>Une recette vue sur TikTok ?</strong>
		  <small>Collez le lien, on la met au propre dans votre carnet.</small>
		</span>
		<span className="pi pi-chevron-right" aria-hidden="true"></span>
	  </Link>
	</>
	);
};

export default AddRecette;
