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
 */
export const addRecipeToDo = async (userId: string, recipe: Recipe): Promise<string> => {
  try {
    const recipeToDoRef = doc(collection(db, "recipesToDo"));
    const recipeToDoData: Omit<RecipeToDo, "id"> = {
      userId,
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      recipeImage: recipe.images?.[0],
      addedAt: serverTimestamp(),
      ingredientsAddedToShoppingList: false
    };

    await setDoc(recipeToDoRef, recipeToDoData);
    return recipeToDoRef.id;
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
    const recipesToDoRef = collection(db, "recipesToDo");
    const q = query(
      recipesToDoRef,
      where("userId", "==", userId),
      where("recipeId", "==", recipeId)
    );
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error("Error checking if recipe is in to do:", error);
    return false;
  }
};

/**
 * Récupère toutes les recettes "à faire" d'un utilisateur
 */
export const getUserRecipesToDo = async (userId: string): Promise<RecipeToDo[]> => {
  try {
    const recipesToDoRef = collection(db, "recipesToDo");
    const q = query(
      recipesToDoRef,
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as RecipeToDo));
  } catch (error) {
    console.error("Error getting user recipes to do:", error);
    throw error;
  }
};

/**
 * Supprime une recette de "à faire"
 */
export const removeRecipeToDo = async (recipeToDoId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, "recipesToDo", recipeToDoId));
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
    const newItems: ShoppingListItem[] = ingredients.map(ingredient => ({
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      checked: false,
      recipeId,
      recipeTitle,
      createdAt: serverTimestamp()
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

    // Si une recette est associée, marquer que ses ingrédients ont été ajoutés
    if (recipeId) {
      const recipesToDoRef = collection(db, "recipesToDo");
      const q = query(
        recipesToDoRef,
        where("userId", "==", userId),
        where("recipeId", "==", recipeId)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const recipeToDoDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, "recipesToDo", recipeToDoDoc.id), {
          ingredientsAddedToShoppingList: true
        });
      }
    }
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

