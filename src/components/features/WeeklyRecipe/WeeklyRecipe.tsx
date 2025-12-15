"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import type { Recipe } from '@/types';
import './WeeklyRecipe.css';

export default function WeeklyRecipe() {
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
			<section className="weekly-recipe">
				<h2 className="weekly-recipe-title">🥇 Recette de la semaine</h2>
				<div className="weekly-recipe-card">
					<div className="weekly-recipe-skeleton-image"></div>
					<div className="weekly-recipe-content">
						<div className="weekly-recipe-skeleton weekly-recipe-skeleton-title"></div>
						<div className="weekly-recipe-skeleton weekly-recipe-skeleton-subtitle"></div>
						<div className="weekly-recipe-skeleton weekly-recipe-skeleton-subtitle"></div>
						<div className="weekly-recipe-skeleton weekly-recipe-skeleton-button"></div>
					</div>
				</div>
			</section>
		);
	}

	if (!featuredRecette) {
		return (
			<section className="weekly-recipe">
				<p className="weekly-recipe-empty">Aucune recette disponible pour cette semaine.</p>
			</section>
		);
	}

	return (
		<section className="weekly-recipe">
			<h2 className="weekly-recipe-title">🥇 Recette de la semaine</h2>
			<div className="weekly-recipe-card">
				{featuredRecette.images?.[0] && (
					<div className="weekly-recipe-image-wrapper">
						<Image
							src={featuredRecette.images[0]}
							alt={featuredRecette.title}
							className="weekly-recipe-image"
							height={400}
							width={600}
							priority
							sizes="(max-width: 768px) 100vw, 160px"
							unoptimized={true}
						/>
					</div>
				)}
				<div className="weekly-recipe-content">
					<h3 className="weekly-recipe-content-title">{featuredRecette.title}</h3>
					<p className="weekly-recipe-content-info">
						<strong>Type :</strong> {featuredRecette.type}
					</p>
					{featuredRecette.position && (
						<p className="weekly-recipe-content-location">📍 {featuredRecette.position}</p>
					)}
					<Link href={`/recettes/?id=${featuredRecette.id}`} className="weekly-recipe-button">
						Voir la recette
					</Link>
				</div>
			</div>
		</section>
	);
}

