"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadFirestore } from '@/lib/config/firestore-lazy';
import { getRecipeUrl } from '@/lib/utils/recipe-url';
import './RecentActivity.css';

type ActivityType = 'pending' | 'recipe' | 'review' | 'post';

interface Activity {
	id: string;
	type: ActivityType;
	title: string;
	detail: string;
	date: Date | null;
	/** Lien vers la recette concernée, s'il y en a un */
	href?: string;
}

interface RecentActivityProps {
	userId: string;
	/** Nombre d'éléments affichés */
	max?: number;
}

const ICONS: Record<ActivityType, string> = {
	pending: 'pi-hourglass',
	recipe: 'pi-book',
	review: 'pi-star',
	post: 'pi-comment',
};

function toDate(value: unknown): Date | null {
	if (!value) return null;
	if (value instanceof Date) return value;
	if (typeof (value as { toDate?: () => Date }).toDate === 'function') return (value as { toDate: () => Date }).toDate();
	const parsed = new Date(value as string);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** « aujourd'hui », « hier », « il y a 5 jours », puis la date. */
function formatWhen(date: Date | null): string {
	if (!date) return '';
	const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
	if (days <= 0) return "aujourd'hui";
	if (days === 1) return 'hier';
	if (days < 7) return `il y a ${days} jours`;
	return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

/**
 * Dernières actions de l'utilisateur sur le site : recettes proposées (en attente ou publiées),
 * avis laissés et posts, du plus récent au plus ancien.
 */
const RecentActivity: React.FC<RecentActivityProps> = ({ userId, max = 8 }) => {
	const [activities, setActivities] = useState<Activity[] | null>(null);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			const { db, collection, getDocs, getDoc, doc, query, where } = await loadFirestore();

			// Chaque source est indépendante : une lecture refusée ne vide pas tout le fil
			const read = (name: string, field: string) =>
				getDocs(query(collection(db, name), where(field, '==', userId))).then((s) => s.docs).catch(() => []);

			const [recipes, requests, reviews, posts] = await Promise.all([
				read('recipes', 'createdBy'),
				read('recipesRequest', 'createdBy'),
				read('reviews', 'userId'),
				read('posts', 'userId'),
			]);

			// Titre des recettes commentées (les avis ne portent que l'identifiant de la recette)
			const reviewed = reviews
				.map((d) => ({ id: d.id, data: d.data() }))
				.sort((a, b) => (toDate(b.data.createdAt)?.getTime() ?? 0) - (toDate(a.data.createdAt)?.getTime() ?? 0))
				.slice(0, max);
			const reviewedRecipes = new Map<string, { title: string; url?: string }>();
			await Promise.all(
				Array.from(new Set(reviewed.map((r) => String(r.data.recipeId || '')).filter(Boolean))).map(async (recipeId) => {
					const snap = await getDoc(doc(db, 'recipes', recipeId)).catch(() => null);
					if (snap?.exists()) reviewedRecipes.set(recipeId, { title: snap.data().title, url: snap.data().url });
				})
			);

			const all: Activity[] = [
				...requests.filter((d) => d.data().title).map((d): Activity => ({
					id: `pending-${d.id}`,
					type: 'pending',
					title: d.data().title,
					detail: 'Recette proposée, en attente de validation',
					date: toDate(d.data().createdAt),
				})),
				...recipes.map((d): Activity => ({
					id: `recipe-${d.id}`,
					type: 'recipe',
					title: d.data().title,
					detail: 'Recette publiée',
					date: toDate(d.data().createdAt),
					href: getRecipeUrl({ id: d.id, url: d.data().url, title: d.data().title }),
				})),
				...reviewed.map(({ id, data }): Activity => {
					const recipe = reviewedRecipes.get(String(data.recipeId));
					return {
						id: `review-${id}`,
						type: 'review',
						title: recipe?.title || 'Recette',
						detail: `Avis laissé : ${data.rating} / 5`,
						date: toDate(data.createdAt),
						href: recipe ? getRecipeUrl({ id: String(data.recipeId), url: recipe.url, title: recipe.title }) : undefined,
					};
				}),
				...posts.map((d): Activity => ({
					id: `post-${d.id}`,
					type: 'post',
					title: d.data().title,
					detail: 'Post publié',
					date: toDate(d.data().createdAt),
				})),
			];

			all.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
			if (!cancelled) setActivities(all.slice(0, max));
		})().catch((error) => {
			console.error('Activité récente indisponible :', error);
			if (!cancelled) setActivities([]);
		});

		return () => { cancelled = true; };
	}, [userId, max]);

	return (
		<section className="recent-activity" aria-labelledby="recent-activity-title">
			<h3 id="recent-activity-title">Activité récente</h3>

			{activities === null ? (
				<p className="recent-activity-empty">Chargement…</p>
			) : activities.length === 0 ? (
				<div className="recent-activity-empty">
					<p>Rien pour l&apos;instant. Proposez votre première recette ou laissez un avis.</p>
					<Link href="/recettes/add-recipe" className="recent-activity-cta">Proposer une recette</Link>
				</div>
			) : (
				<ul className="recent-activity-list">
					{activities.map((activity) => {
						const body = (
							<>
								<span className={`recent-activity-icon is-${activity.type}`}>
									<span className={`pi ${ICONS[activity.type]}`} aria-hidden="true"></span>
								</span>
								<span className="recent-activity-text">
									<strong>{activity.title}</strong>
									<small>{activity.detail}</small>
								</span>
								<time className="recent-activity-date" dateTime={activity.date?.toISOString()}>{formatWhen(activity.date)}</time>
							</>
						);
						return (
							<li key={activity.id}>
								{activity.href ? (
									<Link href={activity.href} className="recent-activity-row">{body}</Link>
								) : (
									<div className="recent-activity-row">{body}</div>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
};

export default RecentActivity;
