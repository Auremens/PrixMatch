'use client';
// components/ContributionForm.tsx — Formulaire de contribution manuelle

import { useState, useEffect, useCallback, useRef } from 'react';
import { normaliserNom, calculerPrixReference, formaterPrix, UNITES } from '@/lib/utils';
import { ENSEIGNES, CATEGORIES } from '@/lib/config';
import { rechercherProduitsSimilaires } from '@/lib/matching';
import type { EntreePrix, Unite } from '@/lib/storage';

type EtatFormulaire = 'inactif' | 'chargement' | 'succes' | 'erreur';

interface Props { modeAdmin?: boolean }

export default function ContributionForm({ modeAdmin = false }: Props) {
  const [nomProduit, setNomProduit] = useState('');
  const [enseigne, setEnseigne] = useState('');
  const [prix, setPrix] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [unite, setUnite] = useState<Unite>('pièce');
  const [categorie, setCategorie] = useState('');
  const [codeEan, setCodeEan] = useState('');
  const [etat, setEtat] = useState<EtatFormulaire>('inactif');
  const [erreur, setErreur] = useState('');

  const [idSoumis, setIdSoumis] = useState<string | null>(null);
  const [modeEdition, setModeEdition] = useState(false);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [produitsExistants, setProduitsExistants] = useState<EntreePrix[]>([]);
  const [suggestionActive, setSuggestionActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/prix?statut=validé')
      .then(r => r.json())
      .then(d => setProduitsExistants(d.entrees ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (nomProduit.length >= 2) {
      setSuggestions(rechercherProduitsSimilaires(nomProduit, produitsExistants, 6));
    } else setSuggestions([]);
  }, [nomProduit, produitsExistants]);

  const prixNombre = parseFloat(prix.replace(',', '.'));
  const quantiteNombre = parseFloat(quantite.replace(',', '.'));
  const prixReference = !isNaN(prixNombre) && !isNaN(quantiteNombre)
    ? calculerPrixReference(prixNombre, quantiteNombre, unite) : null;

  const reinitialiser = () => {
    setNomProduit(''); setEnseigne(''); setPrix('');
    setQuantite('1'); setUnite('pièce'); setCategorie('');
    setCodeEan(''); setErreur('');
  };

  const soumettre = useCallback(async (idAMettreAJour?: string) => {
    if (!nomProduit.trim()) { setErreur('Le nom du produit est obligatoire'); return; }
    if (!enseigne.trim()) { setErreur('L\'enseigne est obligatoire'); return; }
    if (!prix || isNaN(prixNombre) || prixNombre <= 0) { setErreur('Prix invalide'); return; }
    if (!categorie.trim()) { setErreur('La catégorie est obligatoire'); return; }

    setEtat('chargement'); setErreur('');

    try {
      const corps = {
        produit_nom: normaliserNom(nomProduit),
        produit_nom_original: nomProduit.trim(),
        produit_categorie: categorie,
        code_ean: codeEan.trim() || null,
        enseigne: enseigne.trim(),
        prix_unitaire: prixNombre,
        prix_kg_litre: prixReference,
        unite, quantite: quantiteNombre,
        date_releve: new Date().toISOString(),
        source: 'manuel',
        ...(modeAdmin && { statut_force: 'validé' }),
      };

      const reponse = idAMettreAJour
        ? await fetch(`/api/prix/${idAMettreAJour}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
        : await fetch('/api/prix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });

      if (!reponse.ok) throw new Error();
      const data = await reponse.json();
      setIdSoumis(data.entree?.id ?? idAMettreAJour ?? null);
      setModeEdition(false);
      setEtat('succes');
    } catch {
      setEtat('erreur');
      setErreur('Une erreur est survenue. Veuillez réessayer.');
    }
  }, [nomProduit, enseigne, prix, prixNombre, quantite, quantiteNombre, unite, categorie, codeEan, prixReference, modeAdmin]);

  const annuler = useCallback(async () => {
    if (!idSoumis) return;
    await fetch(`/api/prix/${idSoumis}`, { method: 'DELETE' });
    setIdSoumis(null); setEtat('inactif'); reinitialiser();
  }, [idSoumis]);

  // ---- Succès ----
  if (etat === 'succes' && !modeEdition) {
    return (
      <div className="carte p-8 text-center space-y-4 animer-fade">
        <div className="text-4xl">✦</div>
        <h2 className="font-display font-700 text-lg text-accent">
          {modeAdmin ? 'Prix ajouté et validé' : 'Contribution envoyée'}
        </h2>
        <p className="text-secondaire text-sm">
          {modeAdmin ? 'Le prix est immédiatement visible.' : 'Visible après validation.'}
        </p>
        {!modeAdmin && idSoumis && (
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondaire flex-1 text-sm" onClick={() => { setModeEdition(true); setEtat('inactif'); }}>✎ Modifier</button>
            <button type="button" className="btn-danger flex-1 text-sm" onClick={annuler}>✕ Annuler</button>
          </div>
        )}
        <button type="button" className="btn-secondaire w-full text-sm" onClick={() => { setIdSoumis(null); setEtat('inactif'); reinitialiser(); }}>
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
          <p className="text-attente text-xs font-display">✎ Mode modification</p>
        </div>
      )}

      {/* Nom produit */}
      <div className="relative">
        <label className="label" htmlFor="nom-produit">Nom du produit *</label>
        <input ref={inputRef} id="nom-produit" type="text" className="input-base"
          placeholder="Ex : Lait demi-écrémé Lactel 1L" value={nomProduit}
          onChange={e => { setNomProduit(e.target.value); setSuggestionActive(true); }}
          onBlur={() => setTimeout(() => setSuggestionActive(false), 150)}
          autoComplete="off" />
        {suggestionActive && suggestions.length > 0 && (
          <ul className="absolute top-full left-0 right-0 z-20 bg-carte border border-bord rounded-xl mt-1 overflow-hidden shadow-xl">
            {suggestions.map(s => (
              <li key={s}>
                <button type="button" className="w-full text-left px-4 py-3 text-sm font-display text-texte hover:bg-accent/10 hover:text-accent transition-colors"
                  onMouseDown={() => { setNomProduit(s); setSuggestionActive(false); }}>{s}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Enseigne — select + champ texte libre */}
      <div>
        <label className="label" htmlFor="enseigne">Enseigne *</label>
        <div className="relative">
          <select id="enseigne" className="select-base pr-10"
            value={ENSEIGNES.includes(enseigne) ? enseigne : enseigne ? '__libre__' : ''}
            onChange={e => {
              if (e.target.value === '__libre__') setEnseigne('');
              else setEnseigne(e.target.value);
            }}>
            <option value="">Sélectionner une enseigne</option>
            {ENSEIGNES.map(e => <option key={e} value={e}>{e}</option>)}
            <option value="__libre__">✏️ Saisir manuellement…</option>
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiaire pointer-events-none">▾</span>
        </div>
        {(!ENSEIGNES.includes(enseigne) || enseigne === '') && (
          <input type="text" className="input-base mt-2"
            placeholder="Nom de l'enseigne"
            value={ENSEIGNES.includes(enseigne) ? '' : enseigne}
            onChange={e => setEnseigne(e.target.value)} />
        )}
      </div>

      {/* Prix + Quantité + Unité */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor="prix">Prix (€) *</label>
          <input id="prix" type="text" inputMode="decimal" className="input-base font-mono"
            placeholder="1,99" value={prix} onChange={e => setPrix(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="quantite">Qté *</label>
          <input id="quantite" type="text" inputMode="decimal" className="input-base font-mono"
            placeholder="1" value={quantite} onChange={e => setQuantite(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="unite">Unité *</label>
          <div className="relative">
            <select id="unite" className="select-base pr-8 text-xs" value={unite}
              onChange={e => setUnite(e.target.value as Unite)}>
              {UNITES.map(u => <option key={u.valeur} value={u.valeur}>{u.libelle}</option>)}
            </select>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-tertiaire pointer-events-none text-xs">▾</span>
          </div>
        </div>
      </div>

      {/* Prix/kg calculé */}
      {prixReference !== null && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-display text-accent uppercase tracking-wider">Prix ramené</span>
          <span className="font-mono text-accent font-500">
            {formaterPrix(prixReference)}/{['kg', 'g'].includes(unite) ? 'kg' : 'L'}
          </span>
        </div>
      )}

      {/* Catégorie — select + champ texte libre */}
      <div>
        <label className="label" htmlFor="categorie">Catégorie *</label>
        <div className="relative">
          <select id="categorie" className="select-base pr-10"
            value={CATEGORIES.includes(categorie) ? categorie : categorie ? '__libre__' : ''}
            onChange={e => {
              if (e.target.value === '__libre__') setCategorie('');
              else setCategorie(e.target.value);
            }}>
            <option value="">Sélectionner une catégorie</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            <option value="__libre__">✏️ Saisir manuellement…</option>
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiaire pointer-events-none">▾</span>
        </div>
        {(!CATEGORIES.includes(categorie) || categorie === '') && (
          <input type="text" className="input-base mt-2"
            placeholder="Nom de la catégorie (ex : surgelés, bio…)"
            value={CATEGORIES.includes(categorie) ? '' : categorie}
            onChange={e => setCategorie(e.target.value)} />
        )}
      </div>

      {/* EAN */}
      <div>
        <label className="label" htmlFor="ean">Code EAN <span className="text-tertiaire normal-case">(optionnel)</span></label>
        <input id="ean" type="text" inputMode="numeric" className="input-base font-mono text-sm"
          placeholder="Ex : 3017620422003" value={codeEan}
          onChange={e => setCodeEan(e.target.value)} maxLength={14} />
      </div>

      {erreur && <p className="text-erreur text-sm font-display">{erreur}</p>}

      <div className="flex gap-3">
        {modeEdition && (
          <button type="button" className="btn-secondaire flex-1"
            onClick={() => { setModeEdition(false); setEtat('succes'); }}>Annuler</button>
        )}
        <button type="button" className="btn-primaire flex-1 mt-2"
          onClick={() => soumettre(modeEdition ? idSoumis ?? undefined : undefined)}
          disabled={etat === 'chargement'}>
          {etat === 'chargement' ? '⟳ Envoi…'
            : modeEdition ? 'Enregistrer'
            : modeAdmin ? 'Ajouter (validé)' : 'Envoyer ma contribution'}
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
