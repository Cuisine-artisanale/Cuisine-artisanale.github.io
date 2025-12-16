"use client";
import { useEffect, useState, useMemo, Suspense } from 'react';
import './PostsClient.css';
import { AddPost, Post as PostComponent } from '@/components/features';
import { db } from '@/lib/config/firebase';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import type { Post } from '@/types';

const nbPostsToDisplay = 5;

export default function PostsClient() {
	const [allPosts, setAllPosts] = useState<Post[]>([]);
	const [displayedPostsCount, setDisplayedPostsCount] = useState<number>(nbPostsToDisplay);
	const [loading, setLoading] = useState<boolean>(false);
	const [showScrollTop, setShowScrollTop] = useState<boolean>(false);
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

	const setupPostsListener = () => {
		setLoading(true);
		try {
			const postsQuery = query(
				collection(db, "posts"),
				orderBy("createdAt", "desc"),
				limit(100) // Limiter à 100 posts pour éviter trop de lectures
			);

			// Utiliser onSnapshot pour écouter les changements en temps réel
			const unsubscribe = onSnapshot(postsQuery, (querySnapshot) => {
				const postsData: Post[] = querySnapshot.docs.map((doc) => {
					const data = doc.data();
					return {
						id: doc.id,
						title: data.title,
						content: data.content,
						createdAt: data.createdAt?.toDate() || new Date(),
						visible: data.visible !== false,
						userName: data.userName
					} as Post;
				});
				setAllPosts(postsData);
				setLoading(false);
			}, (error) => {
				console.error("Error fetching posts:", error);
				setLoading(false);
			});

			// Retourner la fonction de nettoyage pour se désabonner
			return unsubscribe;
		} catch (error) {
			console.error("Error setting up posts listener:", error);
			setLoading(false);
			return () => {}; // Retourner une fonction vide en cas d'erreur
		}
	};

	const loadMorePosts = () => {
		if (loading) return;
		setDisplayedPostsCount((prev) => prev + nbPostsToDisplay);
	};

	const handleScroll = () => setShowScrollTop(window.scrollY > 300);
	const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

	useEffect(() => {
		const unsubscribe = setupPostsListener();
		window.addEventListener('scroll', handleScroll);
		return () => {
			if (unsubscribe) unsubscribe();
			window.removeEventListener('scroll', handleScroll);
		};
	}, [user, role]);

	// Filtrer et limiter les posts selon le rôle (memoized)
	const visiblePosts = useMemo(() => {
		const filtered = allPosts.filter(post => post.visible || role === 'admin');
		return filtered.slice(0, displayedPostsCount);
	}, [allPosts, role, displayedPostsCount]);

	const hasMorePosts = useMemo(() => {
		const filtered = allPosts.filter(post => post.visible || role === 'admin');
		return displayedPostsCount < filtered.length;
	}, [allPosts, role, displayedPostsCount]);

	return (
		<div className="Posts">
			<section className="Posts_section">
				{loading && visiblePosts.length === 0 && (
					Array.from({ length: nbPostsToDisplay }).map((_, i) => (
						<div key={i} className="post-skeleton">
							<div className="skeleton-text skeleton-title"></div>
							<div className="skeleton-text skeleton-line"></div>
							<div className="skeleton-text skeleton-line skeleton-short"></div>
							<div className="skeleton-text skeleton-meta"></div>
						</div>
					))
				)}

				{visiblePosts.map((post) => (
					<Suspense key={post.id} fallback={
						<div className="post-skeleton">
							<div className="skeleton-text skeleton-title"></div>
							<div className="skeleton-text skeleton-line"></div>
							<div className="skeleton-text skeleton-line skeleton-short"></div>
							<div className="skeleton-text skeleton-meta"></div>
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
						<button
							onClick={loadMorePosts}
							className="load-more-button"
							aria-label="Charger plus de posts"
						>
							<i className="pi pi-plus"></i>
							Charger plus de posts
						</button>
					) : (
						<div className="no-more-posts">
							<i className="pi pi-check-circle"></i>
							Vous avez vu tous les posts !
						</div>
					)}
				</section>
			</section>

			<section className="AddPost_section">
				<AddPost />
			</section>

			<button
				className={`scroll-top-button ${showScrollTop ? 'visible' : ''}`}
				onClick={scrollToTop}
				aria-label="Retour en haut"
			>
				<i className="pi pi-angle-up"></i>
			</button>
		</div>
	);
}

