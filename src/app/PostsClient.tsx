"use client";
import { useCallback, useEffect, useState, useMemo, Suspense } from 'react';
import './PostsClient.css';
import AddPost from '@/components/features/AddPost/AddPost';
import PostComponent from '@/components/features/Post/Post';
import { loadFirestore } from '@/lib/config/firestore-lazy';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { toPostCard, type PostCardData } from '@/lib/utils/post-card';

const nbPostsToDisplay = 5;

type HomePost = Omit<PostCardData, 'createdAt'> & { createdAt: Date };

const toHomePost = (post: PostCardData): HomePost => ({ ...post, createdAt: new Date(post.createdAt) });

interface PostsClientProps {
	/** Posts visibles chargés côté serveur (app/page.tsx) */
	initialPosts?: PostCardData[];
}

export default function PostsClient({ initialPosts = [] }: PostsClientProps) {
	const [allPosts, setAllPosts] = useState<HomePost[]>(() => initialPosts.map(toHomePost));
	const [displayedPostsCount, setDisplayedPostsCount] = useState<number>(nbPostsToDisplay);
	const [loading, setLoading] = useState<boolean>(false);
	const [showScrollTop, setShowScrollTop] = useState<boolean>(false);
	const { role } = useAuth();

	const formatDate = (date: Date) =>
		date.toLocaleDateString("fr-FR", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit"
		});

	/**
	 * Recharge la liste depuis Firestore (chargé à la demande) : utilisé pour les admins
	 * (qui voient aussi les posts masqués) et après la publication d'un post.
	 */
	const reloadPosts = useCallback(async () => {
		setLoading(true);
		try {
			const { db, collection, getDocs, limit, orderBy, query } = await loadFirestore();
			const snapshot = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(100)));
			setAllPosts(snapshot.docs.map((d) => toHomePost(toPostCard(d.id, d.data()))));
		} catch (error) {
			console.error("Error fetching posts:", error);
		} finally {
			setLoading(false);
		}
	}, []);

	const handlePostDeleted = useCallback((postId: string) => {
		setAllPosts((prev) => prev.filter((p) => p.id !== postId));
	}, []);

	const loadMorePosts = () => {
		if (loading) return;
		setDisplayedPostsCount((prev) => prev + nbPostsToDisplay);
	};

	const handleScroll = () => setShowScrollTop(window.scrollY > 300);
	const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

	useEffect(() => {
		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	}, []);

	// Les admins voient aussi les posts masqués : rechargement complet côté client
	useEffect(() => {
		if (role === 'admin') reloadPosts();
	}, [role, reloadPosts]);

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
							likes={post.likes}
							onDeleted={handlePostDeleted}
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
				<AddPost onPosted={reloadPosts} />
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

