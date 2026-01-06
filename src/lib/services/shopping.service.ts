import { db } from "@/lib/config/firebase";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
  arrayUnion,
  arrayRemove
} from "firebase/firestore";
import type { RecipeToDo, ShoppingList, ShoppingListItem } from "@/types/shopping.types";
import type { Ingredient, Recipe } from "@/types/recipe.types";

/**
 * Ajoute une recette à la liste "à faire" de l'utilisateur
 * Utilise un tableau d'objets dans la collection users avec recipeId et addedAt
 */
export const addRecipeToDo = async (userId: string, recipe: Recipe): Promise<void> => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error("User not found");
    }

    const userData = userSnap.data();
    const recipesToDo = userData.recipesToDo || [];

    // Vérifier si la recette n'est pas déjà dans la liste
    const alreadyExists = recipesToDo.some((item: { recipeId: string }) => item.recipeId === recipe.id);

    if (!alreadyExists) {
      await updateDoc(userRef, {
        recipesToDo: [...recipesToDo, {
          recipeId: recipe.id,
          addedAt: new Date()
        }]
      });
    }
  } catch (error) {
    console.error("Error adding recipe to do:", error);
    throw error;
  }
};

/**
 * Vérifie si une recette est déjà dans "à faire"
 */
export const isRecipeInToDo = async (userId: string, recipeId: string): Promise<boolean> => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return false;
    }

    const userData = userSnap.data();
    const recipesToDo = userData.recipesToDo || [];
    return recipesToDo.some((item: { recipeId: string }) => item.recipeId === recipeId);
  } catch (error) {
    console.error("Error checking if recipe is in to do:", error);
    return false;
  }
};

/**
 * Récupère toutes les recettes "à faire" d'un utilisateur
 * Retourne un tableau d'objets avec recipeId et addedAt
 */
export const getUserRecipesToDo = async (userId: string): Promise<Array<{ recipeId: string; addedAt: Date | any }>> => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return [];
    }

    const userData = userSnap.data();
    return userData.recipesToDo || [];
  } catch (error) {
    console.error("Error getting user recipes to do:", error);
    throw error;
  }
};

/**
 * Supprime une recette de "à faire"
 */
export const removeRecipeToDo = async (userId: string, recipeId: string): Promise<void> => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error("User not found");
    }

    const userData = userSnap.data();
    const recipesToDo = userData.recipesToDo || [];
    const updatedRecipesToDo = recipesToDo.filter((item: { recipeId: string }) => item.recipeId !== recipeId);

    await updateDoc(userRef, {
      recipesToDo: updatedRecipesToDo
    });
  } catch (error) {
    console.error("Error removing recipe to do:", error);
    throw error;
  }
};

/**
 * Récupère ou crée la liste de course d'un utilisateur
 */
export const getOrCreateShoppingList = async (userId: string): Promise<ShoppingList> => {
  try {
    const shoppingListsRef = collection(db, "shoppingLists");
    const q = query(
      shoppingListsRef,
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      } as ShoppingList;
    }

    // Créer une nouvelle liste de course
    const newListRef = doc(collection(db, "shoppingLists"));
    const newListData: Omit<ShoppingList, "id"> = {
      userId,
      items: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(newListRef, newListData);
    return {
      id: newListRef.id,
      ...newListData
    } as ShoppingList;
  } catch (error) {
    console.error("Error getting or creating shopping list:", error);
    throw error;
  }
};

/**
 * Ajoute des ingrédients à la liste de course
 */
