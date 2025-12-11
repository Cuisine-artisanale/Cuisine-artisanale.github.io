"use client";
import React, { useMemo } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import "./Breadcrumb.css";

const BreadCrumbPrime = dynamic(
  () => import("primereact/breadcrumb").then((mod) => mod.BreadCrumb),
  { ssr: false }
);

import type { BreadcrumbItem } from '@/types';

interface BreadcrumbProps {
  className?: string;
  customRoutes?: Record<string, string>;
}

const ROUTE_LABELS: Record<string, string> = {
  account: "Mon Compte",
  "mes-recettes": "Mes Recettes",
  "mes-favoris": "Mes Favoris",

  recettes: "Recettes",
  "add-recipe": "Ajouter une Recette",
  edit: "Éditer",

  "admin-panel": "Administration",
  dashboard: "Tableau de bord",
  users: "Utilisateurs",
  posts: "Posts",
  ingredients: "Ingrédients",
  units: "Unités",

  about: "À Propos",
  "mentions-legales": "Mentions Légales",
  "politique-confidentialite": "Politique de Confidentialité",
  map: "Carte",
};

const Breadcrumb: React.FC<BreadcrumbProps> = ({
  className = "",
  customRoutes = {},
}) => {
  const pathname = usePathname();

  const breadcrumbItems = useMemo(() => {
    const allLabels = { ...ROUTE_LABELS, ...customRoutes };

    let segments = pathname.split("/").filter(Boolean);

    if (segments[0] === "Cuisine-artisanale") {
      segments = segments.slice(1);
    }

    if (segments.length === 0) return [];

    return segments.map((segment, index) => {
      const url = "/" + segments.slice(0, index + 1).join("/");
      const label =
        allLabels[segment] ??
        segment.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

      return { label, url };
    });
  }, [pathname, customRoutes]);

  if (breadcrumbItems.length === 0) {
    return null;
  }

  const home = { icon: "pi pi-home", url: "/" };

  return (
    <BreadCrumbPrime
      model={breadcrumbItems}
      home={home}
      className={`breadcrumb-component ${className}`}
    />
  );
};

export default Breadcrumb;
