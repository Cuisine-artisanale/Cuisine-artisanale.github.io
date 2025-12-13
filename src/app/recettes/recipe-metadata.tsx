'use client';

import { useEffect } from 'react';

interface RecipeMetadataProps {
  recipeId?: string;
  title?: string;
  type?: string;
  image?: string;
}

/**
 * Composant pour mettre à jour dynamiquement les métadonnées Open Graph
 * Utilisé pour la vue détail d'une recette
 */
export default function RecipeMetadata({
  recipeId,
  title,
  type = 'Recette',
  image,
}: RecipeMetadataProps) {
  // Use props directly - they come from the loaded recipe data
  const finalTitle = title;
  const finalImage = image;
  const finalDescription = title
    ? `Découvrez la recette "${title}" sur Cuisine Artisanale`
    : 'Découvrez cette délicieuse recette sur Cuisine Artisanale';

  useEffect(() => {
    if (finalTitle) {
      // Mettre à jour le titre du document
      document.title = `${finalTitle} | Cuisine Artisanale`;

      // Construire l'URL de l'image OG dynamique
      const ogImageUrl = new URL('/api/og-image', window.location.origin);
      ogImageUrl.searchParams.set('title', finalTitle);
      if (type) ogImageUrl.searchParams.set('type', type);
      if (finalImage) ogImageUrl.searchParams.set('image', finalImage);
      if (recipeId) ogImageUrl.searchParams.set('id', recipeId);

      // Meta OG:Title
      let metaOGTitle = document.querySelector('meta[property="og:title"]');
      if (!metaOGTitle) {
        metaOGTitle = document.createElement('meta');
        metaOGTitle.setAttribute('property', 'og:title');
        document.head.appendChild(metaOGTitle);
      }
      metaOGTitle.setAttribute('content', finalTitle);

      // Meta OG:Description
      let metaOGDescription = document.querySelector(
        'meta[property="og:description"]'
      );
      if (!metaOGDescription) {
        metaOGDescription = document.createElement('meta');
        metaOGDescription.setAttribute('property', 'og:description');
        document.head.appendChild(metaOGDescription);
      }
      metaOGDescription.setAttribute(
        'content',
        finalDescription
      );

      // Meta OG:Image - Utiliser l'image OG générée dynamiquement
      let metaOGImage = document.querySelector('meta[property="og:image"]');
      if (!metaOGImage) {
        metaOGImage = document.createElement('meta');
        metaOGImage.setAttribute('property', 'og:image');
        document.head.appendChild(metaOGImage);
      }
      metaOGImage.setAttribute('content', ogImageUrl.toString());

      // Meta OG:Image:Width
      let metaOGImageWidth = document.querySelector(
        'meta[property="og:image:width"]'
      );
      if (!metaOGImageWidth) {
        metaOGImageWidth = document.createElement('meta');
        metaOGImageWidth.setAttribute('property', 'og:image:width');
        document.head.appendChild(metaOGImageWidth);
      }
      metaOGImageWidth.setAttribute('content', '1200');

      // Meta OG:Image:Height
      let metaOGImageHeight = document.querySelector(
        'meta[property="og:image:height"]'
      );
      if (!metaOGImageHeight) {
        metaOGImageHeight = document.createElement('meta');
        metaOGImageHeight.setAttribute('property', 'og:image:height');
        document.head.appendChild(metaOGImageHeight);
      }
      metaOGImageHeight.setAttribute('content', '630');

      // Meta OG:URL
      let metaOGUrl = document.querySelector('meta[property="og:url"]');
      if (!metaOGUrl) {
        metaOGUrl = document.createElement('meta');
        metaOGUrl.setAttribute('property', 'og:url');
        document.head.appendChild(metaOGUrl);
      }
      const currentUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
      metaOGUrl.setAttribute('content', currentUrl);

      // Twitter Card
      let metaTwitterCard = document.querySelector(
        'meta[name="twitter:card"]'
      );
      if (!metaTwitterCard) {
        metaTwitterCard = document.createElement('meta');
        metaTwitterCard.setAttribute('name', 'twitter:card');
        document.head.appendChild(metaTwitterCard);
      }
      metaTwitterCard.setAttribute('content', 'summary_large_image');

      // Twitter Title
      let metaTwitterTitle = document.querySelector(
        'meta[name="twitter:title"]'
      );
      if (!metaTwitterTitle) {
        metaTwitterTitle = document.createElement('meta');
        metaTwitterTitle.setAttribute('name', 'twitter:title');
        document.head.appendChild(metaTwitterTitle);
      }
      metaTwitterTitle.setAttribute('content', finalTitle);

      // Twitter Description
      let metaTwitterDescription = document.querySelector(
        'meta[name="twitter:description"]'
      );
      if (!metaTwitterDescription) {
        metaTwitterDescription = document.createElement('meta');
        metaTwitterDescription.setAttribute('name', 'twitter:description');
        document.head.appendChild(metaTwitterDescription);
      }
      metaTwitterDescription.setAttribute(
        'content',
        finalDescription
      );

      // Twitter Image - Utiliser l'image OG générée dynamiquement
      const twitterImageUrl = new URL('/api/og-image', window.location.origin);
      twitterImageUrl.searchParams.set('title', finalTitle);
      if (type) twitterImageUrl.searchParams.set('type', type);
      if (finalImage) twitterImageUrl.searchParams.set('image', finalImage);
      if (recipeId) twitterImageUrl.searchParams.set('id', recipeId);

      let metaTwitterImage = document.querySelector(
        'meta[name="twitter:image"]'
      );
      if (!metaTwitterImage) {
        metaTwitterImage = document.createElement('meta');
        metaTwitterImage.setAttribute('name', 'twitter:image');
        document.head.appendChild(metaTwitterImage);
      }
      metaTwitterImage.setAttribute('content', twitterImageUrl.toString());
    }
  }, [finalTitle, finalDescription, finalImage, type, recipeId]);

  return null; // Ce composant ne rend rien, il gère juste les métadonnées
}
