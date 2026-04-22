/**
 * Types liés aux recettes
 */

export interface Ingredient {
  id: string;
  name: string;
  quantity?: string;
  unit?: string;
}

export interface RecipePart {
  title: string;
  steps: string[];
  ingredients: Ingredient[];
}

export interface Recipe {
  id: string;
  title: string;
  type: string;
  cookingTime: number;
  preparationTime: number;
  recipeParts: RecipePart[];
  video?: string;
  position: string;
  images?: string[];
  createdBy?: string;
  createdAt?: Date | any;
  url?: string;
  source?: 'manual' | 'tiktok';
  sourceVideoId?: string;
  sourceCollectionId?: string;
  importedBy?: string;
  status?: 'pending' | 'approved' | 'rejected';
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface RecipeData {
  title: string;
  type: string;
  preparationTime: number;
  cookingTime: number;
  position: string;
  recipeParts: RecipePart[];
  images?: string[];
  video?: string;
  titleKeywords?: string[];
  url?: string;
  createdBy?: string;
  createdAt?: Date;
  source?: 'manual' | 'tiktok';
  sourceVideoId?: string;
  sourceCollectionId?: string;
  importedBy?: string;
}

export interface RecipeRequest {
  title: string;
  url?: string;
  type?: string;
  preparationTime?: number;
  cookingTime?: number;
  position?: string;
  recipeParts?: RecipePart[];
  images?: string[];
  video?: string;
  createdBy?: string;
  createdAt?: Date;
  source?: 'manual' | 'tiktok';
  sourceVideoId?: string;
  sourceCollectionId?: string;
  importedBy?: string;
  titleKeywords?: string[];
}

