"use client";
import React, { useEffect, useState, useMemo, Suspense } from 'react';
import './Posts.css';
import { AddPost, Post as PostComponent } from '@/components/features';
import { db } from '@/lib/config/firebase';
import { collection, getDocs, limit, orderBy, query, startAfter } from 'firebase/firestore';
import { Button } from 'primereact/button';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { SkeletonLoader } from '@/components/ui';
import type { Post } from '@/types';

const nbPostsToDisplay = 5;

const Posts: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasMorePosts, setHasMorePosts] = useState<boolean>(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const { role, user } = useAuth();

  const formatDate = (date: Date) =>
	date.toLocaleDateString("fr-FR", {
	  weekday: "long",
	  year: "numeric",
	  month: "long",
	  day: "numeric",
	  hour: "2-digit",
	  minute: "2-digit"
	});

  const fetchInitialPosts = async () => {
	setLoading(true);
	try {
	  const postsQuery = query(
		collection(db, "posts"),
		orderBy("createdAt", "desc"),
		limit(nbPostsToDisplay)
	  );
	  const querySnapshot = await getDocs(postsQuery);
	  const postsData: Post[] = querySnapshot.docs.map((doc) => {
		const data = doc.data();
		return {
		  id: doc.id,
		  title: data.title,
		  content: data.content,
		  createdAt: data.createdAt.toDate(),
		  visible: data.visible !== false,
		  userName: data.userName
		} as Post;
	  });
	  setPosts(postsData);
	  setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
	  setHasMorePosts(querySnapshot.size === nbPostsToDisplay);
	} catch (error) {
	  console.error("Error fetching posts:", error);
	}
	setLoading(false);
  };

  const loadMorePosts = async () => {
	if (!lastVisible || loading) return;
	setLoading(true);

	try {
	  const postsQuery = query(
		collection(db, "posts"),
		orderBy("createdAt", "desc"),
		startAfter(lastVisible),
		limit(nbPostsToDisplay)
	  );
	  const querySnapshot = await getDocs(postsQuery);
	  const postsData: Post[] = querySnapshot.docs.map((doc) => {
		const data = doc.data();
		return {
		  id: doc.id,
		  title: data.title,
		  content: data.content,
		  createdAt: data.createdAt.toDate(),
		  visible: data.visible !== false,
		  userName: data.userName
		} as Post;
	  });
	  setPosts((prev) => [...prev, ...postsData]);
	  setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
	  setHasMorePosts(querySnapshot.size === nbPostsToDisplay);
	} catch (error) {
	  console.error("Error loading more posts:", error);
	}
	setLoading(false);
  };

  const handleScroll = () => setShowScrollTop(window.scrollY > 300);
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  useEffect(() => {
	fetchInitialPosts();
	window.addEventListener('scroll', handleScroll);
	return () => window.removeEventListener('scroll', handleScroll);
  }, [user, role]);

  // Filtrer les posts selon le rôle (memoized)
  const visiblePosts = useMemo(() => {
	return posts.filter(post => post.visible || role === 'admin');
  }, [posts, role]);

  return (
	<div className="Posts">
	  <ConfirmDialog />
	  <section className="Posts_section">

		{loading && visiblePosts.length === 0 && (
		  Array.from({ length: nbPostsToDisplay }).map((_, i) => (
			<div key={i} style={{ marginBottom: '20px' }}>
			  <SkeletonLoader type="text" height="24px" width="70%" style={{ marginBottom: '12px' }} />
			  <SkeletonLoader type="text" height="16px" width="100%" style={{ marginBottom: '8px' }} />
			  <SkeletonLoader type="text" height="16px" width="95%" style={{ marginBottom: '12px' }} />
			  <SkeletonLoader type="text" height="14px" width="30%" />
			</div>
		  ))
		)}

		{visiblePosts.map((post) => (
		  <Suspense key={post.id} fallback={
			<div style={{ marginBottom: '20px' }}>
			  <SkeletonLoader type="text" height="24px" width="70%" style={{ marginBottom: '12px' }} />
			  <SkeletonLoader type="text" height="16px" width="100%" style={{ marginBottom: '8px' }} />
			  <SkeletonLoader type="text" height="16px" width="95%" style={{ marginBottom: '12px' }} />
			  <SkeletonLoader type="text" height="14px" width="30%" />
			</div>
		  }>
			<PostComponent
			  postId={post.id}
			  title={post.title}
			  content={post.content}
			  createdAt={formatDate(post.createdAt)}
			  visible={post.visible}
			  userName={post.userName}
			/>
		  </Suspense>
		))}

		{/* Charger plus de posts */}
		<section className="LoadMore_section">
		  {loading && visiblePosts.length > 0 ? (
			<div className="loading-spinner">
			  <i className="pi pi-spinner"></i>
			  <span>Chargement des posts...</span>
			</div>
		  ) : hasMorePosts ? (
			<Button
			  onClick={loadMorePosts}
			  icon="pi pi-plus"
			  label="Charger plus de posts"
			  className="p-button-outlined"
			/>
		  ) : (
			<div className="no-more-posts">
			  <i className="pi pi-check-circle" style={{ marginRight: '0.5rem' }}></i>
			  Vous avez vu tous les posts !
			</div>
		  )}
		</section>
	  </section>

	  <section className="AddPost_section">
		<AddPost />
	  </section>

	  <Button
		className={`scroll-top-button ${showScrollTop ? 'visible' : ''}`}
		onClick={scrollToTop}
		aria-label="Retour en haut"
	  >
		<i className="pi pi-angle-up" style={{ fontSize: '1.5rem' }}></i>
	  </Button>
	</div>
  );
};

export default Posts;
