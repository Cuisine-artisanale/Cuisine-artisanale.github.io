import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import Recette from '@/components/features/Recette/Recette';
import Breadcrumb from '@/components/layout/Breadcrumb/Breadcrumb';
import '@/components/layout/Breadcrumb/Breadcrumb.css';
import { getRegionBySlug, getRegionDepartements } from '@/constants/regions';
import { DEPARTEMENT_TEXTES } from '@/constants/departement-textes';
import { getRecipesByDepartements } from '@/lib/server/listings';
import { SITE_URL, serializeJsonLd } from '@/lib/server/recipes';
import '../../regions.css';

// Page générée à la première visite puis servie depuis le cache, régénérée au plus toutes les 10 minutes
export const revalidate = 600;

export function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ slug: string; departement: string }>;
}

function findDepartement(regionSlug: string, departementSlug: string) {
  const region = getRegionBySlug(regionSlug);
  const departements = region ? getRegionDepartements(region) : [];
  const departement = departements.find((d) => d.slug === departementSlug);
  return region && departement ? { region, departement, departements } : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, departement: departementSlug } = await params;
  const found = findDepartement(slug, departementSlug);

  if (!found) {
    return {
      title: 'Département introuvable',
      robots: { index: false, follow: true },
    };
  }

  const { region, departement } = found;
  const recettes = await getRecipesByDepartements([departement.code]).catch(() => []);
  const title = `Spécialités ${departement.de} : recettes traditionnelles`;
  // Texte propre au département s'il existe (première phrase), sinon une description générique
  const text = DEPARTEMENT_TEXTES[departement.code];
  const description = text
    ? `Spécialités ${departement.de} (${departement.code}). ${text.split(/(?<=\.) /)[0]}`
    : `Les recettes et spécialités ${departement.de} (${departement.code}), en région ${region.nom} : plats du terroir expliqués pas à pas.`;
  const path = `/regions/${region.slug}/${departement.slug}`;
  const ogImage = `/api/og-image?title=${encodeURIComponent(`Spécialités ${departement.de}`)}&type=${encodeURIComponent(region.nom)}`;

  return {
    // Le layout ajoute " | Cuisine Artisanale"
    title,
    description,
    alternates: { canonical: path },
    // Un département sans recette n'apporte rien aux moteurs de recherche tant qu'il est vide
    robots: recettes.length === 0 ? { index: false, follow: true } : undefined,
    openGraph: {
      url: path,
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function DepartementPage({ params }: PageProps) {
  const { slug, departement: departementSlug } = await params;
  const found = findDepartement(slug, departementSlug);

  if (!found) {
    notFound();
  }

  const { region, departement, departements } = found;
  const recettes = await getRecipesByDepartements([departement.code]);
  const regionUrl = `${SITE_URL}/regions/${region.slug}`;
  const canonicalUrl = `${regionUrl}/${departement.slug}`;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Régions', item: `${SITE_URL}/regions` },
      { '@type': 'ListItem', position: 3, name: region.nom, item: regionUrl },
      { '@type': 'ListItem', position: 4, name: departement.nom, item: canonicalUrl },
    ],
  };

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Spécialités ${departement.de}`,
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
      <Breadcrumb customRoutes={{ [region.slug]: region.nom, [departement.slug]: departement.nom }} />

      <header className="regions-header">
        <h1>Spécialités {departement.de}</h1>
        {/* Texte propre au département ; à défaut, celui de la région */}
        <p>{DEPARTEMENT_TEXTES[departement.code] ?? region.description}</p>
        <p>
          Les recettes traditionnelles {departement.de} ({departement.code}), un département de la région{' '}
          <Link href={`/regions/${region.slug}`}>{region.nom}</Link>.
        </p>
      </header>

      {recettes.length > 0 ? (
        <section className="regions-recipes" aria-label={`Recettes ${departement.de}`}>
          {recettes.map((recette) => (
            <Recette key={recette.recetteId} {...recette} />
          ))}
        </section>
      ) : (
        <p className="regions-empty">
          Aucune recette {departement.de} pour le moment.{' '}
          <Link href="/recettes/add-recipe">Proposez la première</Link> !
        </p>
      )}

      {departements.length > 1 && (
        <nav className="regions-others" aria-label={`Autres départements ${region.de}`}>
          <h2>Les autres départements {region.de}</h2>
          <ul>
            {departements
              .filter((d) => d.code !== departement.code)
              .map((d) => (
                <li key={d.code}>
                  <Link href={`/regions/${region.slug}/${d.slug}`}>{d.nom}</Link>
                </li>
              ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
