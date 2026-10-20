"use client";
import React, { useState } from 'react';
import './AddPost.css';
import { Button } from 'primereact/button';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext/AuthContext';

// Formulaire (et Firestore) chargés seulement à l'ouverture
const AddPostForm = dynamic(() => import('@/components/features/AddPostForm/AddPostForm'), { ssr: false });

const AddPost: React.FC<{ onPosted?: () => void }> = ({ onPosted }) => {
	const [showForm, setShowForm] = useState(false);
	const { user } = useAuth();

	const handleOpenForm = () => {
		setShowForm(true);
	};

	const handleCloseForm = () => {
		setShowForm(false);
	};

	return (
		<div className="AddPost">
			{/* Desktop layout */}
			<div className="desktop-post">
				<h2>Ajouter un post</h2>
				<p>Partagez vos pensées avec le monde !</p>
				<Button onClick={handleOpenForm} disabled={!user}>
					Ajouter un post
				</Button>
				{!user && <p>Vous devez être connecté pour ajouter un post</p>}
			</div>

			{/* Téléphone : bouton explicite en tête du fil (et non un « + » flottant sur toute la page) */}
			{user && (
				<button type="button" className="mobile-post-button" onClick={handleOpenForm}>
					<span className="pi pi-pencil" aria-hidden="true"></span>
					Écrire un post
				</button>
			)}

			{showForm && <AddPostForm closeForm={handleCloseForm} onPosted={onPosted} />}
		</div>
	);
};

export default AddPost;
