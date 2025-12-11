import React, { useState } from 'react';
import './AddPostForm.css';

import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';

import { db } from '@/lib/config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@contexts/AuthContext/AuthContext';

interface AddPostFormProps {
  closeForm: () => void;
}

// List of inappropriate words and phrases (you can expand this list)
const inappropriateContent = [
  // French inappropriate words
  'merde', 'putain', 'con', 'connard', 'salope', 'bite', 'cul', 'enculé', 'fdp', 'ta gueule', 'nique', 'bordel', 'chiant', 'emmerde', 'enculeur', 'pédé', 'gouine', 'batard', 'enculée', 'test', 'penis',

  // English inappropriate words
  'fuck', 'shit', 'bitch', 'ass', 'dick', 'bastard', 'crap', 'slut', 'motherfucker', 'cunt', 'damn', 'pussy', 'prick', 'whore', 'cock', 'retard', 'jerk', 'douche', 'tests'
];

const checkInappropriateContent = (text: string): boolean => {
  const lowerText = text.toLowerCase();
  return inappropriateContent.some(word => lowerText.includes(word));
};

const AddPostForm: React.FC<AddPostFormProps> = ({ closeForm }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
	e.preventDefault();
	setError(null);

	if (!title.trim() || !content.trim() || !user) return;

	// Check for inappropriate content
	if (checkInappropriateContent(title) || checkInappropriateContent(content)) {
	  setError('Le contenu contient des mots inappropriés. Veuillez modifier votre message.');
	  return;
	}

	setLoading(true);
	try {
	  await addDoc(collection(db, 'posts'), {
		title: title.trim(),
		content: content, // Don't trim content to preserve line breaks
		createdAt: serverTimestamp(),
		userId: user.uid,
		userName: user.displayName || 'Anonymous',
		visible: false
	  });
	  closeForm();
	} catch (error) {
	  console.error('Error adding post:', error);
	  setError('Une erreur est survenue lors de la publication du post.');
	} finally {
	  setLoading(false);
	}
  };

  return (
	<div className="AddPostForm">
	  <form className="formPost" onSubmit={handleSubmit}>
		<h3>Nouveau Post</h3>
		{error && (
		  <Message
			severity="error"
			text={error}
			style={{ marginBottom: '1rem' }}
		  />
		)}
		<div>
		  <label htmlFor="title">Titre</label>
		  <InputText
			id="title"
			value={title}
			onChange={(e) => setTitle(e.target.value)}
			placeholder="Entrez le titre"
			required
			autoFocus
		  />
		</div>
		<div>
		  <label htmlFor="content">Contenu</label>
		  <InputTextarea
			id="content"
			value={content}
			onChange={(e) => setContent(e.target.value)}
			placeholder="Écrivez votre post ici..."
			required
			rows={5}
			autoResize
			style={{ whiteSpace: 'pre-wrap' }}
		  />
		</div>
		<div className="buttons-form">
		  <Button
			type="button"
			label="Annuler"
			className="p-button-outlined"
			onClick={closeForm}
			disabled={loading}
		  />
		  <Button
			type="submit"
			label="Publier"
			loading={loading}
			disabled={!title.trim() || !content.trim()}
		  />
		</div>
	  </form>
	</div>
  );
};

export default AddPostForm;
