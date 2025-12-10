import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import RecetteDesc from '@/components/RecetteDesc/RecetteDesc';
import Breadcrumb from '@/components/Breadcrumb/Breadcrumb';
import '@/components/Breadcrumb/Breadcrumb.css';
import { db } from '@firebaseModule';
import { collection, query, where, getDocs, limit } from '@firebase/firestore';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Récupère les métadonnées de la recette pour le SEO
 */
async function getRecipeMetadata(slug: string): Promise<Metadata | null> {
  try {
    const recipesRef = collection(db, 'recipes');
    const q = query(recipesRef, where('url', '==', slug), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const recipe = querySnapshot.docs[0].data();
    const recipeId = querySnapshot.docs[0].id;

    return {
      title: `${recipe.title} | Cuisine Artisanale`,
      description: `Découvrez la recette "${recipe.title}" - ${recipe.type || 'Recette'} sur Cuisine Artisanale`,
      openGraph: {
        title: recipe.title,
        description: `Découvrez la recette "${recipe.title}" sur Cuisine Artisanale`,
        type: 'article',
        url: `https://www.cuisine-artisanale.fr/recettes/${slug}`,
        images: recipe.images?.[0]
          ? [
              {
                url: `/api/og-image?title=${encodeURIComponent(recipe.title)}&type=${encodeURIComponent(recipe.type || 'Recette')}&image=${encodeURIComponent(recipe.images[0])}&id=${recipeId}`,
                width: 1200,
                height: 630,
                alt: recipe.title,
              },
            ]
          : [],
      },
      twitter: {
        card: 'summary_large_image',
        title: recipe.title,
        description: `Découvrez la recette "${recipe.title}" sur Cuisine Artisanale`,
        images: recipe.images?.[0]
          ? [`/api/og-image?title=${encodeURIComponent(recipe.title)}&type=${encodeURIComponent(recipe.type || 'Recette')}&image=${encodeURIComponent(recipe.images[0])}&id=${recipeId}`]
          : [],
      },
    };
  } catch (error) {
    console.error('Error fetching recipe metadata:', error);
    return null;
  }
}

/**
 * Récupère l'ID de la recette à partir du slug
 */
async function getRecipeIdBySlug(slug: string): Promise<string | null> {
  try {
    const recipesRef = collection(db, 'recipes');
    const q = query(recipesRef, where('url', '==', slug), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    return querySnapshot.docs[0].id;
  } catch (error) {
    console.error('Error fetching recipe ID:', error);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const metadata = await getRecipeMetadata(slug);

  if (!metadata) {
    return {
      title: 'Recette non trouvée | Cuisine Artisanale',
      description: 'La recette demandée n\'a pas été trouvée.',
    };
  }

  return metadata;
}

export default async function RecipePage({ params }: PageProps) {
  const { slug } = await params;
  const recipeId = await getRecipeIdBySlug(slug);

  if (!recipeId) {
    notFound();
  }

  return (
    <div>
      <Breadcrumb />
      <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>}>
        <RecetteDesc recipeId={recipeId} />
      </Suspense>
    </div>
  );
}

