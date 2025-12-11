/**
 * Types liés aux reviews/avis
 */

import { Timestamp } from 'firebase/firestore';

export interface Review {
  id: string;
  userId: string;
  userName?: string;
  recipeId: string;
  rating: number;
  comment: string;
  createdAt: Date | Timestamp | any;
}

export interface ReviewData {
  userId: string;
  userName?: string;
  recipeId: string;
  rating: number;
  comment: string;
  createdAt?: Date | Timestamp;
}

