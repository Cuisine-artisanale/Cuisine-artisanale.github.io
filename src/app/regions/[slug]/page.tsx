import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import Recette from '@/components/features/Recette/Recette';
import Breadcrumb from '@/components/layout/Breadcrumb/Breadcrumb';
import '@/components/layout/Breadcrumb/Breadcrumb.css';
import { REGIONS, getRegionBySlug, getRegionDepartements } from '@/constants/regions';
import { getRecipesByDepartements } from '@/lib/server/listings';
import { SITE_URL, serializeJsonLd } from '@/lib/server/recipes';
import '../regions.css';

// Page générée à la première visite puis servie depuis le cache, régénérée au plus toutes les 10 minutes
export const revalidate = 600;

export function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const region = getRegionBySlug(slug);

  if (!region) {
    return {
      title: 'Région introuvable',
      robots: { index: false, follow: true },
    };
  }

  const recettes = await getRecipesByDepartements(region.departements).catch(() => []);
  const title = `Recettes ${region.de} : spécialités régionales`;
  const description = `Les recettes traditionnelles ${region.de}. ${region.description}`;
  const path = `/regions/${region.slug}`;
  const ogImage = `/api/og-image?title=${encodeURIComponent(`Recettes ${region.de}`)}&type=${encodeURIComponent('Spécialités régionales')}`;

  return {
    // Le layout ajoute " | Cuisine Artisanale"
    title,
    description,
    alternates: { canonical: path },
    // Une région sans recette n'apporte rien aux moteurs de recherche tant qu'elle est vide
    robots: recettes.length === 0 ? { index: false, follow: true } : undefined,
    openGraph: {
      url: path,
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function RegionPage({ params }: PageProps) {
  const { slug } = await params;
  const region = getRegionBySlug(slug);

  if (!region) {
    notFound();
  }

  const recettes = await getRecipesByDepartements(region.departements);
  const canonicalUrl = `${SITE_URL}/regions/${region.slug}`;
  const withRecipes = new Set(recettes.map((r) => r.position));

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Régions', item: `${SITE_URL}/regions` },
      { '@type': 'ListItem', position: 3, name: region.nom, item: canonicalUrl },
    ],
  };

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Recettes ${region.de}`,
    numberOfItems: recettes.length,
    itemListElement: recettes.map((recette, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: recette.title,
      url: `${SITE_URL}/recettes/${encodeURIComponent(recette.url || recette.recetteId)}`,
    })),
  };

  return (
    <div className="regions-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      {recettes.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListJsonLd) }}
        />
      )}
      <Breadcrumb customRoutes={{ [region.slug]: region.nom }} />

      <header className="regions-header">
        <h1>Recettes {region.de}</h1>
        <p>{region.description}</p>
        <ul className="regions-departements" aria-label={`Départements ${region.de}`}>
          {/* Seuls les départements qui ont des recettes mènent à leur page (les autres sont en noindex) */}
          {getRegionDepartements(region).map((departement) => (
            <li key={departement.code}>
              {withRecipes.has(departement.code) ? (
                <Link href={`/regions/${region.slug}/${departement.slug}`}>{departement.nom}</Link>
              ) : (
                <span>{departement.nom}</span>
              )}
            </li>
          ))}
        </ul>
      </header>

      {recettes.length > 0 ? (
        <section className="regions-recipes" aria-label={`Recettes ${region.de}`}>
          {recettes.map((recette) => (
            <Recette key={recette.recetteId} {...recette} />
          ))}
        </section>
      ) : (
        <p className="regions-empty">
          Aucune recette {region.de} pour le moment.{' '}
          <Link href="/recettes/add-recipe">Proposez la première</Link> !
        </p>
      )}

      <nav className="regions-others" aria-label="Autres régions">
        <h2>Les autres régions</h2>
        <ul>
          {REGIONS.filter((r) => r.slug !== region.slug).map((r) => (
            <li key={r.slug}>
              <Link href={`/regions/${r.slug}`}>{r.nom}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
