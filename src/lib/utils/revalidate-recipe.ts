import { auth } from '@/lib/config/firebase-app';

/**
 * Demande au serveur de régénérer la fiche d'une recette (en cache 10 min) après une action
 * de l'utilisateur connecté : like, avis, modification, suppression.
 * Sans attente ni erreur visible : au pire, la fiche se met à jour à l'expiration du cache.
 * `lists` : régénère aussi les listes de recettes (publication, suppression, changement de titre).
 */
export function revalidateRecipe(recipe: { id?: string | null; url?: string | null }, { lists = false } = {}): void {
  const slugs = [recipe.url, recipe.id].filter((s): s is string => Boolean(s));
  const user = auth.currentUser;
  if (!user || slugs.length === 0) return;

  user
    .getIdToken()
    .then((idToken) =>
      fetch('/api/revalidate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ slugs, lists }),
        keepalive: true,
      })
    )
    .catch(() => undefined);
}
