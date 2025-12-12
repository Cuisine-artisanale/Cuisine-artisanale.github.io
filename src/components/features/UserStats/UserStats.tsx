"use client";
import React, { useState, useEffect } from 'react';
import './UserStats.css';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { Card } from 'primereact/card';
import { Skeleton } from 'primereact/skeleton';

interface UserStatsData {
  recipesCount: number;
  totalLikes: number;
  averageRating: number;
  totalReviews: number;
  favoriteRecipesCount: number;
  postsCount: number;
}

interface UserStatsProps {
  userId: string;
  isPublicProfile?: boolean;
}

const UserStats: React.FC<UserStatsProps> = ({ userId, isPublicProfile = false }) => {
  const [stats, setStats] = useState<UserStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
	if (userId) {
	  fetchUserStats();
	}
  }, [userId]);

  const fetchUserStats = async () => {
	if (!userId) return;

	try {
	  const recipesCollection = collection(db, 'recipes');
	  const likesCollection = collection(db, 'likes');
	  const reviewsCollection = collection(db, 'reviews');
	  const postsCollection = collection(db, 'posts');

	  // Fetch recipes count
	  const recipesQuery = query(recipesCollection, where('createdBy', '==', userId));
	  const recipesSnapshot = await getDocs(recipesQuery);
	  const recipesCount = recipesSnapshot.size;

	  // Fetch total likes received
	  const recipeIds = recipesSnapshot.docs.map(doc => doc.id);
	  let totalLikes = 0;
	  if (recipeIds.length > 0) {
		for (let i = 0; i < recipeIds.length; i += 10) {
		  const chunk = recipeIds.slice(i, i + 10);
		  const likesQuery = query(likesCollection, where('recetteId', 'in', chunk));
		  const likesSnapshot = await getDocs(likesQuery);
		  totalLikes += likesSnapshot.size;
		}
	  }

	  // Fetch reviews and calculate average rating
	  const reviewsQuery = query(reviewsCollection, where('recipeId', 'in', recipeIds.length > 0 ? recipeIds.slice(0, 10) : ['']));
	  const reviewsSnapshot = await getDocs(reviewsQuery);
	  let totalRating = 0;
	  reviewsSnapshot.docs.forEach(doc => {
		totalRating += doc.data().rating || 0;
	  });
	  const averageRating = reviewsSnapshot.size > 0 ? (totalRating / reviewsSnapshot.size).toFixed(1) : 0;
	  const totalReviews = reviewsSnapshot.size;

	  // Fetch user's favorite recipes (only for private profile)
	  let favoriteRecipesCount = 0;
	  if (!isPublicProfile) {
		const userRef = doc(db, 'users', userId);
		const userSnap = await getDoc(userRef);
		favoriteRecipesCount = userSnap.data()?.likedRecipes?.length || 0;
	  }

	  // Fetch user's posts count
	  const postsQuery = query(postsCollection, where('userId', '==', userId));
	  const postsSnapshot = await getDocs(postsQuery);
	  const postsCount = postsSnapshot.size;

	  setStats({
		recipesCount,
		totalLikes,
		averageRating: parseFloat(String(averageRating)),
		totalReviews,
		favoriteRecipesCount,
		postsCount
	  });
	} catch (error) {
	  console.error('Error fetching stats:', error);
	} finally {
	  setLoading(false);
	}
  };

  return (
	<div className="user-stats-grid">
	  <Card className="stat-card">
		<div className="stat-content">
		  <i className="pi pi-book stat-icon"></i>
		  <div className="stat-info">
			{loading ? (
			  <Skeleton height="2rem" width="100px" />
			) : (
			  <>
				<h3>{stats?.recipesCount || 0}</h3>
				<p>Recettes créées</p>
			  </>
			)}
		  </div>
		</div>
	  </Card>

	  <Card className="stat-card">
		<div className="stat-content">
		  <i className="pi pi-heart stat-icon"></i>
		  <div className="stat-info">
			{loading ? (
			  <Skeleton height="2rem" width="100px" />
			) : (
			  <>
				<h3>{stats?.totalLikes || 0}</h3>
				<p>J'aime reçus</p>
			  </>
			)}
		  </div>
		</div>
	  </Card>

	  <Card className="stat-card">
		<div className="stat-content">
		  <i className="pi pi-star stat-icon"></i>
		  <div className="stat-info">
			{loading ? (
			  <Skeleton height="2rem" width="100px" />
			) : (
			  <>
				<h3>{stats?.averageRating?.toFixed(1) || 'N/A'}/5</h3>
				<p>Note moyenne</p>
			  </>
			)}
		  </div>
		</div>
	  </Card>

	  <Card className="stat-card">
		<div className="stat-content">
		  <i className="pi pi-comments stat-icon"></i>
		  <div className="stat-info">
			{loading ? (
			  <Skeleton height="2rem" width="100px" />
			) : (
			  <>
				<h3>{stats?.totalReviews || 0}</h3>
				<p>Avis reçus</p>
			  </>
			)}
		  </div>
		</div>
	  </Card>

	  {!isPublicProfile && (
		<Card className="stat-card">
		  <div className="stat-content">
			<i className="pi pi-bookmark stat-icon"></i>
			<div className="stat-info">
			  {loading ? (
				<Skeleton height="2rem" width="100px" />
			  ) : (
				<>
				  <h3>{stats?.favoriteRecipesCount || 0}</h3>
				  <p>Recettes favorites</p>
				</>
			  )}
			</div>
		  </div>
		</Card>
	  )}

	  <Card className="stat-card">
		<div className="stat-content">
		  <i className="pi pi-comment stat-icon"></i>
		  <div className="stat-info">
			{loading ? (
			  <Skeleton height="2rem" width="100px" />
			) : (
			  <>
				<h3>{stats?.postsCount || 0}</h3>
				<p>Publications</p>
			  </>
			)}
		  </div>
		</div>
	  </Card>
	</div>
  );
};

export default UserStats;
