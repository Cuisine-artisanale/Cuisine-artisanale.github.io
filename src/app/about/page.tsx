import type { Metadata } from 'next';
import './about.css';
import { LienUtiles } from '@/components/layout';
import { Breadcrumb } from '@/components/layout';

export const metadata: Metadata = {
	title: "À propos | Cuisine artisanale",
	description: "Découvrez la mission, l'histoire et les valeurs de Cuisine Artisanale.",
};

const features = [
	{
		icon: 'pi pi-heart',
		title: 'Passion pour la Cuisine',
		description: 'Des recettes créées et testées avec amour pour garantir votre réussite en cuisine.'
	},
	{
		icon: 'pi pi-users',
		title: 'Communauté',
		description: 'Une communauté active de passionnés de cuisine qui partagent leurs expériences.'
	},
	{
		icon: 'pi pi-check-circle',
		title: 'Qualité',
		description: 'Des ingrédients soigneusement sélectionnés et des instructions détaillées pour chaque recette.'
	}
];

export default function Page() {
	return (
		<div className="about-container">
			<Breadcrumb />
			<section className="about-hero">
				<h1>Bienvenue sur <span className="highlight">Cuisine Artisanale</span></h1>
				<p className="subtitle">Où la passion de la cuisine rencontre la technologie moderne</p>
			</section>

			<hr className="about-divider" />

			<section className="about-mission">
				<div className="mission-card card">
					<h2>Notre Mission</h2>
					<p>
						Chez Cuisine Artisanale, nous croyons que la cuisine doit être accessible à tous et source de plaisir quotidien.
						Notre plateforme combine technologie moderne et savoir-faire culinaire pour vous offrir une expérience unique.
					</p>
				</div>
			</section>

			<section className="features-grid">
				{features.map((feature, index) => (
					<div key={index} className="feature-card card">
						<div className="feature-icon">
							<i className={feature.icon}></i>
						</div>
						<h3>{feature.title}</h3>
						<p>{feature.description}</p>
					</div>
				))}
			</section>

			<section className="about-story">
				<div className="story-card card">
					<h2>Notre Histoire</h2>
					<p>
						En tant que développeur passionné de gastronomie, j'ai créé Cuisine Artisanale pour fusionner
						mes deux passions : le développement web et la cuisine. Ce projet est né de la volonté de créer
						une plateforme moderne qui rend la cuisine accessible et agréable pour tous.
					</p>
					<p>
						Notre objectif est de vous accompagner dans votre aventure culinaire, que vous soyez débutant
						ou chef expérimenté. Chaque recette est soigneusement élaborée et testée pour garantir votre réussite.
					</p>
				</div>
			</section>

			<section className="about-connect">
				<div className="connect-card card">
					<h2>Restons Connectés</h2>
					<p>
						Envie d'échanger, de partager vos idées ou de contribuer au développement de la plateforme ?
						N'hésitez pas à me contacter via les liens ci-dessous.
					</p>
					<div className="social-links">
						<LienUtiles />
					</div>
				</div>
			</section>
		</div>
	);
}


