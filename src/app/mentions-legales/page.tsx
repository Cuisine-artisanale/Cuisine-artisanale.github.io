import type { Metadata } from 'next';
import './mentions-legales.css';
import { Breadcrumb } from '@/components/layout';

export const metadata: Metadata = {
	title: "Mentions légales | Cuisine artisanale",
	description: "Mentions légales du site Cuisine artisanale",
};

export default function Page() {
	return (
		<div className="LegalMentions-container">
			<Breadcrumb />
			<h1>Mentions légales</h1>

			<section>
				<h2>Éditeur du site</h2>
				<p>
					Le site <strong><a href="https://www.aymeric-sabatier.fr/Cuisine-artisanale">Cuisine-artisanale</a></strong>
					est édité par <strong>Aymeric Sabatier</strong>.
				</p>
				<ul>
					<li>Statut : Particulier (projet personnel)</li>
					<li>Email : <a href="mailto:ssabatieraymeric@gmail.com">ssabatieraymeric@gmail.com</a></li>
					<li>Adresse : France</li>
				</ul>
				<p>
					Ce site est à but non commercial, et a pour objectif le partage de recettes et de publications culinaires.
				</p>
			</section>

			<section>
				<h2>Hébergement</h2>
				<p>
					Le site est actuellement hébergé sur <strong>Vercel</strong> :
				</p>
				<ul>
					<li>Vercel Inc.</li>
					<li>340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis</li>
					<li>Site web : <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">https://vercel.com</a></li>
				</ul>
				<p>
					Le site pourra ultérieurement être hébergé sur un NAS personnel.
				</p>
			</section>

			<section>
				<h2>Propriété intellectuelle</h2>
				<p>
					L'ensemble des contenus présents sur le site (textes, images, recettes, graphismes, logos, etc.)
					sont la propriété exclusive de Aymeric Sabatier, sauf mention contraire.
					Toute reproduction, représentation, modification, publication, adaptation de tout ou partie des éléments du site,
					quel que soit le moyen ou le procédé utilisé, est interdite sans autorisation écrite préalable.
				</p>
			</section>

			<section>
				<h2>Responsabilité</h2>
				<p>
					L'éditeur s'efforce de fournir des informations exactes et à jour, mais ne saurait être tenu responsable
					des erreurs ou omissions, ni d'une indisponibilité du service.
				</p>
				<p>
					L'utilisateur reconnaît utiliser le site sous sa responsabilité exclusive.
				</p>
			</section>
		</div>
	);
}
