/**
 * Types liés aux utilisateurs
 */

export interface User {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role?: 'user' | 'admin';
  createdAt?: Date | any;
  emailVerified?: boolean;
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

