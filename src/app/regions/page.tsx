import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumb from '@/components/layout/Breadcrumb/Breadcrumb';
import '@/components/layout/Breadcrumb/Breadcrumb.css';
import { REGIONS } from '@/constants/regions';
import { getRecipeCountsByDepartement } from '@/lib/server/listings';
import './regions.css';

export const revalidate = 600;

export const metadata: Metadata = {
	title: 'Recettes par région : les spécialités de France',
	description:
		"Parcourez les recettes traditionnelles région par région : Bretagne, Occitanie, Auvergne-Rhône-Alpes, Provence… et retrouvez les spécialités de chaque terroir.",
	alternates: { canonical: '/regions' },
	openGraph: {
		url: '/regions',
		title: 'Recettes par région | Cuisine Artisanale',
		description: 'Les spécialités culinaires de chaque région de France.',
	},
};

export default async function RegionsPage() {
	const counts = await getRecipeCountsByDepartement().catch((error) => {
		console.error('Nombre de recettes par région indisponible :', error);
		return {} as Record<string, number>;
	});

	return (
		<div className="regions-page">
			<Breadcrumb />

			<header className="regions-header">
				<h1>Recettes par région</h1>
				<p>
					Chaque région a ses produits, ses tours de main et ses plats de famille. Choisissez un terroir pour
					découvrir ses recettes, ou explorez-les sur la <Link href="/map">carte de France</Link>.
				</p>
			</header>

			<ul className="regions-grid">
				{REGIONS.map((region) => {
					const count = region.departements.reduce((total, code) => total + (counts[code] || 0), 0);
					return (
						<li key={region.slug}>
							<Link href={`/regions/${region.slug}`} className="regions-card">
								<h2>{region.nom}</h2>
								<p>{region.description}</p>
								<span className="regions-card-count">
									{count > 0 ? `${count} recette${count > 1 ? 's' : ''}` : 'Bientôt des recettes'}
								</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
