/**
 * Types liés aux utilisateurs
 */

export interface RecipeToDoItem {
  recipeId: string;
  addedAt: Date | any;
}

export interface User {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role?: 'user' | 'admin';
  createdAt?: Date | any;
  emailVerified?: boolean;
  recipesToDo?: RecipeToDoItem[]; // Array d'objets avec recipeId et addedAt
}

export interface UserData {
  email: string;
  displayName?: string;
  photoURL?: string;
  role?: 'user' | 'admin';
  createdAt?: Date;
  emailVerified?: boolean;
}

export interface UserStats {
  recipesCount: number;
  favoritesCount: number;
  postsCount: number;
  likesCount: number;
}

