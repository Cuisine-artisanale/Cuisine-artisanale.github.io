/**
 * Types pour les services
 */

import type { RecipePart } from './recipe.types';

/**
 * Options pour le partage de recettes
 */
export interface ShareOptions {
  title: string;
  description: string;
  recipeId: string;
  imageUrl?: string;
}

/**
 * Données pour l'export de recette (PDF/impression)
 */
export interface RecipeExportData {
  title: string;
  type: string;
  preparationTime: number;
  cookingTime: number;
  position?: string;
  departementName?: string;
  recipeParts: {
    title: string;
    ingredients: {
      name: string;
      quantity: string;
      unit: string;
    }[];
    steps: string[];
  }[];
  images?: string[];
}

/**
 * Sévérité des notifications toast
 */
export type ToastSeverity = 'success' | 'info' | 'warn' | 'error';

/**
 * Options pour les notifications toast
 */
export interface ToastOptions {
  severity: ToastSeverity;
  summary: string;
  detail: string;
  life?: number;
}

