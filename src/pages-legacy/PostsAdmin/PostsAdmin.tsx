"use client";
import React, { useEffect, useState, useRef } from 'react';
import './PostsAdmin.css';
import { collection, onSnapshot, orderBy, query, deleteDoc, doc, addDoc, limit } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { DataView } from 'primereact/dataview';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ProgressSpinner } from 'primereact/progressspinner';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { toastMessages } from '@/lib/utils/toast';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import { Paginator } from 'primereact/paginator';
import type { Post } from '@/types';

interface PostAdmin extends Post {
  status?: 'pending' | 'approved' | 'rejected';
}

const PostsAdmin: React.FC = () => {
  const [posts, setPosts] = useState<PostAdmin[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [globalFilter, setGlobalFilter] = useState<string>('');
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [first, setFirst] = useState(0);
  const [rows] = useState(9);
  const toast = useRef<Toast>(null);
  const { showToast } = useToast();

  const sortOptions = [
	{ label: 'Plus récent', value: 'createdAt:desc' },
	{ label: 'Plus ancien', value: 'createdAt:asc' },
	{ label: 'Titre A-Z', value: 'title:asc' },
	{ label: 'Titre Z-A', value: 'title:desc' }
  ];

  const formatDate = (date: Date) => {
	return date.toLocaleDateString("fr-FR", {
	  weekday: "long",
	  year: "numeric",
	  month: "long",
	  day: "numeric",
	  hour: "2-digit",
	  minute: "2-digit"
	});
  };

  const handleFetchPosts = () => {
	try {
	  setLoading(true);
	  const postsQuery = query(
		collection(db, "postsRequest"),
		orderBy("createdAt", "desc"),
		limit(100) // Fetch max 100 for admin (reasonable limit)
	  );

	  const unsubscribe = onSnapshot(postsQuery, (querySnapshot) => {
		const postsData: PostAdmin[] = querySnapshot.docs.map((doc) => {
		  const data = doc.data();
		  return {
			id: doc.id,
			title: data.title,
			content: data.content,
			createdAt: data.createdAt?.toDate(),
			author: data.author,
			status: data.status
		  } as PostAdmin;
		});

		// Sort based on current sort settings
		postsData.sort((a, b) => {
		  let aValue: any = sortField === 'createdAt' ? a.createdAt?.getTime() : a[sortField as keyof Post];
		  let bValue: any = sortField === 'createdAt' ? b.createdAt?.getTime() : b[sortField as keyof Post];

		  if (sortOrder === 'asc') {
			return aValue > bValue ? 1 : -1;
		  } else {
			return aValue < bValue ? 1 : -1;
		  }
		});

		setPosts(postsData);
		setLoading(false);
	  }, (error) => {
		console.error("Error getting posts:", error);
		showToast({
		  severity: 'error',
		  summary: toastMessages.error.default,
		  detail: 'Impossible de charger les posts'
		});
		setLoading(false);
	  });

	  return unsubscribe;
	} catch (error) {
	  console.error("Error in handleFetchPosts:", error);
	  setLoading(false);
	  return () => {};
	}
  };

  useEffect(() => {
	const unsubscribe = handleFetchPosts();
	return () => unsubscribe();
  }, []);

  const handleAcceptPost = async (post: Post) => {
	try {
	  // Add to posts collection
	  await addDoc(collection(db, 'posts'), {
		title: post.title,
		content: post.content,
		createdAt: new Date(),
		likes: []
	  });

	  // Delete from postsRequest
	  await deleteDoc(doc(db, 'postsRequest', post.id));

	  showToast({
		severity: 'success',
		summary: toastMessages.success.default,
		detail: toastMessages.success.accept
	  });
	} catch (error) {
	  console.error('Error accepting post:', error);
	  showToast({
		severity: 'error',
		summary: toastMessages.error.default,
		detail: toastMessages.error.accept
	  });
	}
  };

  const handleRejectPost = async (postId: string) => {
	try {
	  await deleteDoc(doc(db, 'postsRequest', postId));
	  showToast({
		severity: 'info',
		summary: toastMessages.info.default,
		detail: toastMessages.info.reject
	  });
	} catch (error) {
	  console.error('Error rejecting post:', error);
	  showToast({
		severity: 'error',
		summary: toastMessages.error.default,
		detail: toastMessages.error.reject
	  });
	}
  };

  const confirmReject = (post: Post) => {
	confirmDialog({
	  message: `Êtes-vous sûr de vouloir rejeter le post "${post.title}" ?`,
	  header: 'Confirmation de rejet',
	  icon: 'pi pi-exclamation-triangle',
	  acceptLabel: 'Oui',
	  rejectLabel: 'Non',
	  accept: () => handleRejectPost(post.id)
	});
  };

  const confirmAccept = (post: Post) => {
	confirmDialog({
	  message: `Êtes-vous sûr de vouloir accepter et publier le post "${post.title}" ?`,
	  header: 'Confirmation de publication',
	  icon: 'pi pi-check-circle',
	  acceptLabel: 'Oui',
	  rejectLabel: 'Non',
	  accept: () => handleAcceptPost(post)
	});
  };

  const confirmDelete = (postId: string, title: string) => {
	confirmDialog({
	  message: `Êtes-vous sûr de vouloir supprimer le post "${title}" ?`,
	  header: 'Confirmation de suppression',
	  icon: 'pi pi-exclamation-triangle',
	  acceptLabel: 'Oui',
	  rejectLabel: 'Non',
	  accept: () => handleDelete(postId)
	});
  };

  const handleDelete = async (postId: string) => {
	try {
	  await deleteDoc(doc(db, 'posts', postId));
	  showToast({
		severity: 'success',
		summary: toastMessages.success.default,
		detail: toastMessages.success.delete
	  });
	} catch (error) {
	  console.error('Erreur de suppression:', error);
	  showToast({
		severity: 'error',
		summary: toastMessages.error.default,
		detail: toastMessages.error.delete
	  });
	}
  };

  const handleSortChange = (e: { value: string }) => {
	const [field, order] = e.value.split(':');
	setSortField(field);
	setSortOrder(order as 'asc' | 'desc');
  };

  const header = () => {
	return (
	  <div className="posts-header">
		<h2>Gestion des Posts</h2>
		<div className="posts-header-actions">
		  <span className="p-input-icon-left">
			<i className="pi pi-search" />
			<InputText
			  value={globalFilter}
			  onChange={(e) => setGlobalFilter(e.target.value)}
			  placeholder="Rechercher..."
			/>
		  </span>
		  <Dropdown
			value={`${sortField}:${sortOrder}`}
			options={sortOptions}
			onChange={handleSortChange}
			className="sort-dropdown"
		  />
		</div>
	  </div>
	);
  };


  const itemTemplate = (post: Post) => {
	const statusColors = {
	  pending: 'var(--warning-color)',
	  approved: 'var(--success-color)',
	  rejected: 'var(--danger-color)'
	};

	return (
	  <div className="post-card">
		<div className="post-card-header">
		  <h3>{post.title}</h3>
		  <span
			className="post-status"
			style={{ backgroundColor: statusColors[post.status || 'pending'] }}
		  >
			{post.status === 'pending' ? 'En attente' :
			 post.status === 'approved' ? 'Approuvé' : 'Rejeté'}
		  </span>
		</div>
		<div className="post-card-content">
		  <p>{post.content}</p>
		</div>
		<div className="post-card-footer">
		  <div className="post-info">
			<span className="post-author">
			  <i className="pi pi-user" /> {post.author}
			</span>
			<span className="post-date">
			  <i className="pi pi-calendar" /> {formatDate(post.createdAt)}
			</span>
		  </div>
		  <div className="post-actions">
			<Button
			  icon="pi pi-check"
			  className="p-button-rounded p-button-success p-button-text"
			  onClick={() => confirmAccept(post)}
			  tooltip="Approuver"
			/>
			<Button
			  icon="pi pi-times"
			  className="p-button-rounded p-button-warning p-button-text"
			  onClick={() => confirmReject(post)}
			  tooltip="Rejeter"
			/>
			<Button
			  icon="pi pi-trash"
			  className="p-button-rounded p-button-danger p-button-text"
			  onClick={() => confirmDelete(post.id, post.title)}
			  tooltip="Supprimer"
			/>
		  </div>
		</div>
	  </div>
	);
  };

  if (loading) {
	return (
	  <div className="loading-container">
		<ProgressSpinner />
		<p>Chargement des posts...</p>
	  </div>
	);
  }

  const filteredPosts = posts.filter(post =>
	post.title.toLowerCase().includes(globalFilter.toLowerCase()) ||
	post.content.toLowerCase().includes(globalFilter.toLowerCase()) ||
	post.author?.toLowerCase().includes(globalFilter.toLowerCase())
  );

  return (
	<div className="posts-admin">
	  <Toast ref={toast} />
	  <ConfirmDialog />

	  <DataView
		value={filteredPosts}
		layout="grid"
		header={header()}
		itemTemplate={itemTemplate}
		paginator
		rows={9}
		first={first}
		onPage={(e) => setFirst(e.first)}
		emptyMessage="Aucun post trouvé"
	  />
	</div>
  );
};

export default PostsAdmin;