export const addIngredientsToShoppingList = async (
  userId: string,
  ingredients: Ingredient[],
  recipeId?: string,
  recipeTitle?: string
): Promise<void> => {
  try {
    const shoppingList = await getOrCreateShoppingList(userId);

    // Convertir les ingrédients en items de liste de course
    // Note: on utilise new Date() au lieu de serverTimestamp() car Firebase ne supporte pas serverTimestamp() dans les tableaux
    const newItems: ShoppingListItem[] = ingredients.map(ingredient => ({
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      checked: false,
      recipeId,
      recipeTitle,
      createdAt: new Date()
    }));

    // Fusionner avec les items existants (éviter les doublons)
    const existingItems = shoppingList.items || [];
    const mergedItems = [...existingItems];

    newItems.forEach(newItem => {
      // Vérifier si un item similaire existe déjà
      const existingItem = mergedItems.find(
        item => item.name.toLowerCase() === newItem.name.toLowerCase() && !item.checked
      );

      if (existingItem) {
        // Fusionner les quantités si possible
        if (newItem.quantity && existingItem.quantity) {
          // Logique simple : ajouter les quantités si les unités sont identiques
          if (newItem.unit === existingItem.unit) {
            const existingQty = parseFloat(existingItem.quantity) || 0;
            const newQty = parseFloat(newItem.quantity) || 0;
            existingItem.quantity = (existingQty + newQty).toString();
          } else {
            // Unités différentes : ajouter comme nouvel item
            mergedItems.push(newItem);
          }
        } else {
          mergedItems.push(newItem);
        }
      } else {
        mergedItems.push(newItem);
      }
    });

    // Mettre à jour la liste de course
    const shoppingListRef = doc(db, "shoppingLists", shoppingList.id);
    await updateDoc(shoppingListRef, {
      items: mergedItems,
      updatedAt: serverTimestamp()
    });

    // Note: On ne stocke plus le statut "ingredientsAddedToShoppingList"
    // car on utilise maintenant un simple tableau d'IDs dans users
    // Si besoin, on pourrait ajouter un champ séparé ou une autre structure
  } catch (error) {
    console.error("Error adding ingredients to shopping list:", error);
    throw error;
  }
};

/**
 * Ajoute un item manuel à la liste de course
 */
export const addShoppingListItem = async (
  userId: string,
  item: ShoppingListItem
): Promise<void> => {
  try {
    const shoppingList = await getOrCreateShoppingList(userId);
    const shoppingListRef = doc(db, "shoppingLists", shoppingList.id);

    const updatedItems = [...(shoppingList.items || []), item];

    await updateDoc(shoppingListRef, {
      items: updatedItems,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error adding shopping list item:", error);
    throw error;
  }
};

/**
 * Met à jour un item de la liste de course
 */
export const updateShoppingListItem = async (
  shoppingListId: string,
  itemId: string,
  updates: Partial<ShoppingListItem>
): Promise<void> => {
  try {
    const shoppingListRef = doc(db, "shoppingLists", shoppingListId);
    const shoppingListSnap = await getDoc(shoppingListRef);

    if (!shoppingListSnap.exists()) {
      throw new Error("Shopping list not found");
    }

    const shoppingList = shoppingListSnap.data() as ShoppingList;
    const updatedItems = shoppingList.items.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    );

    await updateDoc(shoppingListRef, {
      items: updatedItems,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating shopping list item:", error);
    throw error;
  }
};

/**
 * Supprime un item de la liste de course
 */
export const removeShoppingListItem = async (
  shoppingListId: string,
  itemId: string
): Promise<void> => {
  try {
    const shoppingListRef = doc(db, "shoppingLists", shoppingListId);
    const shoppingListSnap = await getDoc(shoppingListRef);

    if (!shoppingListSnap.exists()) {
      throw new Error("Shopping list not found");
    }

    const shoppingList = shoppingListSnap.data() as ShoppingList;
    const updatedItems = shoppingList.items.filter(item => item.id !== itemId);

    await updateDoc(shoppingListRef, {
      items: updatedItems,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error removing shopping list item:", error);
    throw error;
  }
};

/**
 * Vide la liste de course
 */
export const clearShoppingList = async (shoppingListId: string): Promise<void> => {
  try {
    const shoppingListRef = doc(db, "shoppingLists", shoppingListId);
    await updateDoc(shoppingListRef, {
      items: [],
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error clearing shopping list:", error);
    throw error;
  }
};

