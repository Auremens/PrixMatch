// lib/config.ts — Configuration des enseignes et catégories
// Modifie directement ce fichier pour ajouter, renommer ou supprimer des valeurs

export const ENSEIGNES: string[] = [
  // Grandes surfaces nationales
  'Carrefour',
  'Carrefour Market',
  'Super U',
  'Leclerc',
  'Intermarché',
  'Auchan',
  'Lidl',
  'Aldi',
  'Monoprix',
  'Franprix',
  'Casino',
  // Ajoutez vos enseignes ici ↓
];

export const CATEGORIES: string[] = [
  'alimentaire',
  'boissons',
  'hygiène',
  'entretien',
  'bébé',
  'animaux',
  // Ajoutez vos catégories ici ↓
];

export const ICONES_CATEGORIES: Record<string, string> = {
  alimentaire: '🥗',
  boissons: '🥤',
  hygiène: '🧴',
  entretien: '🧹',
  bébé: '👶',
  animaux: '🐾',
  // Ajoutez l'icône de vos catégories ici ↓ (sinon 🏷️ par défaut)
};

export function iconeCategorie(cat: string): string {
  return ICONES_CATEGORIES[cat] ?? '🏷️';
}
