"use client";
import React, { useEffect, useState } from 'react';
import './Actualites.css';
import { db } from '@firebaseModule';
import { doc, getDoc} from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import SkeletonLoader from '@/components/SkeletonLoader/SkeletonLoader';

interface RecetteData {
  id: string;
  title: string;
  type: string;
  images?: string[];
  position: string;
}

const Actualites: React.FC = () => {
  const [featuredRecette, setFeaturedRecette] = useState<RecetteData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
	fetchWeeklyRecette();
  }, []);

  const fetchWeeklyRecette = async () => {
	try {
	  const weeklyRef = doc(db, "weeklyRecipe", "current");
	  const weeklySnap = await getDoc(weeklyRef);


	  if (weeklySnap.exists()) {
		setFeaturedRecette(weeklySnap.data() as RecetteData);
		setLoading(false);
		return;

	  }
	} catch (error) {
	  console.error("Erreur lors du chargement de la recette de la semaine :", error);
	} finally {
	  setLoading(false);
	}
  };


  if (loading) {
	return (
	  <section className="featured-recette">
		<h2>🥇 Recette de la semaine</h2>
		<div className="featured-card">
		  <SkeletonLoader type="image" width="100%" height="300px" />
		  <div className="featured-content">
			<SkeletonLoader type="text" height="24px" width="80%" style={{ marginBottom: '12px' }} />
			<SkeletonLoader type="text" height="16px" width="40%" style={{ marginBottom: '12px' }} />
			<SkeletonLoader type="text" height="16px" width="50%" style={{ marginBottom: '16px' }} />
			<SkeletonLoader type="rectangle" height="40px" width="150px" borderRadius="6px" />
		  </div>
		</div>
	  </section>
	);
  }

  if (!featuredRecette) {
	return <p>Aucune recette disponible pour cette semaine.</p>;
  }

  return (
	<section className="featured-recette">
		<h2>🥇 Recette de la semaine</h2>
		<div className="featured-card">
			{featuredRecette.images?.[0] && (
			<Image
				src={featuredRecette.images[0]}
				alt={featuredRecette.title}
				className="featured-img"
				height={400}
				width={600}
				priority
				sizes="(max-width: 768px) 100vw, 100vw"
				unoptimized={true}
			/>
			)}
			<div className="featured-content">
			<h3>{featuredRecette.title}</h3>
			<p><strong>Type :</strong> {featuredRecette.type}</p>
			{featuredRecette.position && <p>📍 {featuredRecette.position}</p>}
			<Link href={`/recettes/?id=${featuredRecette.id}`}>
				<button className="featured-button">Voir la recette</button>
			</Link>
			</div>
		</div>
	</section>
  );
};

export default Actualites;
