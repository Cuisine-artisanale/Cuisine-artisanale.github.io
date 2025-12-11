"use client";
import React, { useEffect, useState } from 'react';
import './AccountRecettes.css';
import { collection, getDocs, query, where, orderBy, limit, startAfter, QueryDocumentSnapshot, DocumentData } from '@firebase/firestore';
import { db } from '@/lib/config/firebase';
import { Recette } from '@/components/features';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { Button } from 'primereact/button';
import { ProgressSpinner } from 'primereact/progressspinner';
import { useRouter } from 'next/navigation';
import { Message } from 'primereact/message';
import { Paginator } from 'primereact/paginator';

interface RecetteInterface {
  recetteId: string;
  title: string;
  type: string;
  images?: string[];
  position: string;
  createdAt?: Date;
}

const AccountRecettes: React.FC = () => {
  const [recettes, setRecettes] = useState<RecetteInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [first, setFirst] = useState(0);
  const [rows] = useState(9);
  const [totalRecords, setTotalRecords] = useState(0);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
	setFirst(0);
	fetchRecettes(0);
  }, [user]);

  useEffect(() => {
	fetchRecettes(first);
  }, [first]);

  const fetchRecettes = async (pageIndex: number) => {
	try {
	  setLoading(true);
	  setError(null);

	  if (!user) {
		setError("Utilisateur non connecté");
		return;
	  }

	  const recettesCollection = collection(db, "recipes");

	  // Fetch total count first (if this is the first page)
	  if (pageIndex === 0) {
		const countQuery = query(
		  recettesCollection,
		  where("createdBy", "==", user.uid)
		);
		const countSnapshot = await getDocs(countQuery);
		setTotalRecords(countSnapshot.size);
	  }

	  // Fetch paginated results with cursor-based pagination
	  let paginatedQuery = query(
		recettesCollection,
		where("createdBy", "==", user.uid),
		orderBy("createdAt", "desc"),
		limit(rows + 1)
	  );

	  // For pages after the first, we'd need to track cursors
	  // For now, we'll fetch all and slice (simpler for small datasets)
	  const querySnapshot = await getDocs(
		query(
		  recettesCollection,
		  where("createdBy", "==", user.uid),
		  orderBy("createdAt", "desc")
		)
	  );

	  const allRecettesData: RecetteInterface[] = querySnapshot.docs.map((doc) => {
		const data = doc.data();
		return {
		  title: data.title,
		  description: data.description,
		  type: data.type,
		  position: data.position,
		  recetteId: doc.id,
		  images: data.images,
		  createdAt: data.createdAt?.toDate(),
		} as RecetteInterface;
	  });

	  // Slice for pagination
	  const paginatedRecettes = allRecettesData.slice(pageIndex, pageIndex + rows);
	  setRecettes(paginatedRecettes);
	  setTotalRecords(allRecettesData.length);
	} catch (error) {
	  console.error("Error getting recettes: ", error);
	  setError("Erreur lors du chargement des recettes");
	} finally {
	  setLoading(false);
	}
  };

  const handleCreateRecipe = () => {
	router.push('/recettes/add-recipe');
  };

  if (loading) {
	return (
	  <div className="recipes-loading">
		<ProgressSpinner />
		<p>Chargement de vos recettes...</p>
	  </div>
	);
  }

  return (
	<div className="account-recipes">
	  <div className="recipes-header">
		<h2>Mes Recettes</h2>
		<Button
		  label="Créer une recette"
		  icon="pi pi-plus"
		  onClick={handleCreateRecipe}
		  className="create-recipe-btn"
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
		  <i className="pi pi-book empty-icon"></i>
		  <h3>Vous n'avez pas encore créé de recettes</h3>
		  <p>Commencez à partager vos délicieuses recettes avec la communauté !</p>
		  <Button
			label="Créer ma première recette"
			icon="pi pi-plus"
			onClick={handleCreateRecipe}
		  />
		</div>
	  ) : (
		<>
		  <div className="recipes-grid">
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

export default AccountRecettes;
