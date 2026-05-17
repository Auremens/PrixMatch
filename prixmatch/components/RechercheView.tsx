'use client';
// components/RechercheView.tsx — Vue de recherche réutilisable
// En modeAdmin=true : affiche aussi les contributions en attente avec actions valider/rejeter

import { useState, useEffect, useCallback } from 'react';
import PrixCard from '@/components/PrixCard';
import { rechercherDansEntrees } from '@/lib/matching';
import { formaterPrix, formaterDate } from '@/lib/utils';
import type { EntreePrix } from '@/lib/storage';
type Periode = '7j' | '30j' | 'tout';

interface PropsRechercheView {
  modeAdmin?: boolean;
}

export default function RechercheView({ modeAdmin = false }: PropsRechercheView) {
  const [recherche, setRecherche] = useState('');
  const [entrees, setEntrees] = useState<EntreePrix[]>([]);
  const [enAttente, setEnAttente] = useState<EntreePrix[]>([]);
  const [chargement, setChargement] = useState(false);
const [filtreEnseigne, setFiltreEnseigne] = useState('');
const [filtreCategorie, setFiltreCategorie] = useState('');
const [afficherFiltres, setAfficherFiltres] = useState(false);
  const [filtrePeriode, setFiltrePeriode] = useState<'7j' | '30j' | 'tout'>('tout');
  const [actionsEnCours, setActionsEnCours] = useState<Set<string>>(new Set());

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const promesses = [fetch('/api/prix?statut=validé')];
      if (modeAdmin) promesses.push(fetch('/api/prix?statut=en_attente'));

      const reponses = await Promise.all(promesses);
      const [dataValide, dataAttente] = await Promise.all(reponses.map(r => r.json()));

      setEntrees(dataValide.entrees ?? []);
      if (modeAdmin) setEnAttente(dataAttente?.entrees ?? []);
    } catch {
      setEntrees([]);
    } finally {
      setChargement(false);
    }
  }, [modeAdmin]);

  useEffect(() => { charger(); }, [charger]);

  // Action valider/rejeter depuis la vue recherche
  const agir = useCallback(async (id: string, action: 'valider' | 'rejeter') => {
    setActionsEnCours(prev => new Set([...prev, id]));
    try {
      await fetch(`/api/admin/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      charger();
    } finally {
      setActionsEnCours(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }, [charger]);

  // Filtrage des résultats validés
  const resultats = useCallback(() => {
    let res = entrees;
    if (filtreEnseigne) res = res.filter(e => e.enseigne === filtreEnseigne);
    if (filtreCategorie) res = res.filter(e => e.produit_categorie === filtreCategorie);
    if (filtrePeriode !== 'tout') {
      const limite = Date.now() - (filtrePeriode === '7j' ? 7 : 30) * 86400000;
      res = res.filter(e => new Date(e.date_releve).getTime() >= limite);
    }
    if (recherche.trim().length >= 2) {
      res = rechercherDansEntrees(recherche, res);
    } else {
      res = [...res].sort((a, b) => new Date(b.date_releve).getTime() - new Date(a.date_releve).getTime());
    }
    return res;
  }, [entrees, recherche, filtreEnseigne, filtreCategorie, filtrePeriode])();

  // En mode admin : contributions en attente correspondant à la recherche
  const attentesFiltrees = modeAdmin && recherche.trim().length >= 2
    ? rechercherDansEntrees(recherche, enAttente)
    : modeAdmin ? enAttente : [];

  const idMeilleurPrix = resultats.length > 0
    ? resultats.reduce((min, e) => e.prix_unitaire < min.prix_unitaire ? e : min).id
    : null;

  return (
    <div>
      {/* Barre de recherche */}
      <div className="mb-4">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-tertiaire text-sm" aria-hidden="true">⊙</span>
          <input
            type="search"
            className="input-base pl-10 pr-4"
            placeholder="Rechercher un produit…"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      {/* Catégories */}
      {!recherche && (
        <div className="mb-4 overflow-x-auto">
          <div className="flex gap-2 pb-1">
            {CATEGORIES.map(cat => (
              <button key={cat} type="button"
                onClick={() => setFiltreCategorie(filtreCategorie === cat ? '' : cat)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-display font-600 transition-all ${
                  filtreCategorie === cat
                    ? 'bg-accent text-black'
                    : 'bg-carte border border-bord text-secondaire hover:border-accent hover:text-accent'
                }`}
              >
                <span>{iconeCategorie(cat)}</span>
                <span className="capitalize">{cat}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filtres avancés */}
      <div className="mb-4">
        <button type="button"
          onClick={() => setAfficherFiltres(v => !v)}
          className="flex items-center gap-2 text-secondaire text-xs font-display hover:text-texte transition-colors"
        >
          <span>{afficherFiltres ? '▲' : '▼'}</span>
          Filtres avancés
          {(filtreEnseigne || filtrePeriode !== 'tout') && (
            <span className="bg-accent/20 text-accent px-1.5 py-0.5 rounded-full text-[10px]">actifs</span>
          )}
        </button>

        {afficherFiltres && (
          <div className="mt-3 space-y-3 animer-entree">
            <div className="relative">
              <select className="select-base pr-10 text-sm" value={filtreEnseigne}
                onChange={e => setFiltreEnseigne(e.target.value as Enseigne)}>
                <option value="">Toutes les enseignes</option>
onChange={e => setFiltreEnseigne(e.target.value)}>              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiaire pointer-events-none">▾</span>
            </div>
            <div className="flex gap-2">
              {(['7j', '30j', 'tout'] as Periode[]).map(p => (
                <button key={p} type="button" onClick={() => setFiltrePeriode(p)}
                  className={`flex-1 py-2 rounded-xl text-xs font-display font-600 transition-all ${
                    filtrePeriode === p ? 'bg-accent text-black' : 'bg-carte border border-bord text-secondaire'
                  }`}>
                  {p === 'tout' ? 'Tout' : p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section contributions en attente (admin uniquement) */}
      {modeAdmin && attentesFiltrees.length > 0 && (
        <div className="mb-6">
          <h3 className="font-display font-700 text-xs uppercase tracking-wider text-attente mb-3">
            ⏳ {attentesFiltrees.length} en attente de validation
          </h3>
          <div className="space-y-2">
            {attentesFiltrees.map(entree => (
              <div key={entree.id} className="carte p-4 border-attente/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge-statut-attente">En attente</span>
                      <span className="text-[10px] text-tertiaire font-display">
                        {entree.source === 'ticket_ocr' ? '📷 OCR' : '✏️ Manuel'}
                      </span>
                    </div>
                    <p className="font-display font-600 text-sm text-texte truncate">
                      {entree.produit_nom_original}
                    </p>
                    <p className="text-secondaire text-xs mt-0.5">
                      {entree.enseigne} · {entree.quantite} {entree.unite} · {formaterDate(entree.date_releve)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono text-accent font-500 text-lg">
                      {formaterPrix(entree.prix_unitaire)}
                    </p>
                    <div className="flex gap-1.5 mt-2">
                      <button type="button"
                        onClick={() => agir(entree.id, 'valider')}
                        disabled={actionsEnCours.has(entree.id)}
                        className="w-8 h-8 rounded-lg bg-succes/10 text-succes hover:bg-succes/20 transition-colors flex items-center justify-center text-sm font-700"
                        aria-label="Valider">✓</button>
                      <button type="button"
                        onClick={() => agir(entree.id, 'rejeter')}
                        disabled={actionsEnCours.has(entree.id)}
                        className="w-8 h-8 rounded-lg bg-erreur/10 text-erreur hover:bg-erreur/20 transition-colors flex items-center justify-center text-sm font-700"
                        aria-label="Rejeter">✕</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Résultats validés */}
      <div className="space-y-2">
        {chargement ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" style={{ animationDelay: `${i * 0.1}s` }} />
          ))
        ) : resultats.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">{recherche ? '🔍' : '📦'}</p>
            <p className="font-display font-600 text-secondaire text-sm">
              {recherche ? `Aucun résultat pour "${recherche}"` : 'Aucun prix disponible pour le moment'}
            </p>
            {!recherche && <p className="text-tertiaire text-xs mt-2">Soyez le premier à contribuer !</p>}
          </div>
        ) : (
          <>
            <p className="text-tertiaire text-xs font-display mb-3">
              {resultats.length} résultat{resultats.length > 1 ? 's' : ''}
              {recherche && ` pour "${recherche}"`}
            </p>
            {resultats.map((entree, i) => (
              <PrixCard key={entree.id} entree={entree}
                meilleurPrix={entree.id === idMeilleurPrix && recherche.length >= 2}
                rang={i} onMiseAJour={charger} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
