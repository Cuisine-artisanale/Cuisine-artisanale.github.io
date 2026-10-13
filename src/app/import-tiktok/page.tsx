import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumb from '@/components/layout/Breadcrumb/Breadcrumb';
import '@/components/layout/Breadcrumb/Breadcrumb.css';
import { SITE_URL, serializeJsonLd } from '@/lib/server/recipes';
import './import-tiktok.css';

const IMPORT_URL = '/recettes/add-recipe?mode=tiktok';

export const metadata: Metadata = {
	title: 'Transformer une vidéo TikTok en recette écrite',
	description:
		"Collez le lien d'une vidéo TikTok : les ingrédients et les étapes sont extraits et rangés dans votre carnet privé, avec quantités ajustables et liste de courses.",
	alternates: { canonical: '/import-tiktok' },
	openGraph: {
		url: '/import-tiktok',
		title: 'Transformer une vidéo TikTok en recette écrite | Cuisine Artisanale',
		description: "Collez le lien d'une vidéo TikTok, récupérez la recette au propre.",
		images: [
			{
				url: `/api/og-image?title=${encodeURIComponent('Une vidéo TikTok, une recette au propre')}&type=${encodeURIComponent('Import TikTok')}`,
				width: 1200,
				height: 630,
			},
		],
	},
};

const STEPS = [
	{
		icon: 'pi pi-link',
		title: 'Collez le lien',
		text: "Copiez le lien de la vidéo depuis TikTok (Partager, puis Copier le lien) et collez-le dans le formulaire.",
	},
	{
		icon: 'pi pi-sparkles',
		title: 'La recette est extraite',
		text: "Titre, ingrédients, quantités et étapes sont repris de la légende de la vidéo et mis en forme.",
	},
	{
		icon: 'pi pi-check-circle',
		title: 'Elle rejoint votre carnet',
		text: "Corrigez ce qui doit l'être, puis enregistrez : la recette est disponible aussitôt dans votre carnet privé.",
	},
];

const BENEFITS = [
	{ icon: 'pi pi-shopping-cart', text: 'La liste de courses en un clic' },
	{ icon: 'pi pi-users', text: 'Les quantités ajustées au nombre de convives' },
	{ icon: 'pi pi-file-pdf', text: 'Une version PDF ou imprimable' },
	{ icon: 'pi pi-lock', text: 'Un carnet privé, visible par vous seul' },
];

const FAQ = [
	{
		question: 'Faut-il un compte ?',
		answer: "Oui, un compte gratuit : c'est lui qui garde votre carnet de recettes.",
	},
	{
		question: 'Quelles vidéos fonctionnent ?',
		answer:
			"Les vidéos TikTok publiques dont la légende décrit la recette. Si la légende est incomplète, vous pouvez ajouter le texte manquant (un commentaire épinglé, par exemple) avant l'analyse.",
	},
	{
		question: 'Ma recette est-elle rendue publique ?',
		answer:
			"Non, elle reste dans votre carnet privé. Vous pouvez, si vous le souhaitez, la proposer à la publication : elle est alors vérifiée avant d'apparaître sur le site.",
	},
];

export default function ImportTikTokPage() {
	const faqJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: FAQ.map(({ question, answer }) => ({
			'@type': 'Question',
			name: question,
			acceptedAnswer: { '@type': 'Answer', text: answer },
		})),
	};

	const breadcrumbJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: [
			{ '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE_URL}/` },
			{ '@type': 'ListItem', position: 2, name: 'Import TikTok', item: `${SITE_URL}/import-tiktok` },
		],
	};

	return (
		<div className="import-tiktok-page">
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }} />
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }} />
			<Breadcrumb />

			<header className="import-tiktok-hero">
				<h1>Une vidéo TikTok, une recette au propre</h1>
				<p>
					Fini les captures d&apos;écran et les pauses toutes les trois secondes : collez le lien de la vidéo,
					récupérez les ingrédients et les étapes, lisibles et prêts à cuisiner.
				</p>
				<Link href={IMPORT_URL} className="import-tiktok-cta">
					<span className="pi pi-video" aria-hidden="true"></span>
					Importer une vidéo
				</Link>
			</header>

			<section aria-labelledby="import-tiktok-steps">
				<h2 id="import-tiktok-steps">Comment ça marche</h2>
				<ol className="import-tiktok-steps">
					{STEPS.map((step) => (
						<li key={step.title}>
							<span className={step.icon} aria-hidden="true"></span>
							<h3>{step.title}</h3>
							<p>{step.text}</p>
						</li>
					))}
				</ol>
			</section>

			<section aria-labelledby="import-tiktok-benefits">
				<h2 id="import-tiktok-benefits">Ce que vous y gagnez</h2>
				<ul className="import-tiktok-benefits">
					{BENEFITS.map((benefit) => (
						<li key={benefit.text}>
							<span className={benefit.icon} aria-hidden="true"></span>
							{benefit.text}
						</li>
					))}
				</ul>
			</section>

			<section aria-labelledby="import-tiktok-faq">
				<h2 id="import-tiktok-faq">Questions fréquentes</h2>
				<dl className="import-tiktok-faq">
					{FAQ.map(({ question, answer }) => (
						<div key={question}>
							<dt>{question}</dt>
							<dd>{answer}</dd>
						</div>
					))}
				</dl>
			</section>

			<p className="import-tiktok-footer">
				<Link href={IMPORT_URL} className="import-tiktok-cta">Importer ma première vidéo</Link>
			</p>
		</div>
	);
}
