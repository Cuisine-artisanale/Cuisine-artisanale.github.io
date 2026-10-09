import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import RecetteDesc from '@/components/features/RecetteDesc/RecetteDesc';
import Breadcrumb from '@/components/layout/Breadcrumb/Breadcrumb';
import '@/components/layout/Breadcrumb/Breadcrumb.css';
import {
  SITE_URL,
  buildRecipeDescription,
  buildRecipeJsonLd,
  getRecipeBySlug,
  serializeJsonLd,
} from '@/lib/server/recipes';
import { getUnits } from '@/lib/server/units';

interface PageProps {
  params: Promise<{ slug: string }>;
}

function canonicalPath(slug: string, url?: string) {
  return `/recettes/${url || slug}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getRecipeBySlug(slug).catch((error) => {
    console.error('Erreur chargement recette (metadata):', error);
    return null;
  });

  if (!data) {
    return {
      title: 'Recette introuvable',
      description: "La recette demandée n'a pas été trouvée.",
      robots: { index: false, follow: true },
    };
  }

  const { recipe } = data;
  const description = buildRecipeDescription(recipe);
  const path = canonicalPath(slug, recipe.url);
  const ogImage = recipe.images?.[0]
    ? `/api/og-image?title=${encodeURIComponent(recipe.title)}&type=${encodeURIComponent(recipe.type || 'Recette')}&image=${encodeURIComponent(recipe.images[0])}`
    : undefined;

  return {
    // Le layout ajoute " | Cuisine Artisanale"
    title: recipe.title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'article',
      url: path,
      title: recipe.title,
      description,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: recipe.title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: recipe.title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function RecipePage({ params }: PageProps) {
  const { slug } = await params;
  const [data, units] = await Promise.all([getRecipeBySlug(slug), getUnits()]);

  if (!data) {
    notFound();
  }

  const { recipe } = data;
  const canonicalUrl = `${SITE_URL}${canonicalPath(slug, recipe.url)}`;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Recettes', item: `${SITE_URL}/recettes` },
      { '@type': 'ListItem', position: 3, name: recipe.title, item: canonicalUrl },
    ],
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildRecipeJsonLd(data, canonicalUrl, units)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <Breadcrumb customRoutes={{ [slug]: recipe.title }} />
      <RecetteDesc
        key={recipe.id}
        initialRecipe={recipe}
        initialUnits={units}
        authorName={data.authorName}
        initialLikesCount={data.likesCount}
        initialReviews={data.reviews}
        similarRecipes={data.similar}
      />
    </div>
  );
}
