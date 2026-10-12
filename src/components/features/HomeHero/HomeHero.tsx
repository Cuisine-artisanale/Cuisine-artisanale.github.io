import Link from 'next/link';
import './HomeHero.css';

const RECIPE_TYPES = [
	{ label: 'Entrées', type: 'Entrée' },
	{ label: 'Plats', type: 'Plat' },
	{ label: 'Desserts', type: 'Dessert' },
	{ label: 'Boissons', type: 'Boisson' },
];

/**
 * En-tête de l'accueil : ce qu'est le site, une recherche et des raccourcis.
 * Composant serveur : le formulaire est un simple GET vers /recettes?keywords=…, sans JavaScript.
 */
export default function HomeHero() {
	return (
		<section className="home-hero">
			<h1>Les recettes traditionnelles françaises, faites maison</h1>
			<p className="home-hero-tagline">
				Des recettes de nos régions partagées par des passionnés, à cuisiner pas à pas.
			</p>

			<form className="home-hero-search" action="/recettes" method="get" role="search">
				<span className="pi pi-search" aria-hidden="true"></span>
				<input
					type="search"
					name="keywords"
					placeholder="Rechercher une recette : cassoulet, tarte aux pommes…"
					aria-label="Rechercher une recette"
					autoComplete="off"
				/>
				<button type="submit">Rechercher</button>
			</form>

			<nav className="home-hero-shortcuts" aria-label="Parcourir les recettes">
				{RECIPE_TYPES.map(({ label, type }) => (
					<Link key={type} href={`/recettes?type=${encodeURIComponent(type)}`}>{label}</Link>
				))}
				<Link href="/map">
					<span className="pi pi-map-marker" aria-hidden="true"></span>
					Par région
				</Link>
			</nav>
		</section>
	);
}
