// lib/storage.ts — Couche d'abstraction stockage
// Utilise Upstash Redis si configuré, sinon localStorage comme fallback
// L'API publique est identique dans les deux cas

import { v4 as uuidv4 } from 'uuid';

// ============================================================
// Types centraux
// ============================================================

export type Categorie = string; // Catégories prédéfinies + catégories personnalisées

export type Enseigne = string; // Enseignes prédéfinies + enseignes personnalisées

export type Unite = 'kg' | 'g' | 'litre' | 'cl' | 'ml' | 'pièce';
export type Source = 'manuel' | 'ticket_ocr';
export type Statut = 'en_attente' | 'validé' | 'rejeté';

export interface EntreePrix {
  id: string;
  produit_nom: string;
  produit_nom_original: string;
  produit_categorie: Categorie;
  code_ean: string | null;
  enseigne: Enseigne;
  prix_unitaire: number;
  prix_kg_litre: number | null;
  unite: Unite;
  quantite: number;
  date_releve: string;
  source: Source;
  statut: Statut;
  date_moderation: string | null;
}

export type NouvelleEntree = Omit<EntreePrix, 'id' | 'statut' | 'date_moderation'>;

// ============================================================
// Détection de l'environnement de stockage
// ============================================================

function estUpstashDisponible(): boolean {
  return !!(
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN
  );
}

// ============================================================
// Implémentation Upstash Redis (serveur uniquement)
// ============================================================

async function getRedis() {
  const { Redis } = await import('@upstash/redis');
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
}

async function kv_ajouter(entree: NouvelleEntree): Promise<EntreePrix> {
  const redis = await getRedis();
  const id = uuidv4();
  const nouvelle: EntreePrix = {
    ...entree,
    id,
    statut: 'en_attente',
    date_moderation: null,
  };

  await redis.set(`prix:${id}`, nouvelle);
  await redis.lpush('index:statut:en_attente', id);
  await redis.sadd(`index:enseigne:${entree.enseigne}`, id);
  await redis.sadd(`index:categorie:${entree.produit_categorie}`, id);

  return nouvelle;
}

async function kv_lister(filtres?: {
  statut?: Statut;
  enseigne?: Enseigne;
  categorie?: Categorie;
}): Promise<EntreePrix[]> {
  const redis = await getRedis();
  let ids: string[] = [];

  if (filtres?.statut === 'en_attente') {
    ids = await redis.lrange('index:statut:en_attente', 0, -1);
  } else if (filtres?.enseigne) {
    ids = await redis.smembers(`index:enseigne:${filtres.enseigne}`);
  } else if (filtres?.categorie) {
    ids = await redis.smembers(`index:categorie:${filtres.categorie}`);
  } else {
    const cles = await redis.keys('prix:*');
    ids = cles.map((c: string) => c.replace('prix:', ''));
  }

  if (ids.length === 0) return [];

  const entrees = await Promise.all(
    ids.map((id) => redis.get<EntreePrix>(`prix:${id}`))
  );

  let resultats = entrees.filter(Boolean) as EntreePrix[];

  if (filtres?.statut && filtres.statut !== 'en_attente') {
    resultats = resultats.filter((e) => e.statut === filtres.statut);
  }

  return resultats;
}

async function kv_obtenir(id: string): Promise<EntreePrix | null> {
  const redis = await getRedis();
  return redis.get<EntreePrix>(`prix:${id}`);
}

async function kv_mettre_a_jour(
  id: string,
  modifications: Partial<EntreePrix>
): Promise<EntreePrix | null> {
  const existante = await kv_obtenir(id);
  if (!existante) return null;

  const redis = await getRedis();
  const ancienStatut = existante.statut;
  const mise_a_jour: EntreePrix = { ...existante, ...modifications };

  await redis.set(`prix:${id}`, mise_a_jour);

  if (modifications.statut && modifications.statut !== ancienStatut && ancienStatut === 'en_attente') {
    await redis.lrem('index:statut:en_attente', 0, id);
  }

  return mise_a_jour;
}

async function kv_supprimer(id: string): Promise<boolean> {
  const existante = await kv_obtenir(id);
  if (!existante) return false;

  const redis = await getRedis();
  await redis.del(`prix:${id}`);
  await redis.lrem('index:statut:en_attente', 0, id);
  await redis.srem(`index:enseigne:${existante.enseigne}`, id);
  await redis.srem(`index:categorie:${existante.produit_categorie}`, id);

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
// API publique — router vers Upstash ou localStorage
// ============================================================

export const storage = {
  async ajouter(entree: NouvelleEntree): Promise<EntreePrix> {
    if (estUpstashDisponible()) return kv_ajouter(entree);
    return ls_ajouter(entree);
  },

  async lister(filtres?: {
    statut?: Statut;
    enseigne?: Enseigne;
    categorie?: Categorie;
  }): Promise<EntreePrix[]> {
    if (estUpstashDisponible()) return kv_lister(filtres);
    return ls_lister(filtres);
  },

  async obtenir(id: string): Promise<EntreePrix | null> {
    if (estUpstashDisponible()) return kv_obtenir(id);
    return ls_obtenir(id);
  },

  async mettreAJour(id: string, modifications: Partial<EntreePrix>): Promise<EntreePrix | null> {
    if (estUpstashDisponible()) return kv_mettre_a_jour(id, modifications);
    return ls_mettre_a_jour(id, modifications);
  },

  async supprimer(id: string): Promise<boolean> {
    if (estUpstashDisponible()) return kv_supprimer(id);
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
