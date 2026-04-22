/**
 * Génère un slug à partir d'un titre
 * Utilise des tirets (-) au lieu d'underscores pour de meilleures URLs SEO
 */
export function slugify(title: string): string {
  const normalizedTitle = title
    // Supprime les suffixes "réseaux sociaux" fréquents dans les captions TikTok
    .replace(
      /\b(?:ca|ça|j['’`]?aime|je\s+vous\s+laisse|dis[-\s]?moi|tu\s+valide[s]?|team|abonne[-\s]?toi|like)\b[\s\S]*$/i,
      '',
    )
    // Supprime les articles initiaux pour un slug plus court (ex: "les bricks..." -> "bricks...")
    .replace(/^\s*(?:les|le|la|des|du|de)\s+/i, ' ')
    .trim();

  return normalizedTitle
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/[^\w\s-]/g, '') // Supprime les caractères spéciaux
    .trim()
    .replace(/\s+/g, '-') // Remplace les espaces par des tirets
    .replace(/-+/g, '-') // Remplace les tirets multiples par un seul
    .toLowerCase();
}

/**
 * Génère une URL de recette à partir d'un slug
 */
export function getRecipeUrl(slug: string): string {
  return `/recettes/${slug}`;
}

/**
 * Génère une URL de recette à partir d'un titre
 */
export function getRecipeUrlFromTitle(title: string): string {
  return getRecipeUrl(slugify(title));
}

