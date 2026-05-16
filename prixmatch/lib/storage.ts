// lib/storage.ts — Couche d'abstraction stockage
// Utilise Vercel KV (Redis) si configuré, sinon localStorage comme fallback
// L'API publique est identique dans les deux cas

import { v4 as uuidv4 } from 'uuid';

// ============================================================
// Types centraux
// ============================================================

export type Categorie =
  | 'alimentaire'
  | 'boissons'
  | 'hygiène'
  | 'entretien'
  | 'bébé'
  | 'animaux'
  | 'autre';

export type Enseigne =
  | 'Carrefour'
  | 'Carrefour Market'
  | 'Super U'
  | 'Leclerc'
  | 'Intermarché'
  | 'Auchan'
  | 'Lidl'
  | 'Aldi'
  | 'Monoprix'
  | 'Franprix'
  | 'Casino'
  | 'Autre';

export type Unite = 'kg' | 'g' | 'litre' | 'cl' | 'ml' | 'pièce';
export type Source = 'manuel' | 'ticket_ocr';
export type Statut = 'en_attente' | 'validé' | 'rejeté';

export interface EntreePrix {
  id: string;
  produit_nom: string;           // Nom normalisé (lowercase, sans accents)
  produit_nom_original: string;  // Nom brut tel que saisi
  produit_categorie: Categorie;
  code_ean: string | null;
  enseigne: Enseigne;
  prix_unitaire: number;
  prix_kg_litre: number | null;
  unite: Unite;
  quantite: number;
  date_releve: string;           // ISO 8601
  source: Source;
  statut: Statut;
  date_moderation: string | null;
}

export type NouvelleEntree = Omit<EntreePrix, 'id' | 'statut' | 'date_moderation'>;

// ============================================================
// Détection de l'environnement de stockage
// ============================================================

function estVercelKVDisponible(): boolean {
  return !!(
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN
  );
}

// ============================================================
// Implémentation Vercel KV (serveur uniquement)
// ============================================================

async function kv_ajouter(entree: NouvelleEntree): Promise<EntreePrix> {
  const { kv } = await import('@vercel/kv');
  const id = uuidv4();
  const nouvelle: EntreePrix = {
    ...entree,
    id,
    statut: 'en_attente',
    date_moderation: null,
  };

  // Stocker l'entrée principale
  await kv.set(`prix:${id}`, JSON.stringify(nouvelle));

  // Mettre à jour les index
  await kv.lpush('index:statut:en_attente', id);
  await kv.sadd(`index:enseigne:${entree.enseigne}`, id);
  await kv.sadd(`index:categorie:${entree.produit_categorie}`, id);

  return nouvelle;
}

async function kv_lister(filtres?: {
  statut?: Statut;
  enseigne?: Enseigne;
  categorie?: Categorie;
}): Promise<EntreePrix[]> {
  const { kv } = await import('@vercel/kv');
  let ids: string[] = [];

  if (filtres?.statut === 'en_attente') {
    // Utiliser l'index de la file de modération
    ids = (await kv.lrange('index:statut:en_attente', 0, -1)) as string[];
  } else if (filtres?.enseigne) {
    ids = (await kv.smembers(`index:enseigne:${filtres.enseigne}`)) as string[];
  } else if (filtres?.categorie) {
    ids = (await kv.smembers(`index:categorie:${filtres.categorie}`)) as string[];
  } else {
    // Scan complet — à éviter en production intensive
    const cles = await kv.keys('prix:*');
    ids = cles.map((c: string) => c.replace('prix:', ''));
  }

  if (ids.length === 0) return [];

  // Récupérer toutes les entrées en parallèle
  const entrees = await Promise.all(
    ids.map(async (id) => {
      const val = await kv.get(`prix:${id}`);
      if (!val) return null;
      return typeof val === 'string' ? JSON.parse(val) : val;
    })
  );

  let resultats = entrees.filter(Boolean) as EntreePrix[];

  // Filtrer par statut si demandé (hors en_attente, géré par index)
  if (filtres?.statut && filtres.statut !== 'en_attente') {
    resultats = resultats.filter((e) => e.statut === filtres.statut);
  }

  return resultats;
}

async function kv_obtenir(id: string): Promise<EntreePrix | null> {
  const { kv } = await import('@vercel/kv');
  const val = await kv.get(`prix:${id}`);
  if (!val) return null;
  return typeof val === 'string' ? JSON.parse(val) : (val as EntreePrix);
}

async function kv_mettre_a_jour(
  id: string,
  modifications: Partial<EntreePrix>
): Promise<EntreePrix | null> {
  const { kv } = await import('@vercel/kv');
  const existante = await kv_obtenir(id);
  if (!existante) return null;

  const ancienStatut = existante.statut;
  const mise_a_jour: EntreePrix = { ...existante, ...modifications };

  await kv.set(`prix:${id}`, JSON.stringify(mise_a_jour));

  // Mettre à jour l'index de statut si nécessaire
  if (modifications.statut && modifications.statut !== ancienStatut) {
    // Retirer de l'ancien index en_attente
    if (ancienStatut === 'en_attente') {
      await kv.lrem('index:statut:en_attente', 0, id);
    }
  }

  return mise_a_jour;
}

