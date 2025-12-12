/**
 * Types communs utilisés dans l'application
 */

export interface Unit {
  id: string;
  name: string;
  abbreviation: string;
  isActive?: boolean;
}

export interface Department {
  nom: string;
  code: string;
}

export interface Like {
  id: string;
  userId: string;
  userName?: string;
  recetteId: string;
  createdAt?: Date | any;
}

export interface CookieChoice {
  id: string;
  timestamp: Date;
  choice: 'accept' | 'reject';
}

export interface BreadcrumbItem {
  label: string;
  url?: string;
}

