/**
 * Types liés à la liste de course et aux recettes à faire
 */

import { Ingredient } from './recipe.types';

/**
 * Élément de la liste de course
 */
export interface ShoppingListItem {
  id: string;
  name: string;
  quantity?: string;
  unit?: string;
  checked: boolean;
  recipeId?: string; // ID de la recette d'origine (optionnel)
  recipeTitle?: string; // Titre de la recette d'origine (optionnel)
  createdAt: Date | any;
}

/**
 * Liste de course d'un utilisateur
 */
export interface ShoppingList {
  id: string;
  userId: string;
  items: ShoppingListItem[];
  createdAt: Date | any;
  updatedAt: Date | any;
}

/**
 * Recette ajoutée à "à faire"
 */
export interface RecipeToDo {
  id: string;
  userId: string;
  recipeId: string;
  recipeTitle: string;
  recipeImage?: string;
  addedAt: Date | any;
  ingredientsAddedToShoppingList: boolean; // Indique si les ingrédients ont été ajoutés à la liste
}

