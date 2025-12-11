"use client";
import React, { useEffect, useState } from 'react';
import './AccountRecetteFavoris.css';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { Recette } from '@/components/features';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { Button } from 'primereact/button';
import { useRouter } from 'next/navigation';
import { Paginator } from 'primereact/paginator';

interface RecetteInterface {
  recetteId: string;
  title: string;
  type: string;
  images?: string[];
  position?: string;
}

const AccountRecetteFavoris: React.FC = () => {
  const [recettes, setRecettes] = useState<RecetteInterface[]>([]);
  const [allRecettes, setAllRecettes] = useState<RecetteInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [first, setFirst] = useState(0);
  const [rows] = useState(9);
  const [totalRecords, setTotalRecords] = useState(0);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
	if (user) {
	  setFirst(0);
	  fetchRecettes(0);
	}
  }, [user]);

  useEffect(() => {
	if (allRecettes.length > 0) {
	  const paginatedRecettes = allRecettes.slice(first, first + rows);
	  setRecettes(paginatedRecettes);
	}
  }, [first]);

  const fetchRecettes = async (pageIndex: number) => {
	try {
	  setLoading(true);
	  setError(null);

	  if (!user) {
		setError("Utilisateur non connecté");
		return;
	  }

	  // Récupérer le document utilisateur
	  const userRef = doc(db, "users", user.uid);
	  const userSnap = await getDoc(userRef);

	  if (!userSnap.exists()) {
		setError("Utilisateur non trouvé");
		return;
	  }

	  const userData = userSnap.data();
	  const likedRecipesIds: string[] = userData.likedRecipes || [];

	  if (likedRecipesIds.length === 0) {
		setAllRecettes([]);
		setRecettes([]);
		setTotalRecords(0);
		return;
	  }

	  // Récupérer toutes les recettes correspondant aux IDs en chunks de 10
	  const recipesCollection = collection(db, "recipes");
	  const allRecettesData: RecetteInterface[] = [];

	  for (let i = 0; i < likedRecipesIds.length; i += 10) {
		const chunk = likedRecipesIds.slice(i, i + 10);
		const recettesQuery = query(
		  recipesCollection,
		  where("__name__", "in", chunk)
		);

		const querySnapshot = await getDocs(recettesQuery);
		querySnapshot.docs.forEach(doc => {
		  const data = doc.data();
		  allRecettesData.push({
			recetteId: doc.id,
			title: data.title,
			type: data.type,
			images: data.images,
			position: data.position
		  });
		});
	  }

	  // Trier selon l'ordre des IDs dans likedRecipes
	  allRecettesData.sort((a, b) => {
		return likedRecipesIds.indexOf(a.recetteId) - likedRecipesIds.indexOf(b.recetteId);
	  });

	  setAllRecettes(allRecettesData);
	  setTotalRecords(allRecettesData.length);

	  // Afficher la première page
	  const paginatedRecettes = allRecettesData.slice(pageIndex, pageIndex + rows);
	  setRecettes(paginatedRecettes);

	} catch (error) {
	  console.error("Erreur lors du chargement des recettes favorites: ", error);
	  setError("Erreur lors du chargement des recettes favorites");
	} finally {
	  setLoading(false);
	}
  };

  const handleExploreRecipes = () => {
	router.push('/recettes');
  };

  if (loading) {
	return (
	  <div className="favorites-loading">
		<ProgressSpinner />
		<p>Chargement de vos recettes favorites...</p>
	  </div>
	);
  }

  return (
	<div className="account-favorites">
	  <div className="favorites-header">
		<h2>Mes Recettes Favorites</h2>
		<Button
		  label="Explorer les recettes"
		  icon="pi pi-search"
		  onClick={handleExploreRecipes}
		  className="explore-recipes-btn"
		/>
	  </div>

	  {error && (
		<Message
		  severity="error"
		  text={error}
		  className="error-message"
		/>
	  )}

	  {!error && recettes.length === 0 ? (
		<div className="empty-state">
		  <i className="pi pi-heart empty-icon"></i>
		  <h3>Aucune recette favorite pour le moment</h3>
		  <p>Explorez notre collection de recettes et ajoutez vos favorites à votre collection !</p>
		  <Button
			label="Découvrir des recettes"
			icon="pi pi-search"
			onClick={handleExploreRecipes}
		  />
		</div>
	  ) : (
		<>
		  <div className="favorites-grid">
			{recettes.map((recette) => (
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
	</div>
  );
};

export default AccountRecetteFavoris;
