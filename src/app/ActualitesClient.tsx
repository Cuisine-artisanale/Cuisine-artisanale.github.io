"use client";
import { useEffect, useState } from 'react';
import './ActualitesClient.css';
import { db } from '@/lib/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import type { Recipe } from '@/types';

export default function ActualitesClient() {
	const [featuredRecette, setFeaturedRecette] = useState<Recipe | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchWeeklyRecette();
	}, []);

	const fetchWeeklyRecette = async () => {
		try {
			const weeklyRef = doc(db, "weeklyRecipe", "current");
			const weeklySnap = await getDoc(weeklyRef);

			if (weeklySnap.exists()) {
				setFeaturedRecette(weeklySnap.data() as Recipe);
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
					<div className="skeleton-image"></div>
					<div className="featured-content">
						<div className="skeleton-text skeleton-title"></div>
						<div className="skeleton-text skeleton-subtitle"></div>
						<div className="skeleton-text skeleton-subtitle"></div>
						<div className="skeleton-button"></div>
					</div>
				</div>
			</section>
		);
	}

	if (!featuredRecette) {
		return <p className="no-recipe">Aucune recette disponible pour cette semaine.</p>;
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
}

