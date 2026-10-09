import type { Ingredient } from '@/types';

/**
 * Combine l'ingrédient enregistré dans la recette avec sa fiche de référence (collection "ingredients").
 * - Le nom de référence est utilisé s'il existe (corrections d'orthographe…).
 * - L'unité est celle choisie DANS LA RECETTE ; l'unité de la fiche ne sert que si la recette n'en a pas.
 * - Un ingrédient absent de la collection (ex. import TikTok) reste affiché avec son nom enregistré.
 */
export function mergeIngredientDetails(
  ingredient: Ingredient,
  reference?: { name?: string; unit?: string } | null
): Ingredient | null {
  const name = reference?.name || ingredient.name || '';
  if (!name) return null;
  const hasRecipeUnit = Boolean(ingredient.unitId || (ingredient.unit && ingredient.unit.trim()));
  return {
    id: ingredient.id,
    name,
    quantity: ingredient.quantity,
    unit: hasRecipeUnit ? ingredient.unit : reference?.unit,
    ...(ingredient.unitId ? { unitId: ingredient.unitId } : {}),
  };
}
