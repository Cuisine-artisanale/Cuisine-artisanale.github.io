"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getCountFromServer, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import './dashboard.css';

interface Counts {
	pendingRecipes: number | null;
	pendingSuggestions: number | null;
	recipes: number | null;
	ingredients: number | null;
	users: number | null;
	posts: number | null;
}

interface PendingRecipe {
	id: string;
	title: string;
	type: string;
	source?: string;
	createdAt: Date | null;
}

const EMPTY: Counts = { pendingRecipes: null, pendingSuggestions: null, recipes: null, ingredients: null, users: null, posts: null };

/** Nombre de documents, ou null si le compte échoue (l'accueil reste affichable). */
async function count(source: Parameters<typeof getCountFromServer>[0]): Promise<number | null> {
	try {
		return (await getCountFromServer(source)).data().count;
	} catch (error) {
		console.error('Compteur indisponible :', error);
		return null;
	}
}

const display = (value: number | null) => (value === null ? '–' : value.toLocaleString('fr-FR'));

/** Vue d'ensemble de l'administration : ce qui attend une action, puis les chiffres du site. */
export default function DashboardPage() {
	const { displayName } = useAuth();
	const [counts, setCounts] = useState<Counts>(EMPTY);
	const [pending, setPending] = useState<PendingRecipe[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			const [pendingRecipes, pendingSuggestions, recipes, ingredients, users, posts, latest] = await Promise.all([
				count(collection(db, 'recipesRequest')),
				count(query(collection(db, 'ingredientSuggestions'), where('status', '==', 'pending'))),
				count(collection(db, 'recipes')),
				count(collection(db, 'ingredients')),
				count(collection(db, 'users')),
				count(collection(db, 'posts')),
				getDocs(query(collection(db, 'recipesRequest'), orderBy('createdAt', 'desc'), limit(5))).catch(() => null),
			]);
			if (cancelled) return;

			setCounts({ pendingRecipes, pendingSuggestions, recipes, ingredients, users, posts });
			setPending(
				(latest?.docs ?? []).map((d) => {
					const data = d.data();
					return {
						id: d.id,
						title: data.title || 'Sans titre',
						type: data.type || '',
						source: data.source,
						createdAt: data.createdAt?.toDate?.() ?? null,
					};
				})
			);
			setLoading(false);
		})();

		return () => { cancelled = true; };
	}, []);

	const todo = [
		{
			href: '/admin-panel/recettes',
			icon: 'pi-inbox',
			value: counts.pendingRecipes,
			label: counts.pendingRecipes === 1 ? 'recette à valider' : 'recettes à valider',
		},
		{
			href: '/admin-panel/ingredients',
			icon: 'pi-pencil',
			value: counts.pendingSuggestions,
			label: counts.pendingSuggestions === 1 ? 'correction d\'ingrédient proposée' : 'corrections d\'ingrédients proposées',
		},
	];

	const figures = [
		{ href: '/recettes', icon: 'pi-book', value: counts.recipes, label: 'Recettes publiées' },
		{ href: '/admin-panel/ingredients', icon: 'pi-shopping-bag', value: counts.ingredients, label: 'Ingrédients' },
		{ href: '/admin-panel/users', icon: 'pi-users', value: counts.users, label: 'Utilisateurs' },
		{ href: '/admin-panel/posts', icon: 'pi-comments', value: counts.posts, label: 'Posts' },
	];

	const nothingToDo = !loading && todo.every((item) => item.value === 0);

	return (
		<div className="admin-dashboard">
			<header className="admin-page-header">
				<div>
					<h1>Vue d&apos;ensemble</h1>
					<p>Bonjour{displayName ? ` ${displayName}` : ''}, voici ce qui se passe sur le site.</p>
				</div>
			</header>

			<section aria-labelledby="dashboard-todo">
				<h2 id="dashboard-todo">À traiter</h2>
				{nothingToDo ? (
					<p className="dashboard-empty">
						<span className="pi pi-check-circle" aria-hidden="true"></span>
						Rien en attente : tout est à jour.
					</p>
				) : (
					<div className="dashboard-todo">
						{todo.map((item) => (
							<Link key={item.href} href={item.href} className={`dashboard-todo-card${item.value ? ' has-items' : ''}`}>
								<span className={`pi ${item.icon}`} aria-hidden="true"></span>
								<span className="dashboard-todo-value">{loading ? '…' : display(item.value)}</span>
								<span className="dashboard-todo-label">{item.label}</span>
								<span className="pi pi-arrow-right dashboard-todo-arrow" aria-hidden="true"></span>
							</Link>
						))}
					</div>
				)}
			</section>

			{pending.length > 0 && (
				<section aria-labelledby="dashboard-pending">
					<h2 id="dashboard-pending">Dernières recettes proposées</h2>
					<ul className="dashboard-pending">
						{pending.map((recipe) => (
							<li key={recipe.id}>
								<div>
									<strong>{recipe.title}</strong>
									<small>
										{[recipe.type, recipe.source === 'tiktok' ? 'Import TikTok' : null, recipe.createdAt?.toLocaleDateString('fr-FR')]
											.filter(Boolean)
											.join(' · ')}
									</small>
								</div>
							</li>
						))}
					</ul>
					<Link href="/admin-panel/recettes" className="dashboard-link">
						Ouvrir la modération <span className="pi pi-arrow-right" aria-hidden="true"></span>
					</Link>
				</section>
			)}

			<section aria-labelledby="dashboard-figures">
				<h2 id="dashboard-figures">Le site en chiffres</h2>
				<div className="dashboard-figures">
					{figures.map((item) => (
						<Link key={item.label} href={item.href} className="dashboard-figure">
							<span className={`pi ${item.icon}`} aria-hidden="true"></span>
							<span className="dashboard-figure-value">{loading ? '…' : display(item.value)}</span>
							<span className="dashboard-figure-label">{item.label}</span>
						</Link>
					))}
				</div>
			</section>
		</div>
	);
}
