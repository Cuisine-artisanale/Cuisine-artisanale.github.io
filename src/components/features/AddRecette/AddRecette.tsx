"use client";
import React from 'react';
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
	<div className="AddRecette">
	  <h2>Ajouter une recette</h2>
	  <p>Partage tes recettes avec le monde !</p>
	  <br />
	  <br />
	  <Button onClick={handleClick} disabled={!user}>Ajouter une recette</Button>
	  {!user && <h3>Vous devez être connecté pour ajouter un post</h3>}

	</div>
  );
};

export default AddRecette;
