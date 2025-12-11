import React, { useState } from 'react';
import './AddPost.css';
import { Button } from 'primereact/button';
import { AddPostForm } from '@/components/features';
import { useAuth } from '@contexts/AuthContext/AuthContext';

const AddPost: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const { user } = useAuth();

  const handleMobileClick = () => {
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
		<Button onClick={handleMobileClick} disabled={!user}>
		  Ajouter un post
		</Button>
		{!user && <p>Vous devez être connecté pour ajouter un post</p>}
	  </div>

	  {/* Floating mobile button */}
	  <div className="mobile-floating-button" onClick={handleMobileClick}>
		<Button
		  icon="pi pi-plus"
		  aria-label="Ajouter un post"
		  className="p-button-rounded p-button-lg"
		/>
	  </div>

	  {showForm && <AddPostForm closeForm={handleCloseForm} />}
	</div>
  );
};

export default AddPost;
