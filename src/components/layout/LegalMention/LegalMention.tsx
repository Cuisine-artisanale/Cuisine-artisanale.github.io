"use client";
import React from 'react';
import './LegalMention.css';
import LienUtiles from '@/components/layout/LienUtiles/LienUtiles';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Pied de page du site : présentation, navigation, informations légales et contact. */
const LegalMention: React.FC = () => {
	const pathname = usePathname();
	// La page À propos affiche déjà les liens de contact
	const isAboutPage = pathname === '/about';

	return (
		<footer className="LegalMention">
			<div className="site-footer-columns">
				<div className="site-footer-brand">
					<p className="site-footer-name">Cuisine Artisanale</p>
					<p>Les recettes traditionnelles, partagées par des passionnés.</p>
				</div>

				<nav aria-label="Navigation du pied de page">
					<p className="site-footer-heading">Explorer</p>
					<ul>
						<li><Link href="/recettes">Toutes les recettes</Link></li>
						<li><Link href="/regions">Recettes par région</Link></li>
						<li><Link href="/map">Carte des recettes</Link></li>
						<li><Link href="/recettes/add-recipe">Proposer une recette</Link></li>
						<li><Link href="/about">À propos</Link></li>
					</ul>
				</nav>

				<nav aria-label="Informations légales">
					<p className="site-footer-heading">Informations</p>
					<ul>
						<li><Link href="/mentions-legales">Mentions légales</Link></li>
						<li><Link href="/politique-confidentialite">Politique de confidentialité</Link></li>
					</ul>
				</nav>
			</div>

			{!isAboutPage && <LienUtiles />}

			<p className="site-footer-copyright">© {new Date().getFullYear()} Cuisine Artisanale · Aymeric Sabatier</p>
		</footer>
	);
};

export default LegalMention;
