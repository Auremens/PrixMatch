'use client';
// components/ContributionForm.tsx — Formulaire de contribution manuelle d'un prix
// Autocomplétion Fuse.js, calcul prix/kg en temps réel, soumission vers l'API

import { useState, useEffect, useCallback, useRef } from 'react';
import { normaliserNom, calculerPrixReference, formaterPrix, ENSEIGNES, CATEGORIES, UNITES } from '@/lib/utils';
import { rechercherProduitsSimilaires } from '@/lib/matching';
import type { EntreePrix, Enseigne, Categorie, Unite } from '@/lib/storage';

type EtatFormulaire = 'inactif' | 'chargement' | 'succes' | 'erreur';

export default function ContributionForm() {
  // --- État du formulaire ---
  const [nomProduit, setNomProduit] = useState('');
  const [enseigne, setEnseigne] = useState<Enseigne | ''>('');
  const [prix, setPrix] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [unite, setUnite] = useState<Unite>('pièce');
  const [categorie, setCategorie] = useState<Categorie | ''>('');
  const [codeEan, setCodeEan] = useState('');
  const [etat, setEtat] = useState<EtatFormulaire>('inactif');
  const [erreurMessage, setErreurMessage] = useState('');

  // --- Autocomplétion ---
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [produitsExistants, setProduitsExistants] = useState<EntreePrix[]>([]);
  const [suggestionActive, setSuggestionActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Charger les produits validés existants pour l'autocomplétion
  useEffect(() => {
    fetch('/api/prix?statut=validé')
      .then((r) => r.json())
      .then((data) => setProduitsExistants(data.entrees ?? []))
      .catch(() => {});
  }, []);

  // Mettre à jour les suggestions à chaque frappe
  useEffect(() => {
    if (nomProduit.length >= 2) {
      const resultats = rechercherProduitsSimilaires(nomProduit, produitsExistants, 6);
      setSuggestions(resultats);
    } else {
      setSuggestions([]);
    }
  }, [nomProduit, produitsExistants]);

  // --- Calcul prix/kg en temps réel ---
  const prixNombre = parseFloat(prix.replace(',', '.'));
  const quantiteNombre = parseFloat(quantite.replace(',', '.'));
  const prixReference = !isNaN(prixNombre) && !isNaN(quantiteNombre)
    ? calculerPrixReference(prixNombre, quantiteNombre, unite)
    : null;

  // --- Soumission ---
  const soumettre = useCallback(async () => {
    // Validation basique
    if (!nomProduit.trim()) {
      setErreurMessage('Le nom du produit est obligatoire');
      return;
    }
    if (!enseigne) {
      setErreurMessage('Veuillez sélectionner une enseigne');
      return;
    }
    if (!prix || isNaN(prixNombre) || prixNombre <= 0) {
      setErreurMessage('Prix invalide');
      return;
    }
    if (!categorie) {
      setErreurMessage('Veuillez sélectionner une catégorie');
      return;
    }

    setEtat('chargement');
    setErreurMessage('');

    try {
      const reponse = await fetch('/api/prix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produit_nom: normaliserNom(nomProduit),
          produit_nom_original: nomProduit.trim(),
          produit_categorie: categorie,
          code_ean: codeEan.trim() || null,
          enseigne,
          prix_unitaire: prixNombre,
          prix_kg_litre: prixReference,
          unite,
          quantite: quantiteNombre,
          date_releve: new Date().toISOString(),
          source: 'manuel',
        }),
      });

      if (!reponse.ok) throw new Error('Erreur serveur');

      setEtat('succes');
      // Réinitialiser le formulaire après 3 secondes
      setTimeout(() => {
        setNomProduit('');
        setEnseigne('');
        setPrix('');
        setQuantite('1');
        setUnite('pièce');
        setCategorie('');
        setCodeEan('');
        setEtat('inactif');
      }, 3000);
    } catch {
      setEtat('erreur');
      setErreurMessage('Une erreur est survenue. Veuillez réessayer.');
    }
  }, [nomProduit, enseigne, prix, prixNombre, quantite, quantiteNombre, unite, categorie, codeEan, prixReference]);

  // --- Rendu ---
  if (etat === 'succes') {
    return (
      <div className="carte p-8 text-center animer-fade">
        <div className="text-4xl mb-4">✦</div>
        <h2 className="font-display font-700 text-lg text-accent mb-2">
          Contribution envoyée
        </h2>
        <p className="text-secondaire text-sm">
          Merci ! Votre contribution sera visible après validation par notre équipe.
        </p>
      </div>
    );
  }

  return (
    <div className="carte p-4 space-y-4">
      {/* Nom du produit avec autocomplétion */}
      <div className="relative">
        <label className="label" htmlFor="nom-produit">
          Nom du produit *
        </label>
        <input
          ref={inputRef}
          id="nom-produit"
          type="text"
          className="input-base"
          placeholder="Ex : Lait demi-écrémé Lactel 1L"
          value={nomProduit}
          onChange={(e) => {
            setNomProduit(e.target.value);
            setSuggestionActive(true);
          }}
          onBlur={() => setTimeout(() => setSuggestionActive(false), 150)}
          autoComplete="off"
        />

        {/* Liste de suggestions */}
        {suggestionActive && suggestions.length > 0 && (
          <ul className="absolute top-full left-0 right-0 z-20 bg-carte border border-bord rounded-xl mt-1 overflow-hidden shadow-xl">
            {suggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  className="w-full text-left px-4 py-3 text-sm font-display text-texte hover:bg-accent/10 hover:text-accent transition-colors"
                  onMouseDown={() => {
                    setNomProduit(suggestion);
                    setSuggestionActive(false);
                  }}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Enseigne */}
      <div>
        <label className="label" htmlFor="enseigne">
          Enseigne *
        </label>
        <div className="relative">
          <select
            id="enseigne"
            className="select-base pr-10"
            value={enseigne}
            onChange={(e) => setEnseigne(e.target.value as Enseigne)}
          >
            <option value="">Sélectionner une enseigne</option>
            {ENSEIGNES.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiaire pointer-events-none">▾</span>
        </div>
      </div>

      {/* Prix + Quantité + Unité sur une ligne */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor="prix">Prix (€) *</label>
          <input
            id="prix"
            type="text"
            inputMode="decimal"
            className="input-base font-mono"
            placeholder="1,99"
            value={prix}
            onChange={(e) => setPrix(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="quantite">Qté *</label>
          <input
            id="quantite"
            type="text"
            inputMode="decimal"
            className="input-base font-mono"
            placeholder="1"
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="unite">Unité *</label>
          <div className="relative">
            <select
              id="unite"
              className="select-base pr-8 text-xs"
              value={unite}
              onChange={(e) => setUnite(e.target.value as Unite)}
            >
              {UNITES.map((u) => (
                <option key={u.valeur} value={u.valeur}>{u.libelle}</option>
              ))}
            </select>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-tertiaire pointer-events-none text-xs">▾</span>
          </div>
        </div>
      </div>

      {/* Prix/kg calculé en temps réel */}
      {prixReference !== null && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-2 flex items-center justify-between animer-fade">
          <span className="text-xs font-display text-accent uppercase tracking-wider">
            Prix ramené
          </span>
          <span className="font-mono text-accent font-500">
            {formaterPrix(prixReference)}/
            {['kg', 'g'].includes(unite) ? 'kg' : 'L'}
          </span>
        </div>
      )}

      {/* Catégorie */}
      <div>
        <label className="label" htmlFor="categorie">Catégorie *</label>
        <div className="relative">
          <select
            id="categorie"
            className="select-base pr-10"
            value={categorie}
            onChange={(e) => setCategorie(e.target.value as Categorie)}
          >
            <option value="">Sélectionner une catégorie</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiaire pointer-events-none">▾</span>
        </div>
      </div>

      {/* Code EAN (optionnel) */}
      <div>
        <label className="label" htmlFor="ean">
          Code EAN <span className="text-tertiaire normal-case">(optionnel)</span>
        </label>
        <input
          id="ean"
          type="text"
          inputMode="numeric"
          className="input-base font-mono text-sm"
          placeholder="Ex : 3017620422003"
          value={codeEan}
          onChange={(e) => setCodeEan(e.target.value)}
          maxLength={14}
        />
      </div>

      {/* Message d'erreur */}
      {erreurMessage && (
        <p className="text-erreur text-sm font-display">{erreurMessage}</p>
      )}

      {/* Bouton de soumission */}
      <button
        type="button"
        className="btn-primaire w-full mt-2"
        onClick={soumettre}
        disabled={etat === 'chargement'}
      >
        {etat === 'chargement' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin text-lg">⟳</span>
            Envoi en cours…
          </span>
        ) : (
          'Envoyer ma contribution'
        )}
      </button>

      <p className="text-tertiaire text-xs text-center font-display">
        Contribution anonyme · Visible après validation
      </p>
    </div>
  );
}
