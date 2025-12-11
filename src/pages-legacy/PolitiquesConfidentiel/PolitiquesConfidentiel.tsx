"use client";
import React from 'react';
import './PolitiquesConfidentiel.css';
import { Breadcrumb } from '@/components/layout';

const PolitiquesConfidentiel: React.FC = () => {
  return (
	<div className="PolitiquesConfidentiel-container ">
	  <Breadcrumb />
	  <h1>Politique de confidentialité</h1>

	  <section>
		<h2>1. Collecte des données personnelles</h2>
		<p>
		  Le site <strong><a href="https://www.aymeric-sabatier.fr/Cuisine-artisanale">Cuisine-artisanale </a></strong>
		   peut collecter certaines données personnelles :
		</p>
		<ul>
		  <li>Nom ou pseudonyme lors de la publication d’une recette ou d’un commentaire</li>
		  <li>Adresse e-mail (si fournie volontairement pour contact ou inscription)</li>
		  <li>Données techniques (adresse IP, navigateur, statistiques de visite via cookies analytiques)</li>
		</ul>
	  </section>

	  <section>
		<h2>2. Finalité de la collecte</h2>
		<p>Ces données sont utilisées pour :</p>
		<ul>
		  <li>Permettre la publication et la modération des contenus</li>
		  <li>Améliorer l’expérience utilisateur</li>
		  <li>Contacter les utilisateurs si nécessaire</li>
		</ul>
	  </section>

	  <section>
		<h2>3. Conservation des données</h2>
		<p>
		  Les données personnelles sont conservées pendant une durée maximale de 3 ans après la dernière interaction.
		</p>
	  </section>

	  <section>
		<h2>4. Partage des données</h2>
		<p>
		  Aucune donnée personnelle n’est vendue ni transmise à des tiers.
		  Certaines données techniques peuvent être stockées par des services tiers (hébergeur, outils d’analyse).
		</p>
	  </section>

	  <section>
		<h2>5. Droits de l’utilisateur</h2>
		<p>
		  Conformément au RGPD, vous pouvez exercer vos droits d’accès, de rectification, de suppression ou de limitation
		  du traitement de vos données.
		</p>
		<p>
		  Pour toute demande : <a href="mailto:ssabatieraymeric@gmail.com">ssabatieraymeric@gmail.com</a>
		</p>
	  </section>

	  <section>
		<h2>6. Cookies</h2>
		<p>
		  Le site utilise des cookies nécessaires à son bon fonctionnement et à la mesure d’audience.
		  Vous pouvez gérer vos préférences via le bandeau de consentement affiché lors de votre première visite.
		</p>
	  </section>
	</div>
  );
};

export default PolitiquesConfidentiel;
