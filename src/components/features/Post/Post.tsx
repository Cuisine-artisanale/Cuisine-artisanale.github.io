"use client";
import React, { useState } from 'react';
import './Post.css';
import { Button } from 'primereact/button';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { loadFirestore } from '@/lib/config/firestore-lazy';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog/ConfirmDialog';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { toastMessages } from '@/lib/utils/toast';
import { useToast } from '@/contexts/ToastContext/ToastContext';

interface PostProps {
  postId: string;
  title: string;
  content: string;
  createdAt: string;
  userName: string;
  fromRequest?: boolean;
  visible?: boolean;
  /** ids des utilisateurs ayant liké (chargés avec le post, sans écoute temps réel) */
  likes?: string[];
  /** Appelé après suppression, pour retirer le post de la liste */
  onDeleted?: (postId: string) => void;
}

const Post: React.FC<PostProps> = ({ postId, title, content, createdAt, fromRequest = false, visible = true, userName, likes: initialLikes = [], onDeleted }) => {
  const { user, role } = useAuth();
  const [likes, setLikes] = useState<string[]>(initialLikes);
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(visible);
  const userId = user?.uid;
  const { showToast } = useToast();
  const { confirm, visible: dialogVisible, dialogState, handleAccept, handleReject } = useConfirmDialog();

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
	  // Service chargé à la demande (Firestore n'est téléchargé qu'au premier clic)
	  const { toggleLikePost, unlikePost } = await import('@/lib/services/post.service');
	  if (hasLiked) {
		await unlikePost(postId, userId);
		setLikes((prev) => prev.filter((id) => id !== userId));
	  } else {
		await toggleLikePost(postId, userId);
		setLikes((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
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
	  const { db, doc, updateDoc } = await loadFirestore();
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
	  const { db, doc, deleteDoc } = await loadFirestore();
	  const postRef = doc(db, 'posts', postId);
	  await deleteDoc(postRef);
	  onDeleted?.(postId);
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
		<h2>{title}</h2>
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