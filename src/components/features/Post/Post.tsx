"use client";
import React, { useEffect, useState } from 'react';
import './Post.css';
import { Button } from 'primereact/button';
import { toggleLikePost, unlikePost } from '@/lib/services/post.service';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { deleteDoc, doc, onSnapshot, updateDoc } from '@firebase/firestore';
import { db } from '@/lib/config/firebase';
import { ConfirmDialog } from '@/components/ui';
import { useConfirmDialog } from '@/hooks';
import { toastMessages } from '@/lib/utils/toast';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import type { Post as PostType } from '@/types';

interface PostProps {
  postId: string;
  title: string;
  content: string;
  createdAt: string;
  userName: string;
  fromRequest?: boolean;
  visible?: boolean;
}

const Post: React.FC<PostProps> = ({ postId, title, content, createdAt, fromRequest = false, visible = true, userName }) => {
  const { user, role } = useAuth();
  const [likes, setLikes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(visible);
  const userId = user?.uid;
  const { showToast } = useToast();
  const { confirm, visible: dialogVisible, dialogState, handleAccept, handleReject } = useConfirmDialog();

  useEffect(() => {
	const unsubscribe = onSnapshot(doc(db, "posts", postId), (docSnapshot) => {
	  if (docSnapshot.exists()) {
		const data = docSnapshot.data();
		setLikes(data.likes || []);
		setIsVisible(data.visible !== false); // Default to true if not set
	  }
	});

	return () => unsubscribe();
  }, [postId]);

  const hasLiked = userId ? likes.includes(userId) : false;

  const handleLike = async () => {
	if (!userId) {
	  showToast({
		severity: 'warn',
		summary: toastMessages.warning.default,
		detail: toastMessages.error.auth
	  });
	  return;
	}

	setIsLoading(true);
	try {
	  if (hasLiked) {
		await unlikePost(postId, userId);
	  } else {
		await toggleLikePost(postId, userId);
	  }
	} catch (error) {
	  showToast({
		severity: 'error',
		summary: toastMessages.error.default,
		detail: 'Une erreur est survenue lors de l\'action.'
	  });
	}
	setIsLoading(false);
  };

  const handleVisibilityToggle = async () => {
	setIsLoading(true);
	try {
	  const postRef = doc(db, 'posts', postId);
	  await updateDoc(postRef, {
		visible: !isVisible
	  });
	  setIsVisible(!isVisible);
	  showToast({
		severity: 'success',
		summary: toastMessages.success.default,
		detail: `Le post est maintenant ${!isVisible ? 'visible' : 'masqué'}.`
	  });
	} catch (error) {
	  showToast({
		severity: 'error',
		summary: toastMessages.error.default,
		detail: 'Erreur lors du changement de visibilité.'
	  });
	}
	setIsLoading(false);
  };

  const confirmDelete = () => {
	confirm({
	  message: 'Êtes-vous sûr de vouloir supprimer ce post ?',
	  header: 'Confirmation de suppression',
	  icon: 'pi pi-exclamation-triangle',
	  acceptLabel: 'Oui',
	  rejectLabel: 'Non',
	  onAccept: handleDelete
	});
  };

  const handleDelete = async () => {
	setIsLoading(true);
	try {
	  const postRef = doc(db, 'posts', postId);
	  await deleteDoc(postRef);
	  showToast({
		severity: 'success',
		summary: toastMessages.success.default,
		detail: toastMessages.success.delete
	  });
	} catch (error) {
	  showToast({
		severity: 'error',
		summary: toastMessages.error.default,
		detail: toastMessages.error.delete
	  });
	}
	setIsLoading(false);
  };

  return (
	<>
	  {dialogState && (
		<ConfirmDialog
		  visible={dialogVisible}
		  message={dialogState.message}
		  header={dialogState.header}
		  icon={dialogState.icon}
		  acceptLabel={dialogState.acceptLabel}
		  rejectLabel={dialogState.rejectLabel}
		  onAccept={handleAccept}
		  onReject={handleReject}
		/>
	  )}
	  <div className={`Post ${fromRequest ? 'Post_request' : ''} ${!isVisible ? 'Post-hidden' : ''}`}>
		<h1>{title}</h1>
		<p style={{ whiteSpace: 'pre-wrap' }}>{content}</p>

		<section className='Section_buttons'>
		  {!fromRequest && (
			<Button
			  className='Post_likeButton'
			  onClick={handleLike}
			  disabled={isLoading}
			  severity={hasLiked ? "danger" : "secondary"}
			  icon={hasLiked ? "pi pi-heart-fill" : "pi pi-heart"}
			  label={likes.length.toString()}
			/>
		  )}

		  {role === 'admin' && !fromRequest && (
			<div className='Post_admin_actions'>
			  <Button
				className='Post_visibilityButton'
				label={isVisible ? "Masquer" : "Afficher"}
				icon={isVisible ? "pi pi-eye-slash" : "pi pi-eye"}
				onClick={handleVisibilityToggle}
				disabled={isLoading}
				severity={isVisible ? "warning" : "success"}
			  />
			  <Button
				className='Post_deleteButton'
				label="Supprimer"
				icon="pi pi-trash"
				onClick={confirmDelete}
				disabled={isLoading}
				severity="danger"
			  />
			  <span className="post-date">{createdAt} </span>
			  <span className='post-user'>{userName}</span>
			</div>
		  )}
		</section>
	  </div>
	</>
  );
};

export default Post;