async function kv_supprimer(id: string): Promise<boolean> {
  const { kv } = await import('@vercel/kv');
  const existante = await kv_obtenir(id);
  if (!existante) return false;

  await kv.del(`prix:${id}`);
  await kv.lrem('index:statut:en_attente', 0, id);
  await kv.srem(`index:enseigne:${existante.enseigne}`, id);
  await kv.srem(`index:categorie:${existante.produit_categorie}`, id);

  return true;
}

// ============================================================
// Implémentation localStorage (client uniquement, fallback)
// ============================================================

const CLE_STORAGE = 'prixmatch_donnees';

function ls_lire(): EntreePrix[] {
  if (typeof window === 'undefined') return [];
  try {
    const donnees = localStorage.getItem(CLE_STORAGE);
    return donnees ? JSON.parse(donnees) : [];
  } catch {
    return [];
  }
}

function ls_ecrire(donnees: EntreePrix[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CLE_STORAGE, JSON.stringify(donnees));
}

function ls_ajouter(entree: NouvelleEntree): EntreePrix {
  const donnees = ls_lire();
  const nouvelle: EntreePrix = {
    ...entree,
    id: uuidv4(),
    statut: 'en_attente',
    date_moderation: null,
  };
  ls_ecrire([...donnees, nouvelle]);
  return nouvelle;
}

function ls_lister(filtres?: {
  statut?: Statut;
  enseigne?: Enseigne;
  categorie?: Categorie;
}): EntreePrix[] {
  let donnees = ls_lire();
  if (filtres?.statut) donnees = donnees.filter((e) => e.statut === filtres.statut);
  if (filtres?.enseigne) donnees = donnees.filter((e) => e.enseigne === filtres.enseigne);
  if (filtres?.categorie) donnees = donnees.filter((e) => e.produit_categorie === filtres.categorie);
  return donnees;
}

function ls_obtenir(id: string): EntreePrix | null {
  return ls_lire().find((e) => e.id === id) ?? null;
}

function ls_mettre_a_jour(id: string, modifications: Partial<EntreePrix>): EntreePrix | null {
  const donnees = ls_lire();
  const index = donnees.findIndex((e) => e.id === id);
  if (index === -1) return null;
  donnees[index] = { ...donnees[index], ...modifications };
  ls_ecrire(donnees);
  return donnees[index];
}

function ls_supprimer(id: string): boolean {
  const donnees = ls_lire();
  const nouvelles = donnees.filter((e) => e.id !== id);
  if (nouvelles.length === donnees.length) return false;
  ls_ecrire(nouvelles);
  return true;
}

// ============================================================
// API publique — router vers KV ou localStorage
// ============================================================

export const storage = {
  async ajouter(entree: NouvelleEntree): Promise<EntreePrix> {
    if (estVercelKVDisponible()) return kv_ajouter(entree);
    return ls_ajouter(entree);
  },

  async lister(filtres?: {
    statut?: Statut;
    enseigne?: Enseigne;
    categorie?: Categorie;
  }): Promise<EntreePrix[]> {
    if (estVercelKVDisponible()) return kv_lister(filtres);
    return ls_lister(filtres);
  },

  async obtenir(id: string): Promise<EntreePrix | null> {
    if (estVercelKVDisponible()) return kv_obtenir(id);
    return ls_obtenir(id);
  },

  async mettreAJour(id: string, modifications: Partial<EntreePrix>): Promise<EntreePrix | null> {
    if (estVercelKVDisponible()) return kv_mettre_a_jour(id, modifications);
    return ls_mettre_a_jour(id, modifications);
  },

  async supprimer(id: string): Promise<boolean> {
    if (estVercelKVDisponible()) return kv_supprimer(id);
    return ls_supprimer(id);
  },

  async exporterCSV(): Promise<string> {
    const toutes = await this.lister();
    const entete = [
      'id', 'produit_nom_original', 'produit_categorie', 'enseigne',
      'prix_unitaire', 'prix_kg_litre', 'unite', 'quantite',
      'date_releve', 'source', 'statut',
    ].join(';');

    const lignes = toutes.map((e) =>
      [
        e.id,
        `"${e.produit_nom_original.replace(/"/g, '""')}"`,
        e.produit_categorie,
        e.enseigne,
        e.prix_unitaire.toFixed(2).replace('.', ','),
        e.prix_kg_litre?.toFixed(2).replace('.', ',') ?? '',
        e.unite,
        e.quantite,
        e.date_releve,
        e.source,
        e.statut,
      ].join(';')
    );

    return [entete, ...lignes].join('\n');
  },
};
