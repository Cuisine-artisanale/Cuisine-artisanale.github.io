import { loadFirestore } from '@/lib/config/firestore-lazy';
import { formatIngredientName, ingredientNameKey } from '@/lib/utils/ingredient-name';
import type { Ingredient, RecipePart } from '@/types';

export interface CatalogSyncResult {
  recipeParts: RecipePart[];
  /** Noms des fiches créées dans le catalogue */
  created: string[];
}

/**
 * À la validation d'une recette par un admin : rattache chaque ingrédient à sa fiche du catalogue
 * (collection "ingredients"), et crée la fiche quand l'ingrédient est nouveau.
 *
 * Les recettes importées (TikTok) peuvent contenir des ingrédients saisis librement, sans fiche :
 * tant que la recette n'est pas validée, rien n'est ajouté au catalogue.
 */
export async function syncRecipeIngredientsWithCatalog(recipeParts: RecipePart[] | undefined): Promise<CatalogSyncResult> {
  const parts = Array.isArray(recipeParts) ? recipeParts : [];
  const { db, collection, getDocs, addDoc, updateDoc } = await loadFirestore();

  const snapshot = await getDocs(collection(db, 'ingredients'));
  const ids = new Set(snapshot.docs.map((d) => d.id));
  const byKey = new Map<string, { id: string; name: string }>();
  for (const d of snapshot.docs) {
    const name = String(d.data().name || '');
    const key = ingredientNameKey(name);
    if (key && !byKey.has(key)) byKey.set(key, { id: d.id, name });
  }

  const created: string[] = [];

  const resolve = async (ingredient: Ingredient): Promise<Ingredient> => {
    // Déjà rattaché à une fiche existante
    if (ingredient.id && ids.has(ingredient.id)) return ingredient;

    const name = formatIngredientName(ingredient.name || '');
    const key = ingredientNameKey(name);
    if (!key) return ingredient;

    let entry = byKey.get(key);
    if (!entry) {
      // Même forme que les fiches créées depuis le formulaire (AddIngredientForm)
      const ref = await addDoc(collection(db, 'ingredients'), {
        name,
        price: 0,
        unit: ingredient.unit || '',
        ...(ingredient.unitId ? { defaultUnitId: ingredient.unitId } : {}),
        createdAt: new Date(),
      });
      await updateDoc(ref, { ingredientId: ref.id });
      entry = { id: ref.id, name };
      ids.add(ref.id);
      byKey.set(key, entry);
      created.push(name);
    }

    return { ...ingredient, id: entry.id, name: entry.name };
  };

  const result: RecipePart[] = [];
  for (const part of parts) {
    const ingredients: Ingredient[] = [];
    // L'un après l'autre : un même ingrédient cité deux fois ne doit créer qu'une fiche
    for (const ingredient of part.ingredients || []) {
      ingredients.push(await resolve(ingredient));
    }
    result.push({ ...part, ingredients });
  }

  return { recipeParts: result, created };
}
