'use client';
// components/ContributionForm.tsx — Formulaire de contribution manuelle
// Après soumission : boutons Modifier et Annuler disponibles pendant 10 minutes

import { useState, useEffect, useCallback, useRef } from 'react';
import { normaliserNom, calculerPrixReference, formaterPrix, ENSEIGNES_PREDEFINIES, ENSEIGNE_AUTRE, CATEGORIES, UNITES } from '@/lib/utils';
import { rechercherProduitsSimilaires } from '@/lib/matching';
import type { EntreePrix, Enseigne, Categorie, Unite } from '@/lib/storage';

type EtatFormulaire = 'inactif' | 'chargement' | 'succes' | 'erreur';

interface PropsContributionForm {
  modeAdmin?: boolean; // Si true, la contribution est validée directement
}

export default function ContributionForm({ modeAdmin = false }: PropsContributionForm) {
  const [nomProduit, setNomProduit] = useState('');
  const [enseigne, setEnseigne] = useState<string>('');
  const [enseignePersonnalisee, setEnseignePersonnalisee] = useState('');
  const [prix, setPrix] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [unite, setUnite] = useState<Unite>('pièce');
  const [categorie, setCategorie] = useState<Categorie | ''>('');
  const [codeEan, setCodeEan] = useState('');
  const [etat, setEtat] = useState<EtatFormulaire>('inactif');
  const [erreurMessage, setErreurMessage] = useState('');

  // Après soumission
  const [idSoumis, setIdSoumis] = useState<string | null>(null);
  const [modeEdition, setModeEdition] = useState(false);

  // Autocomplétion
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [produitsExistants, setProduitsExistants] = useState<EntreePrix[]>([]);
  const [suggestionActive, setSuggestionActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/prix?statut=validé')
      .then((r) => r.json())
      .then((data) => setProduitsExistants(data.entrees ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (nomProduit.length >= 2) {
      setSuggestions(rechercherProduitsSimilaires(nomProduit, produitsExistants, 6));
    } else {
      setSuggestions([]);
    }
  }, [nomProduit, produitsExistants]);

  const prixNombre = parseFloat(prix.replace(',', '.'));
  const quantiteNombre = parseFloat(quantite.replace(',', '.'));
  const prixReference = !isNaN(prixNombre) && !isNaN(quantiteNombre)
    ? calculerPrixReference(prixNombre, quantiteNombre, unite)
    : null;

  const reinitialiser = () => {
    setNomProduit(''); setEnseigne(''); setPrix('');
    setQuantite('1'); setUnite('pièce'); setCategorie('');
    setCodeEan(''); setErreurMessage('');
  };

  const soumettre = useCallback(async (idAMettreAJour?: string) => {
    // Résoudre l'enseigne finale (prédéfinie ou personnalisée)
    const enseigneFinale = enseigne === ENSEIGNE_AUTRE ? enseignePersonnalisee.trim() : enseigne;

    if (!nomProduit.trim()) { setErreurMessage('Le nom du produit est obligatoire'); return; }
    if (!enseigneFinale) { setErreurMessage('Veuillez sélectionner ou saisir une enseigne'); return; }
    if (!prix || isNaN(prixNombre) || prixNombre <= 0) { setErreurMessage('Prix invalide'); return; }
    if (!categorie) { setErreurMessage('Veuillez sélectionner une catégorie'); return; }

    setEtat('chargement');
    setErreurMessage('');

    try {
      const corps = {
        produit_nom: normaliserNom(nomProduit),
        produit_nom_original: nomProduit.trim(),
        produit_categorie: categorie,
        code_ean: codeEan.trim() || null,
        enseigne: enseigneFinale,
        prix_unitaire: prixNombre,
        prix_kg_litre: prixReference,
        unite,
        quantite: quantiteNombre,
        date_releve: new Date().toISOString(),
        source: 'manuel',
        ...(modeAdmin && { statut_force: 'validé' }),
      };

      let reponse;
      if (idAMettreAJour) {
        // Modification d'une contribution existante
        reponse = await fetch(`/api/prix/${idAMettreAJour}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(corps),
        });
      } else {
        reponse = await fetch('/api/prix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(corps),
        });
      }

      if (!reponse.ok) throw new Error('Erreur serveur');

      const data = await reponse.json();
      const id = data.entree?.id ?? idAMettreAJour;
      setIdSoumis(id);
      setModeEdition(false);
      setEtat('succes');
    } catch {
      setEtat('erreur');
      setErreurMessage('Une erreur est survenue. Veuillez réessayer.');
    }
  }, [nomProduit, enseigne, prix, prixNombre, quantite, quantiteNombre, unite, categorie, codeEan, prixReference, modeAdmin]);

  // Annuler une contribution soumise
  const annuler = useCallback(async () => {
    if (!idSoumis) return;
    try {
      await fetch(`/api/prix/${idSoumis}`, { method: 'DELETE' });
      setIdSoumis(null);
      setEtat('inactif');
      reinitialiser();
    } catch {
      setErreurMessage('Impossible d\'annuler la contribution.');
    }
  }, [idSoumis]);

  // Passer en mode édition
  const passerEnEdition = () => {
    setModeEdition(true);
    setEtat('inactif');
  };

  // ---- Écran de succès ----
  if (etat === 'succes' && !modeEdition) {
    return (
      <div className="carte p-8 text-center animer-fade space-y-4">
        <div className="text-4xl">✦</div>
        <h2 className="font-display font-700 text-lg text-accent">
          {modeAdmin ? 'Prix ajouté et validé' : 'Contribution envoyée'}
        </h2>
        <p className="text-secondaire text-sm">
          {modeAdmin
            ? 'Le prix est immédiatement visible dans l\'application.'
            : 'Merci ! Votre contribution sera visible après validation.'}
        </p>

        {/* Boutons modifier / annuler (non admin uniquement) */}
        {!modeAdmin && idSoumis && (
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondaire flex-1 text-sm" onClick={passerEnEdition}>
              ✎ Modifier
            </button>
            <button type="button" className="btn-danger flex-1 text-sm" onClick={annuler}>
              ✕ Annuler
            </button>
          </div>
        )}

        <button
          type="button"
          className="btn-secondaire w-full text-sm"
          onClick={() => {
            setIdSoumis(null);
            setEtat('inactif');
            reinitialiser();
          }}
        >
          Ajouter un autre prix
        </button>
      </div>
    );
  }

  // ---- Formulaire ----
  return (
    <div className="carte p-4 space-y-4">
      {modeEdition && (
        <div className="bg-attente/10 border border-attente/30 rounded-xl px-3 py-2">
          <p className="text-attente text-xs font-display">✎ Mode modification — vos changements remplaceront la contribution précédente</p>
        </div>
      )}

      {/* Nom produit */}
      <div className="relative">
        <label className="label" htmlFor="nom-produit">Nom du produit *</label>
        <input
          ref={inputRef}
          id="nom-produit"
          type="text"
          className="input-base"
          placeholder="Ex : Lait demi-écrémé Lactel 1L"
          value={nomProduit}
          onChange={(e) => { setNomProduit(e.target.value); setSuggestionActive(true); }}
          onBlur={() => setTimeout(() => setSuggestionActive(false), 150)}
          autoComplete="off"
        />
        {suggestionActive && suggestions.length > 0 && (
          <ul className="absolute top-full left-0 right-0 z-20 bg-carte border border-bord rounded-xl mt-1 overflow-hidden shadow-xl">
            {suggestions.map((s) => (
              <li key={s}>
                <button type="button" className="w-full text-left px-4 py-3 text-sm font-display text-texte hover:bg-accent/10 hover:text-accent transition-colors"
                  onMouseDown={() => { setNomProduit(s); setSuggestionActive(false); }}>
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Enseigne */}
      <div>
        <label className="label" htmlFor="enseigne">Enseigne *</label>
        <div className="relative">
          <select id="enseigne" className="select-base pr-10" value={enseigne} onChange={(e) => setEnseigne(e.target.value)}>
            <option value="">Sélectionner une enseigne</option>
            {ENSEIGNES_PREDEFINIES.map((e) => <option key={e} value={e}>{e}</option>)}
            <option value={ENSEIGNE_AUTRE}>+ Ajouter une enseigne…</option>
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiaire pointer-events-none">▾</span>
        </div>
        {enseigne === ENSEIGNE_AUTRE && (
          <input
            type="text"
            className="input-base mt-2"
            placeholder="Nom de l'enseigne (ex : Netto, Coopérative…)"
            value={enseignePersonnalisee}
            onChange={(e) => setEnseignePersonnalisee(e.target.value)}
            autoFocus
          />
        )}
      </div>

      {/* Prix + Quantité + Unité */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor="prix">Prix (€) *</label>
          <input id="prix" type="text" inputMode="decimal" className="input-base font-mono" placeholder="1,99" value={prix} onChange={(e) => setPrix(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="quantite">Qté *</label>
          <input id="quantite" type="text" inputMode="decimal" className="input-base font-mono" placeholder="1" value={quantite} onChange={(e) => setQuantite(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="unite">Unité *</label>
          <div className="relative">
            <select id="unite" className="select-base pr-8 text-xs" value={unite} onChange={(e) => setUnite(e.target.value as Unite)}>
              {UNITES.map((u) => <option key={u.valeur} value={u.valeur}>{u.libelle}</option>)}
            </select>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-tertiaire pointer-events-none text-xs">▾</span>
          </div>
        </div>
      </div>

      {/* Prix/kg calculé */}
      {prixReference !== null && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-2 flex items-center justify-between animer-fade">
          <span className="text-xs font-display text-accent uppercase tracking-wider">Prix ramené</span>
          <span className="font-mono text-accent font-500">
            {formaterPrix(prixReference)}/{['kg', 'g'].includes(unite) ? 'kg' : 'L'}
          </span>
        </div>
      )}

      {/* Catégorie */}
      <div>
        <label className="label" htmlFor="categorie">Catégorie *</label>
        <div className="relative">
          <select id="categorie" className="select-base pr-10" value={categorie} onChange={(e) => setCategorie(e.target.value as Categorie)}>
            <option value="">Sélectionner une catégorie</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiaire pointer-events-none">▾</span>
        </div>
      </div>

      {/* EAN */}
      <div>
        <label className="label" htmlFor="ean">Code EAN <span className="text-tertiaire normal-case">(optionnel)</span></label>
        <input id="ean" type="text" inputMode="numeric" className="input-base font-mono text-sm" placeholder="Ex : 3017620422003" value={codeEan} onChange={(e) => setCodeEan(e.target.value)} maxLength={14} />
      </div>

      {erreurMessage && <p className="text-erreur text-sm font-display">{erreurMessage}</p>}

      <div className="flex gap-3">
        {modeEdition && (
          <button type="button" className="btn-secondaire flex-1" onClick={() => { setModeEdition(false); setEtat('succes'); }}>
            Annuler
          </button>
        )}
        <button
          type="button"
          className="btn-primaire flex-1 mt-2"
          onClick={() => soumettre(modeEdition ? idSoumis ?? undefined : undefined)}
          disabled={etat === 'chargement'}
        >
          {etat === 'chargement' ? '⟳ Envoi…' : modeEdition ? 'Enregistrer les modifications' : modeAdmin ? 'Ajouter (validé directement)' : 'Envoyer ma contribution'}
        </button>
      </div>

      {!modeAdmin && (
        <p className="text-tertiaire text-xs text-center font-display">
          Contribution anonyme · Visible après validation
        </p>
      )}
    </div>
  );
}
