'use client';
// components/PrixCard.tsx — Carte prix
// Clic normal → fiche produit comparaison
// Bouton ✎ (admin uniquement) → modale d'édition

import { useState } from 'react';
import Link from 'next/link';
import type { EntreePrix, Unite } from '@/lib/storage';
import { formaterPrix, formaterDate, libellePrixReference, calculerPrixReference, UNITES } from '@/lib/utils';
import { ENSEIGNES, CATEGORIES } from '@/lib/config';

interface Props {
  entree: EntreePrix;
  meilleurPrix?: boolean;
  rang?: number;
  modeAdmin?: boolean;
  onMiseAJour?: () => void;
}

const COULEURS_ENSEIGNES: Record<string, string> = {
  Carrefour: '#004F9F', 'Carrefour Market': '#004F9F', Leclerc: '#003189',
  'Super U': '#E31E24', Intermarché: '#E31E24', Auchan: '#E40019',
  Lidl: '#0050AA', Aldi: '#00529B', Monoprix: '#E2001A',
  Franprix: '#E2001A', Casino: '#007A3D',
};

export default function PrixCard({ entree, meilleurPrix = false, rang, modeAdmin = false, onMiseAJour }: Props) {
  const [modale, setModale] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  const [nomProduit, setNomProduit] = useState(entree.produit_nom_original);
  const [enseigne, setEnseigne] = useState(entree.enseigne);
  const [prix, setPrix] = useState(String(entree.prix_unitaire).replace('.', ','));
  const [quantite, setQuantite] = useState(String(entree.quantite));
  const [unite, setUnite] = useState<Unite>(entree.unite);
  const [categorie, setCategorie] = useState(entree.produit_categorie);

  const prixNombre = parseFloat(prix.replace(',', '.'));
  const quantiteNombre = parseFloat(quantite.replace(',', '.'));
  const prixRef = !isNaN(prixNombre) && !isNaN(quantiteNombre)
    ? calculerPrixReference(prixNombre, quantiteNombre, unite) : null;

  const ouvrirModale = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setNomProduit(entree.produit_nom_original);
    setEnseigne(entree.enseigne);
    setPrix(String(entree.prix_unitaire).replace('.', ','));
    setQuantite(String(entree.quantite));
    setUnite(entree.unite);
    setCategorie(entree.produit_categorie);
    setErreur('');
    setModale(true);
  };

  const enregistrer = async () => {
    if (!nomProduit.trim() || !enseigne.trim() || isNaN(prixNombre) || prixNombre <= 0) {
      setErreur('Tous les champs obligatoires doivent être remplis');
      return;
    }
    setEnCours(true);
    setErreur('');
    try {
      const r = await fetch(`/api/prix/${entree.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produit_nom_original: nomProduit.trim(),
          produit_nom: nomProduit.trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim(),
          produit_categorie: categorie,
          enseigne: enseigne.trim(),
          prix_unitaire: prixNombre,
          prix_kg_litre: prixRef,
          unite,
          quantite: quantiteNombre,
        }),
      });
      if (!r.ok) throw new Error();
      setModale(false);
      onMiseAJour?.();
    } catch {
      setErreur('Erreur lors de la sauvegarde');
    } finally {
      setEnCours(false);
    }
  };

  const supprimer = async () => {
    if (!confirm(`Supprimer "${entree.produit_nom_original}" ?`)) return;
    setEnCours(true);
    try {
      await fetch(`/api/prix/${entree.id}`, { method: 'DELETE' });
      setModale(false);
      onMiseAJour?.();
    } finally {
      setEnCours(false);
    }
  };

  const couleurEnseigne = COULEURS_ENSEIGNES[entree.enseigne] ?? '#555';

  return (
    <>
      {/* Carte — clic normal vers fiche produit, bouton admin séparé */}
      <Link
        href={`/produit/${entree.id}`}
        className={`carte block p-4 transition-all duration-150 active:scale-[0.98]
          ${meilleurPrix ? 'border-accent/40 bg-accent/5' : ''}
          animer-entree`}
        style={rang ? { animationDelay: `${rang * 0.05}s` } : {}}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {meilleurPrix && <span className="badge-meilleur-prix">✦ Meilleur prix</span>}
              <span className="text-[10px] font-display font-700 px-2 py-0.5 rounded-full uppercase tracking-wider text-white"
                style={{ backgroundColor: couleurEnseigne }}>
                {entree.enseigne}
              </span>
              {entree.source === 'ticket_ocr' && (
                <span className="text-[10px] text-tertiaire font-display">📷 ticket</span>
              )}
            </div>
            <p className="font-display font-600 text-sm text-texte leading-tight truncate">
              {entree.produit_nom_original}
            </p>
            <p className="text-tertiaire text-xs font-mono mt-1">
              {entree.quantite} {entree.unite} · {formaterDate(entree.date_releve)}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <div className="text-right">
              <p className="prix-principal">{formaterPrix(entree.prix_unitaire)}</p>
              {entree.prix_kg_litre !== null && (
                <p className="prix-reference mt-0.5">
                  {formaterPrix(entree.prix_kg_litre)}&nbsp;{libellePrixReference(entree.unite)}
                </p>
              )}
            </div>

            {/* Bouton modifier visible uniquement en mode admin */}
            {modeAdmin && (
              <button
                type="button"
                onClick={ouvrirModale}
                className="text-[10px] font-display font-600 text-accent border border-accent/40 px-2 py-1 rounded-lg hover:bg-accent/10 transition-colors"
              >
                ✎ Modifier
              </button>
            )}
          </div>
        </div>
      </Link>

      {/* Modale d'édition — admin uniquement */}
      {modale && modeAdmin && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setModale(false); }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModale(false)} />

          {/* Panel avec hauteur fixe et scroll interne */}
          <div className="relative w-full bg-fond-carte border-t border-bord rounded-t-3xl"
            style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

            {/* En-tête fixe */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-bord flex-shrink-0">
              <h2 className="font-display font-700 text-sm text-texte">Modifier le prix</h2>
              <button type="button" onClick={() => setModale(false)}
                className="w-8 h-8 rounded-xl bg-input flex items-center justify-center text-secondaire hover:text-texte transition-colors">
                ✕
              </button>
            </div>

            {/* Corps scrollable */}
            <div className="overflow-y-auto flex-1 p-4 space-y-4">

              <div>
                <label className="label" htmlFor="edit-nom">Nom du produit *</label>
                <input id="edit-nom" type="text" className="input-base"
                  value={nomProduit} onChange={e => setNomProduit(e.target.value)} />
              </div>

              <div>
                <label className="label" htmlFor="edit-enseigne">Enseigne *</label>
                <div className="relative">
                  <select id="edit-enseigne" className="select-base pr-10"
                    value={ENSEIGNES.includes(enseigne) ? enseigne : '__libre__'}
                    onChange={e => { if (e.target.value !== '__libre__') setEnseigne(e.target.value); else setEnseigne(''); }}>
                    {ENSEIGNES.map(e => <option key={e} value={e}>{e}</option>)}
                    <option value="__libre__">✏️ Autre…</option>
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiaire pointer-events-none">▾</span>
                </div>
                {!ENSEIGNES.includes(enseigne) && (
                  <input type="text" className="input-base mt-2" placeholder="Nom de l'enseigne"
                    value={enseigne} onChange={e => setEnseigne(e.target.value)} />
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label" htmlFor="edit-prix">Prix (€) *</label>
                  <input id="edit-prix" type="text" inputMode="decimal" className="input-base font-mono"
                    value={prix} onChange={e => setPrix(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="edit-qte">Qté *</label>
                  <input id="edit-qte" type="text" inputMode="decimal" className="input-base font-mono"
                    value={quantite} onChange={e => setQuantite(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="edit-unite">Unité *</label>
                  <div className="relative">
                    <select id="edit-unite" className="select-base pr-8 text-xs" value={unite}
                      onChange={e => setUnite(e.target.value as Unite)}>
                      {UNITES.map(u => <option key={u.valeur} value={u.valeur}>{u.libelle}</option>)}
                    </select>
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-tertiaire pointer-events-none text-xs">▾</span>
                  </div>
                </div>
              </div>

              {prixRef !== null && (
                <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-display text-accent uppercase tracking-wider">Prix ramené</span>
                  <span className="font-mono text-accent font-500">
                    {formaterPrix(prixRef)}/{['kg', 'g'].includes(unite) ? 'kg' : 'L'}
                  </span>
                </div>
              )}

              <div>
                <label className="label" htmlFor="edit-cat">Catégorie *</label>
                <div className="relative">
                  <select id="edit-cat" className="select-base pr-10"
                    value={CATEGORIES.includes(categorie) ? categorie : '__libre__'}
                    onChange={e => { if (e.target.value !== '__libre__') setCategorie(e.target.value); else setCategorie(''); }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                    <option value="__libre__">✏️ Autre…</option>
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiaire pointer-events-none">▾</span>
                </div>
                {!CATEGORIES.includes(categorie) && (
                  <input type="text" className="input-base mt-2" placeholder="Nom de la catégorie"
                    value={categorie} onChange={e => setCategorie(e.target.value)} />
                )}
              </div>

              {erreur && <p className="text-erreur text-sm font-display">{erreur}</p>}
            </div>

            {/* Boutons fixes en bas */}
            <div className="flex gap-3 p-4 border-t border-bord flex-shrink-0">
              <button type="button" className="btn-danger px-4 py-3 text-sm flex-shrink-0"
                onClick={supprimer} disabled={enCours}>
                🗑
              </button>
              <button type="button" className="btn-secondaire flex-1 text-sm"
                onClick={() => setModale(false)} disabled={enCours}>
                Annuler
              </button>
              <button type="button" className="btn-primaire flex-1 text-sm"
                onClick={enregistrer} disabled={enCours}>
                {enCours ? '⟳' : '✓ Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
