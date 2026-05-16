'use client';
// app/page.tsx — Page d'accueil : barre de recherche + catégories + résultats
// Filtres : enseigne, catégorie, période

import { useState, useEffect, useCallback } from 'react';
import BottomNav from '@/components/BottomNav';
import PrixCard from '@/components/PrixCard';
import { rechercherDansEntrees } from '@/lib/matching';
import { ICONES_CATEGORIES, CATEGORIES, ENSEIGNES } from '@/lib/utils';
import type { EntreePrix, Enseigne, Categorie } from '@/lib/storage';

type Periode = '7j' | '30j' | 'tout';

export default function PageAccueil() {
  const [recherche, setRecherche] = useState('');
  const [entrees, setEntrees] = useState<EntreePrix[]>([]);
  const [chargement, setChargement] = useState(false);
  const [filtreEnseigne, setFiltreEnseigne] = useState<Enseigne | ''>('');
  const [filtreCategorie, setFiltreCategorie] = useState<Categorie | ''>('');
  const [filtrePeriode, setFiltrePeriode] = useState<Periode>('tout');
  const [afficherFiltres, setAfficherFiltres] = useState(false);

  // Charger les prix validés
  useEffect(() => {
    setChargement(true);
    fetch('/api/prix?statut=validé')
      .then((r) => r.json())
      .then((data) => setEntrees(data.entrees ?? []))
      .catch(() => setEntrees([]))
      .finally(() => setChargement(false));
  }, []);

  // Filtrage
  const entresFiltrees = useCallback(() => {
    let resultats = entrees;

    // Filtre enseigne
    if (filtreEnseigne) {
      resultats = resultats.filter((e) => e.enseigne === filtreEnseigne);
    }

    // Filtre catégorie
    if (filtreCategorie) {
      resultats = resultats.filter((e) => e.produit_categorie === filtreCategorie);
    }

    // Filtre période
    if (filtrePeriode !== 'tout') {
      const jours = filtrePeriode === '7j' ? 7 : 30;
      const limite = Date.now() - jours * 24 * 60 * 60 * 1000;
      resultats = resultats.filter((e) => new Date(e.date_releve).getTime() >= limite);
    }

    // Recherche textuelle
    if (recherche.trim().length >= 2) {
      resultats = rechercherDansEntrees(recherche, resultats);
    } else {
      // Trier par date décroissante si pas de recherche
      resultats = [...resultats].sort(
        (a, b) => new Date(b.date_releve).getTime() - new Date(a.date_releve).getTime()
      );
    }

    return resultats;
  }, [entrees, recherche, filtreEnseigne, filtreCategorie, filtrePeriode]);

  const resultats = entresFiltrees();

  // Trouver le meilleur prix (uniquement si recherche active et mêmes produits)
  const idMeilleurPrix = resultats.length > 0
    ? resultats.reduce((min, e) =>
        e.prix_unitaire < (min?.prix_unitaire ?? Infinity) ? e : min
      ).id
    : null;

  return (
    <>
      <div className="min-h-screen bg-fond">
        {/* En-tête */}
        <header className="px-4 pt-12 pb-6">
          <h1 className="font-display font-800 text-3xl text-texte tracking-tight mb-1">
            Prix<span className="text-accent">Match</span>
          </h1>
          <p className="text-secondaire text-sm font-display">
            Comparez les prix en grande surface
          </p>
        </header>

        {/* Barre de recherche */}
        <div className="px-4 mb-4">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-tertiaire text-sm" aria-hidden="true">
              ⊙
            </span>
            <input
              type="search"
              className="input-base pl-10 pr-4"
              placeholder="Rechercher un produit…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              aria-label="Rechercher un produit"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Catégories en accès rapide */}
        {!recherche && (
          <div className="px-4 mb-4 overflow-x-auto">
            <div className="flex gap-2 pb-1" role="list" aria-label="Catégories">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  role="listitem"
                  onClick={() =>
                    setFiltreCategorie(filtreCategorie === cat ? '' : cat)
                  }
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-display font-600 transition-all ${
                    filtreCategorie === cat
                      ? 'bg-accent text-black'
                      : 'bg-carte border border-bord text-secondaire hover:border-accent hover:text-accent'
                  }`}
                >
                  <span>{ICONES_CATEGORIES[cat]}</span>
                  <span className="capitalize">{cat}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filtres avancés */}
        <div className="px-4 mb-4">
          <button
            type="button"
            onClick={() => setAfficherFiltres((v) => !v)}
            className="flex items-center gap-2 text-secondaire text-xs font-display hover:text-texte transition-colors"
          >
            <span>{afficherFiltres ? '▲' : '▼'}</span>
            Filtres avancés
            {(filtreEnseigne || filtrePeriode !== 'tout') && (
              <span className="bg-accent/20 text-accent px-1.5 py-0.5 rounded-full text-[10px]">
                actifs
              </span>
            )}
          </button>

          {afficherFiltres && (
            <div className="mt-3 space-y-3 animer-entree">
              {/* Filtre enseigne */}
              <div className="relative">
                <select
                  className="select-base pr-10 text-sm"
                  value={filtreEnseigne}
                  onChange={(e) => setFiltreEnseigne(e.target.value as Enseigne)}
                  aria-label="Filtrer par enseigne"
                >
                  <option value="">Toutes les enseignes</option>
                  {ENSEIGNES.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiaire pointer-events-none">▾</span>
              </div>

              {/* Filtre période */}
              <div className="flex gap-2">
                {(['7j', '30j', 'tout'] as Periode[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setFiltrePeriode(p)}
                    className={`flex-1 py-2 rounded-xl text-xs font-display font-600 transition-all ${
                      filtrePeriode === p
                        ? 'bg-accent text-black'
                        : 'bg-carte border border-bord text-secondaire'
                    }`}
                  >
                    {p === 'tout' ? 'Tout' : `${p}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Résultats */}
        <div className="px-4 space-y-2">
          {chargement ? (
            // Skeletons de chargement
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-24 rounded-2xl" style={{ animationDelay: `${i * 0.1}s` }} />
            ))
          ) : resultats.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-3">
                {recherche ? '🔍' : '📦'}
              </p>
              <p className="font-display font-600 text-secondaire text-sm">
                {recherche
                  ? `Aucun résultat pour "${recherche}"`
                  : 'Aucun prix disponible pour le moment'}
              </p>
              {!recherche && (
                <p className="text-tertiaire text-xs mt-2">
                  Soyez le premier à contribuer !
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="text-tertiaire text-xs font-display mb-3">
                {resultats.length} résultat{resultats.length > 1 ? 's' : ''}
                {recherche && ` pour "${recherche}"`}
              </p>
              {resultats.map((entree, i) => (
                <PrixCard
                  key={entree.id}
                  entree={entree}
                  meilleurPrix={entree.id === idMeilleurPrix && recherche.length >= 2}
                  rang={i}
                />
              ))}
            </>
          )}
        </div>
      </div>

      <BottomNav />
    </>
  );
}
