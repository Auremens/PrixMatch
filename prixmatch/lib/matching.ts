// lib/matching.ts — Matching flou de noms de produits avec Fuse.js
// Permet de rapprocher "Coca-Cola 1,5L" et "coca cola 1.5 litre"

import Fuse from 'fuse.js';
import { normaliserNom } from './utils';
import type { EntreePrix } from './storage';

// ============================================================
// Construction de l'index Fuse
// ============================================================

/**
 * Crée un index Fuse.js à partir d'une liste de noms normalisés uniques.
 * Le threshold de 0.35 est un bon compromis :
 * - < 0.2 : trop strict, rate les variantes orthographiques
 * - > 0.5 : trop laxiste, retourne des faux positifs
 */
export function creerIndexFuse(noms: string[]): Fuse<{ nom: string }> {
  const items = noms.map((nom) => ({ nom }));
  return new Fuse(items, {
    keys: ['nom'],
    threshold: 0.35,
    includeScore: true,
    minMatchCharLength: 3,
  });
}

// ============================================================
// Recherche de produits similaires
// ============================================================

/**
 * Recherche les produits similaires à un nom donné dans la liste des entrées.
 * Retourne les noms normalisés uniques correspondants, triés par pertinence.
 *
 * @param nomRecherche  Nom brut saisi par l'utilisateur
 * @param entrees       Liste de toutes les entrées disponibles
 * @param nbMax         Nombre maximum de résultats (défaut: 8)
 */
export function rechercherProduitsSimilaires(
  nomRecherche: string,
  entrees: EntreePrix[],
  nbMax = 8
): string[] {
  if (!nomRecherche || nomRecherche.trim().length < 2) return [];

  // Extraire les noms normalisés uniques depuis les entrées validées
  const nomsUniques = [
    ...new Set(
      entrees
        .filter((e) => e.statut === 'validé')
        .map((e) => e.produit_nom)
    ),
  ];

  if (nomsUniques.length === 0) return [];

  const nomNormalise = normaliserNom(nomRecherche);
  const fuse = creerIndexFuse(nomsUniques);
  const resultats = fuse.search(nomNormalise, { limit: nbMax });

  return resultats.map((r) => r.item.nom);
}

// ============================================================
// Recherche plein texte (barre de recherche)
// ============================================================

/**
 * Filtre les entrées en correspondance avec une requête de recherche libre.
 * Utilisé pour la barre de recherche principale de l'app.
 *
 * @param requete   Texte de recherche
 * @param entrees   Toutes les entrées (filtrées sur statut='validé' en amont)
 */
export function rechercherDansEntrees(
  requete: string,
  entrees: EntreePrix[]
): EntreePrix[] {
  if (!requete || requete.trim().length < 2) return entrees;

  const fuse = new Fuse(entrees, {
    keys: ['produit_nom', 'produit_nom_original'],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 2,
  });

  const requeteNormalisee = normaliserNom(requete);
  return fuse.search(requeteNormalisee).map((r) => r.item);
}
