// lib/utils.ts — Utilitaires métier
// Normalisation des noms de produits et calcul du prix ramené à l'unité de référence

import type { Unite } from './storage';

// ============================================================
// Normalisation des noms de produits
// ============================================================

/**
 * Normalise un nom de produit pour le matching et le stockage :
 * - Conversion en minuscules
 * - Suppression des diacritiques (é→e, ç→c, etc.)
 * - Collapse des espaces multiples
 * - Trim
 *
 * Exemple : "Coca-Cola 1,5L" → "coca-cola 1,5l"
 */
export function normaliserNom(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/\p{M}/gu, '')   // Supprimer les diacritiques
    .toLowerCase()
    .replace(/\s+/g, ' ')     // Collapse espaces
    .trim();
}

// ============================================================
// Calcul du prix ramené au kg ou au litre
// ============================================================

/**
 * Convertit n'importe quelle quantité/unité en son équivalent en kg ou litre.
 * Retourne null si l'unité est "pièce" (pas de conversion pertinente).
 *
 * @param prixUnitaire  Prix total du produit en euros
 * @param quantite      Quantité (ex: 500, 1.5)
 * @param unite         Unité de la quantité
 * @returns             Prix au kg ou au litre, ou null
 */
export function calculerPrixReference(
  prixUnitaire: number,
  quantite: number,
  unite: Unite
): number | null {
  if (quantite <= 0 || prixUnitaire <= 0) return null;

  switch (unite) {
    // Masse — tout ramener au kg
    case 'kg':
      return prixUnitaire / quantite;
    case 'g':
      return (prixUnitaire / quantite) * 1000;

    // Volume — tout ramener au litre
    case 'litre':
      return prixUnitaire / quantite;
    case 'cl':
      return (prixUnitaire / quantite) * 100;
    case 'ml':
      return (prixUnitaire / quantite) * 1000;

    // Pièce — pas de conversion pertinente
    case 'pièce':
      return null;

    default:
      return null;
  }
}

/**
 * Retourne le libellé de l'unité de référence (ex: "€/kg", "€/L")
 */
export function libellePrixReference(unite: Unite): string {
  switch (unite) {
    case 'kg':
    case 'g':
      return '€/kg';
    case 'litre':
    case 'cl':
    case 'ml':
      return '€/L';
    default:
      return '';
  }
}

/**
 * Formate un prix pour l'affichage (ex: 1.5 → "1,50 €")
 */
export function formaterPrix(prix: number): string {
  return prix.toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formate une date ISO en date lisible française (ex: "12 mai 2026")
 */
export function formaterDate(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Retourne true si une date ISO est dans les N derniers jours
 */
export function estDansLesNDerniersjours(dateIso: string, jours: number): boolean {
  const maintenant = Date.now();
  const date = new Date(dateIso).getTime();
  return maintenant - date <= jours * 24 * 60 * 60 * 1000;
}

// ============================================================
// Constantes utiles
// ============================================================

export const ENSEIGNES = [
  'Carrefour', 'Carrefour Market', 'Super U', 'Leclerc',
  'Intermarché', 'Auchan', 'Lidl', 'Aldi', 'Monoprix',
  'Franprix', 'Casino', 'Autre',
] as const;

export const CATEGORIES = [
  'alimentaire', 'boissons', 'hygiène', 'entretien',
  'bébé', 'animaux', 'autre',
] as const;

export const UNITES: { valeur: Unite; libelle: string }[] = [
  { valeur: 'kg', libelle: 'kg' },
  { valeur: 'g', libelle: 'g' },
  { valeur: 'litre', libelle: 'litre(s)' },
  { valeur: 'cl', libelle: 'cl' },
  { valeur: 'ml', libelle: 'ml' },
  { valeur: 'pièce', libelle: 'pièce(s)' },
];

export const ICONES_CATEGORIES: Record<string, string> = {
  alimentaire: '🥗',
  boissons: '🥤',
  hygiène: '🧴',
  entretien: '🧹',
  bébé: '👶',
  animaux: '🐾',
  autre: '📦',
};
