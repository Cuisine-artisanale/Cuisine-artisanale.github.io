/**
 * Charge le SDK Firestore à la demande (fichier JS séparé, téléchargé une seule fois).
 *
 *   const { db, doc, getDoc } = await loadFirestore();
 *
 * À utiliser dans les composants vus par tous les visiteurs (layout, accueil, liste),
 * pour que Firestore ne soit téléchargé que lorsqu'une donnée en a réellement besoin.
 */
export async function loadFirestore() {
  const [firestore, { db }] = await Promise.all([
    import('firebase/firestore'),
    import('./firebase'),
  ]);
  return { ...firestore, db };
}
