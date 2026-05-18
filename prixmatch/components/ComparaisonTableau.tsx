'use client';
// components/ComparaisonTableau.tsx — Tableau de comparaison avec édition admin
// Vérifie si l'utilisateur est admin via l'API, affiche les boutons modifier si oui

import { useState, useEffect } from 'react';
import type { EntreePrix, Unite } from '@/lib/storage';
import { formaterPrix as fP, calculerPrixReference, UNITES, normaliserNom } from '@/lib/utils';
import { ENSEIGNES } from '@/lib/config';
import { formaterPrix, formaterDate, libellePrixReference } from '@/lib/utils';
import PrixCard from '@/components/PrixCard';

interface Props {
  comparaison: EntreePrix[];
  entreeRef: EntreePrix; // L'entrée de référence pour l'unité
  meilleurId: string;
  pluCherId: string;
}

export default function ComparaisonTableau({ comparaison, entreeRef, meilleurId, pluCherId }: Props) {
  const [estAdmin, setEstAdmin] = useState(false);
  const [donnees, setDonnees] = useState<EntreePrix[]>(comparaison);

  // Vérifier si l'utilisateur est admin
  useEffect(() => {
    fetch('/api/admin/check')
      .then(r => r.json())
      .then(d => setEstAdmin(d.admin === true))
      .catch(() => setEstAdmin(false));
  }, []);

  const recharger = async () => {
    // Recharger les données depuis l'API après une modification
    const r = await fetch(`/api/prix?statut=validé`);
    const data = await r.json();
    const produitNom = entreeRef.produit_nom;
    const nouvelles = (data.entrees as EntreePrix[])
      .filter(e => e.produit_nom === produitNom)
      .sort((a, b) => (a.prix_kg_litre ?? a.prix_unitaire) - (b.prix_kg_litre ?? b.prix_unitaire));
    setDonnees(nouvelles);
  };

  // Calculer le vrai meilleur et plus cher en comparant les prix (indépendant du tri)
  const meilleur = donnees.length > 0
    ? donnees.reduce((min, e) => (e.prix_kg_litre ?? e.prix_unitaire) < (min.prix_kg_litre ?? min.prix_unitaire) ? e : min)
    : null;
  const plusCher = donnees.length > 0
    ? donnees.reduce((max, e) => (e.prix_kg_litre ?? e.prix_unitaire) > (max.prix_kg_litre ?? max.prix_unitaire) ? e : max)
    : null;
  // Trier les données par prix croissant pour l'affichage
  const donneesTriees = [...donnees].sort((a, b) => (a.prix_kg_litre ?? a.prix_unitaire) - (b.prix_kg_litre ?? b.prix_unitaire));

  if (!estAdmin) {
    // Vue lecture seule — tableau simple
    return (
      <div className="carte overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-bord flex items-center justify-between">
          <h2 className="font-display font-700 text-sm text-texte">Comparaison par enseigne</h2>
          {entreeRef.prix_kg_litre !== null && (
            <span className="text-tertiaire text-[10px] font-display uppercase tracking-wider">
              Trié par {libellePrixReference(entreeRef.unite)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-4 py-2 border-b border-bord">
          <span className="text-[10px] font-display font-600 uppercase tracking-wider text-tertiaire">Enseigne</span>
          <span className="text-[10px] font-display font-600 uppercase tracking-wider text-tertiaire text-right">Prix</span>
          <span className="text-[10px] font-display font-600 uppercase tracking-wider text-tertiaire text-right w-16">
            {entreeRef.prix_kg_litre !== null ? libellePrixReference(entreeRef.unite) : 'Date'}
          </span>
        </div>

        <div className="divide-y divide-bord">
          {donneesTriees.map((h, i) => {
            const estMeilleur = meilleur && h.id === meilleur.id;
            const ecartLigne = i > 0 && meilleur
              ? ((h.prix_unitaire - meilleur.prix_unitaire) / meilleur.prix_unitaire * 100).toFixed(0)
              : null;
            return (
              <LigneComparaison key={h.id} entree={h} rang={i} estMeilleur={!!estMeilleur} ecart={ecartLigne} />
            );
          })}
        </div>

        {donneesTriees.length > 1 && meilleur && plusCher && (
          <div className="px-4 py-3 border-t border-bord bg-carte">
            <p className="text-secondaire text-xs font-display">
              Économie potentielle :{' '}
              <span className="text-accent font-600">{formaterPrix(plusCher.prix_unitaire - meilleur.prix_unitaire)}</span>
              {' '}entre <span className="text-texte">{meilleur.enseigne}</span>
              {' '}et <span className="text-texte">{plusCher.enseigne}</span>
            </p>
          </div>
        )}
      </div>
    );
  }

  // Vue admin — cartes avec bouton modifier
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-700 text-sm text-texte">Comparaison par enseigne</h2>
        <span className="text-[10px] text-attente font-display uppercase tracking-wider">⚙ Mode admin</span>
      </div>
      <div className="space-y-2">
        {donneesTriees.map((h, i) => (
          <PrixCard
            key={h.id}
            entree={h}
            meilleurPrix={meilleur ? h.id === meilleur.id : false}
            rang={i}
            modeAdmin={true}
            onMiseAJour={recharger}
          />
        ))}
      </div>
      {donnees.length > 1 && meilleur && plusCher && (
        <div className="carte px-4 py-3 mt-2">
          <p className="text-secondaire text-xs font-display">
            Économie potentielle :{' '}
            <span className="text-accent font-600">{formaterPrix(plusCher.prix_unitaire - meilleur.prix_unitaire)}</span>
            {' '}entre <span className="text-texte">{meilleur.enseigne}</span>
            {' '}et <span className="text-texte">{plusCher.enseigne}</span>
          </p>
        </div>
      )}
    </div>
  );
}

// Composant ligne du tableau avec bouton "Proposer un prix"
function LigneComparaison({ entree, rang, estMeilleur, ecart }: {
  entree: EntreePrix; rang: number; estMeilleur: boolean; ecart: string | null;
}) {
  const [modale, setModale] = useState(false);
  const [nouveauPrix, setNouveauPrix] = useState(String(entree.prix_unitaire).replace('.', ','));
  const [nouvelleEnseigne, setNouvelleEnseigne] = useState(entree.enseigne);
  const [nouvelleQuantite, setNouvelleQuantite] = useState(String(entree.quantite));
  const [nouvelleUnite, setNouvelleUnite] = useState<Unite>(entree.unite);
  const [enCours, setEnCours] = useState(false);
  const [succes, setSucces] = useState(false);
  const [erreur, setErreur] = useState('');

  const prixNombre = parseFloat(nouveauPrix.replace(',', '.'));
  const qtNombre = parseFloat(nouvelleQuantite.replace(',', '.'));
  const prixRef = !isNaN(prixNombre) && !isNaN(qtNombre)
    ? calculerPrixReference(prixNombre, qtNombre, nouvelleUnite) : null;

  const proposer = async () => {
    if (isNaN(prixNombre) || prixNombre <= 0) { setErreur('Prix invalide'); return; }
    setEnCours(true); setErreur('');
    try {
      await fetch('/api/prix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produit_nom: normaliserNom(entree.produit_nom_original),
          produit_nom_original: entree.produit_nom_original,
          produit_categorie: entree.produit_categorie,
          code_ean: entree.code_ean,
          enseigne: nouvelleEnseigne.trim(),
          prix_unitaire: prixNombre,
          prix_kg_litre: prixRef,
          unite: nouvelleUnite,
          quantite: qtNombre,
          date_releve: new Date().toISOString(),
          source: 'manuel',
        }),
      });
      setSucces(true);
    } catch { setErreur("Erreur lors de l'envoi"); }
    finally { setEnCours(false); }
  };

  return (
    <>
      <div className={`grid grid-cols-[1fr_auto_auto] gap-x-3 px-4 py-3 items-center ${estMeilleur ? 'bg-accent/5' : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[10px] font-mono w-4 flex-shrink-0 ${estMeilleur ? 'text-accent font-700' : 'text-tertiaire'}`}>
            {rang + 1}
          </span>
          <div className="min-w-0">
            <p className={`font-display font-600 text-sm truncate ${estMeilleur ? 'text-accent' : 'text-texte'}`}>
              {entree.enseigne}
              {estMeilleur && (
                <span className="ml-1.5 text-[9px] bg-accent text-black px-1.5 py-0.5 rounded-full uppercase tracking-wider font-700">
                  ✦ Moins cher
                </span>
              )}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-tertiaire text-[10px] font-mono">
                {entree.quantite} {entree.unite} · {formaterDate(entree.date_releve)}
              </p>
              <button type="button" onClick={() => { setModale(true); setSucces(false); }}
                className="text-[10px] font-display text-accent border border-accent/30 px-1.5 py-0.5 rounded hover:bg-accent/10 transition-colors">
                ✎ Proposer
              </button>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className={`font-mono font-500 text-base ${estMeilleur ? 'text-accent' : 'text-texte'}`}>
            {fP(entree.prix_unitaire)}
          </p>
          {ecart && <p className="text-erreur text-[10px] font-mono">+{ecart}%</p>}
        </div>
        <div className="text-right w-16">
          {entree.prix_kg_litre !== null
            ? <p className={`font-mono text-xs ${estMeilleur ? 'text-accent' : 'text-secondaire'}`}>{fP(entree.prix_kg_litre)}</p>
            : <p className="text-tertiaire text-[10px] font-mono">—</p>}
        </div>
      </div>

      {/* Modale proposition de prix */}
      {modale && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setModale(false); }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModale(false)} />
          <div className="relative w-full bg-fond-carte border-t border-bord rounded-t-3xl"
            style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-center justify-between px-4 py-4 border-b border-bord flex-shrink-0">
              <div>
                <h2 className="font-display font-700 text-sm text-texte">Proposer un nouveau prix</h2>
                <p className="text-tertiaire text-xs mt-0.5">{entree.produit_nom_original} · {entree.enseigne}</p>
              </div>
              <button type="button" onClick={() => setModale(false)}
                className="w-8 h-8 rounded-xl bg-input flex items-center justify-center text-secondaire">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {succes ? (
                <div className="text-center py-6 space-y-3">
                  <div className="text-3xl">✦</div>
                  <p className="font-display font-700 text-accent">Proposition envoyée !</p>
                  <p className="text-secondaire text-sm">Visible après validation.</p>
                  <button type="button" className="btn-secondaire w-full" onClick={() => setModale(false)}>Fermer</button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="label">Enseigne</label>
                    <div className="relative">
                      <select className="select-base pr-10"
                        value={ENSEIGNES.includes(nouvelleEnseigne) ? nouvelleEnseigne : '__libre__'}
                        onChange={e => { if (e.target.value !== '__libre__') setNouvelleEnseigne(e.target.value); else setNouvelleEnseigne(''); }}>
                        {ENSEIGNES.map(e => <option key={e} value={e}>{e}</option>)}
                        <option value="__libre__">✏️ Autre…</option>
                      </select>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiaire pointer-events-none">▾</span>
                    </div>
                    {!ENSEIGNES.includes(nouvelleEnseigne) && (
                      <input type="text" className="input-base mt-2" value={nouvelleEnseigne}
                        onChange={e => setNouvelleEnseigne(e.target.value)} placeholder="Nom de l'enseigne" />
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label">Prix (€) *</label>
                      <input type="text" inputMode="decimal" className="input-base font-mono"
                        value={nouveauPrix} onChange={e => setNouveauPrix(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Qté</label>
                      <input type="text" inputMode="decimal" className="input-base font-mono"
                        value={nouvelleQuantite} onChange={e => setNouvelleQuantite(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Unité</label>
                      <div className="relative">
                        <select className="select-base pr-8 text-xs" value={nouvelleUnite}
                          onChange={e => setNouvelleUnite(e.target.value as Unite)}>
                          {UNITES.map(u => <option key={u.valeur} value={u.valeur}>{u.libelle}</option>)}
                        </select>
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-tertiaire pointer-events-none text-xs">▾</span>
                      </div>
                    </div>
                  </div>
                  {prixRef !== null && (
                    <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-2 flex items-center justify-between">
                      <span className="text-xs font-display text-accent uppercase tracking-wider">Prix ramené</span>
                      <span className="font-mono text-accent font-500">{fP(prixRef)}/{['kg','g'].includes(nouvelleUnite)?'kg':'L'}</span>
                    </div>
                  )}
                  {erreur && <p className="text-erreur text-sm font-display">{erreur}</p>}
                  <p className="text-tertiaire text-xs font-display">Visible après validation par notre équipe.</p>
                </>
              )}
            </div>
            {!succes && (
              <div className="flex gap-3 p-4 border-t border-bord flex-shrink-0">
                <button type="button" className="btn-secondaire flex-1" onClick={() => setModale(false)}>Annuler</button>
                <button type="button" className="btn-primaire flex-1" onClick={proposer} disabled={enCours}>
                  {enCours ? '⟳' : 'Proposer ce prix'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
