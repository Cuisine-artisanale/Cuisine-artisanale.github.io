"use client";
import React, { useEffect, useState } from 'react';
import './posts-admin.css';
import { collection, onSnapshot, orderBy, query, deleteDoc, doc, addDoc, limit } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { toastMessages } from '@/lib/utils/toast';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import { ConfirmDialog } from '@/components/ui';
import { useConfirmDialog } from '@/hooks';
import type { Post } from '@/types';

interface PostAdmin extends Post {
  status?: 'pending' | 'approved' | 'rejected';
}

export default function PostsAdminPage() {
  const [posts, setPosts] = useState<PostAdmin[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [globalFilter, setGlobalFilter] = useState<string>('');
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [first, setFirst] = useState(0);
  const [rows] = useState(9);
  const { showToast } = useToast();
  const { confirm, visible, dialogState, handleAccept, handleReject } = useConfirmDialog();

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
        limit(100)
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

  useEffect(() => {
    const sorted = [...posts].sort((a, b) => {
      let aValue: any = sortField === 'createdAt' ? a.createdAt?.getTime() : a[sortField as keyof Post];
      let bValue: any = sortField === 'createdAt' ? b.createdAt?.getTime() : b[sortField as keyof Post];

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    setPosts(sorted);
  }, [sortField, sortOrder]);

  const handleAcceptPost = async (post: Post) => {
    try {
      await addDoc(collection(db, 'posts'), {
        title: post.title,
        content: post.content,
        createdAt: new Date(),
        likes: []
      });

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
    confirm({
      message: `Êtes-vous sûr de vouloir rejeter le post "${post.title}" ?`,
      header: 'Confirmation de rejet',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Oui',
      rejectLabel: 'Non',
      onAccept: () => handleRejectPost(post.id)
    });
  };

  const confirmAccept = (post: Post) => {
    confirm({
      message: `Êtes-vous sûr de vouloir accepter et publier le post "${post.title}" ?`,
      header: 'Confirmation de publication',
      icon: 'pi pi-check-circle',
      acceptLabel: 'Oui',
      rejectLabel: 'Non',
      onAccept: () => handleAcceptPost(post)
    });
  };

  const confirmDelete = (postId: string, title: string) => {
    confirm({
      message: `Êtes-vous sûr de vouloir supprimer le post "${title}" ?`,
      header: 'Confirmation de suppression',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Oui',
      rejectLabel: 'Non',
      onAccept: () => handleDelete(postId)
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

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [field, order] = e.target.value.split(':');
    setSortField(field);
    setSortOrder(order as 'asc' | 'desc');
  };

  const handlePageChange = (newFirst: number) => {
    setFirst(newFirst);
  };

  const filteredPosts = posts.filter(post =>
    post.title.toLowerCase().includes(globalFilter.toLowerCase()) ||
    post.content.toLowerCase().includes(globalFilter.toLowerCase()) ||
    post.author?.toLowerCase().includes(globalFilter.toLowerCase())
  );

  const paginatedPosts = filteredPosts.slice(first, first + rows);
  const totalPages = Math.ceil(filteredPosts.length / rows);
  const currentPage = Math.floor(first / rows) + 1;
  const startRecord = first + 1;
  const endRecord = Math.min(first + rows, filteredPosts.length);

  const statusColors = {
    pending: 'var(--yellow-500)',
    approved: 'var(--green-500)',
    rejected: 'var(--red-500)'
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Chargement des posts...</p>
      </div>
    );
  }

  return (
    <div className="posts-admin">
      {dialogState && (
        <ConfirmDialog
          visible={visible}
          message={dialogState.message}
          header={dialogState.header}
          icon={dialogState.icon}
          acceptLabel={dialogState.acceptLabel}
          rejectLabel={dialogState.rejectLabel}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      )}

      <div className="posts-header">
        <h2>Gestion des Posts</h2>
        <div className="posts-header-actions">
          <div className="input-icon-left">
            <i className="pi pi-search" />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Rechercher..."
              className="search-input"
            />
          </div>
          <select
            value={`${sortField}:${sortOrder}`}
            onChange={handleSortChange}
            className="sort-dropdown"
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      {paginatedPosts.length === 0 ? (
        <div className="empty-message">Aucun post trouvé</div>
      ) : (
        <>
          <div className="posts-grid">
            {paginatedPosts.map((post) => (
              <div key={post.id} className="post-card">
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
                  <p style={{ whiteSpace: 'pre-wrap' }}>{post.content}</p>
                </div>
                <div className="post-card-footer">
                  <div className="post-info">
                    <span className="post-author">
                      <i className="pi pi-user" /> {post.author}
                    </span>
                    <span className="post-date">
                      <i className="pi pi-calendar" /> {post.createdAt ? formatDate(post.createdAt) : ''}
                    </span>
                  </div>
                  <div className="post-actions">
                    <button
                      className="btn-action btn-success"
                      onClick={() => confirmAccept(post)}
                      title="Approuver"
                    >
                      <i className="pi pi-check"></i>
                    </button>
                    <button
                      className="btn-action btn-warning"
                      onClick={() => confirmReject(post)}
                      title="Rejeter"
                    >
                      <i className="pi pi-times"></i>
                    </button>
                    <button
                      className="btn-action btn-danger"
                      onClick={() => confirmDelete(post.id, post.title)}
                      title="Supprimer"
                    >
                      <i className="pi pi-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredPosts.length > rows && (
            <div className="pagination-wrapper">
              <div className="pagination-info">
                Affichage de {startRecord} à {endRecord} sur {filteredPosts.length}
              </div>
              <div className="pagination">
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(0)}
                  disabled={first === 0}
                  aria-label="Première page"
                >
                  <i className="pi pi-angle-double-left"></i>
                </button>
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(Math.max(0, first - rows))}
                  disabled={first === 0}
                  aria-label="Page précédente"
                >
                  <i className="pi pi-angle-left"></i>
                </button>
                <div className="pagination-pages">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    const pageFirst = (page - 1) * rows;
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={page}
                          className={`pagination-page ${page === currentPage ? 'active' : ''}`}
                          onClick={() => handlePageChange(pageFirst)}
                          aria-label={`Page ${page}`}
                        >
                          {page}
                        </button>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return <span key={page} className="pagination-ellipsis">...</span>;
                    }
                    return null;
                  })}
                </div>
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(Math.min(filteredPosts.length - rows, first + rows))}
                  disabled={first + rows >= filteredPosts.length}
                  aria-label="Page suivante"
                >
                  <i className="pi pi-angle-right"></i>
                </button>
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange((totalPages - 1) * rows)}
                  disabled={first + rows >= filteredPosts.length}
                  aria-label="Dernière page"
                >
                  <i className="pi pi-angle-double-right"></i>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
