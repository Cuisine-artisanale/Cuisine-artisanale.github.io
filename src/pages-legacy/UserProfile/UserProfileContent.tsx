"use client";
import React, { useState, useEffect } from 'react';
import './UserProfile.css';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { Card } from 'primereact/card';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { Avatar } from 'primereact/avatar';
import { Paginator } from 'primereact/paginator';
import { UserStats, Recette } from '@/components/features';
import { Breadcrumb } from '@/components/layout';
import '@/components/Breadcrumb/Breadcrumb.css';

interface UserData {
  displayName: string;
  email: string;
  photoURL?: string;
  uid: string;
}

interface RecetteInterface {
  recetteId: string;
  title: string;
  type: string;
  images?: string[];
  position: string;
  createdAt?: Date;
}

interface UserProfileContentProps {
  userId: string | null;
}

const UserProfileContent: React.FC<UserProfileContentProps> = ({ userId }) => {

  const [user, setUser] = useState<UserData | null>(null);
  const [recipes, setRecipes] = useState<RecetteInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [first, setFirst] = useState(0);
  const [rows] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
	if (userId) {
	  setLoading(true);
	  setError(null);
	  fetchUserProfile();
	  fetchUserRecipes(0);
	} else {
	  // Si pas d'ID utilisateur, afficher une erreur
	  setError('Aucun utilisateur spécifié');
	  setLoading(false);
	}
  }, [userId]);

  useEffect(() => {
	if (userId) {
	  fetchUserRecipes(first);
	}
  }, [first, userId]);

  const fetchUserProfile = async () => {
	if (!userId) {
	  setError('Aucun utilisateur spécifié');
	  setLoading(false);
	  return;
	}

	try {
	  setLoading(true);
	  setError(null);

	  const userRef = doc(db, 'users', userId);
	  const userSnap = await getDoc(userRef);

	  if (!userSnap.exists()) {
		setError('Utilisateur non trouvé');
		setLoading(false);
		setUser(null);
		return;
	  }

	  const userData = userSnap.data();
	  setUser({
		displayName: userData.displayName || 'Utilisateur',
		email: userData.email || '',
		photoURL: userData.photoURL,
		uid: userId
	  });
	} catch (err) {
	  console.error('Error fetching user:', err);
	  setError('Erreur lors du chargement du profil');
	  setUser(null);
	} finally {
	  setLoading(false);
	}
  };

  const fetchUserRecipes = async (pageIndex: number) => {
	if (!userId) return;

	try {
	  const recipesCollection = collection(db, 'recipes');

	  if (pageIndex === 0) {
		const countQuery = query(
		  recipesCollection,
		  where('createdBy', '==', userId)
		);
		const countSnapshot = await getDocs(countQuery);
		setTotalRecords(countSnapshot.size);
	  }

	  const allRecettesQuery = query(
		recipesCollection,
		where('createdBy', '==', userId)
	  );
	  const querySnapshot = await getDocs(allRecettesQuery);

	  const allRecettesData: RecetteInterface[] = querySnapshot.docs.map((doc) => {
		const data = doc.data();
		return {
		  title: data.title,
		  type: data.type,
		  position: data.position,
		  recetteId: doc.id,
		  images: data.images,
		  createdAt: data.createdAt?.toDate(),
		} as RecetteInterface;
	  });

	  const paginatedRecettes = allRecettesData.slice(pageIndex, pageIndex + rows);
	  setRecipes(paginatedRecettes);
	} catch (error) {
	  console.error('Error fetching recipes:', error);
	  setError('Erreur lors du chargement des recettes');
	}
  };

  if (loading) {
	return (
	  <div className="user-profile-container">
		<Breadcrumb />
		<div className="user-profile-loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
		  <ProgressSpinner />
		  <p style={{ marginTop: '1rem' }}>Chargement du profil...</p>
		</div>
	  </div>
	);
  }

  if (error || !user || !userId) {
	return (
	  <div className="user-profile-container">
		<Breadcrumb />
		<Card style={{ margin: '2rem', padding: '2rem' }}>
		  <Message
			severity="error"
			text={error || 'Profil non trouvé. Veuillez spécifier un utilisateur.'}
			className="error-message"
			style={{ width: '100%' }}
		  />
		</Card>
	  </div>
	);
  }

  return (
	<div className="user-profile-container">
	  <Breadcrumb />

	  <Card className="profile-header-card">
		<div className="profile-header">
		  <div className="profile-info">
			{user.photoURL ? (
			  <Avatar image={user.photoURL} size="xlarge" shape="circle" />
			) : (
			  <Avatar
				label={user.displayName?.charAt(0) || 'U'}
				size="xlarge"
				shape="circle"
				style={{ backgroundColor: 'var(--primary-color)' }}
			  />
			)}
			<div className="profile-details">
			  <h1>{user.displayName}</h1>
			  <p className="profile-email">{user.email}</p>
			</div>
		  </div>
		</div>
	  </Card>

	  {user && <UserStats userId={user.uid} isPublicProfile={true} />}

	  <Card className="recipes-card">
		<div className="recipes-header">
		  <h2>Recettes créées par {user.displayName}</h2>
		</div>

		{totalRecords === 0 ? (
		  <div className="empty-state">
			<i className="pi pi-book empty-icon"></i>
			<h3>{user.displayName} n'a pas encore créé de recettes</h3>
		  </div>
		) : (
		  <>
			<div className="recipes-grid">
			  {recipes.map((recette) => (
				<Recette
				  key={recette.recetteId}
				  recetteId={recette.recetteId}
				  title={recette.title}
				  type={recette.type}
				  images={recette.images}
				  position={recette.position}
				/>
			  ))}
			</div>
			{totalRecords > rows && (
			  <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
				<Paginator
				  first={first}
				  rows={rows}
				  totalRecords={totalRecords}
				  onPageChange={(e) => setFirst(e.first)}
				  template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport"
				  currentPageReportTemplate={`Affichage de {first} à {last} sur {totalRecords}`}
				/>
			  </div>
			)}
		  </>
		)}
	  </Card>
	</div>
  );
};

export default UserProfileContent;
