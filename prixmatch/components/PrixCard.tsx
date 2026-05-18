'use client';
// components/PrixCard.tsx
// - Utilisateur : clic → modale légère pour proposer un nouveau prix
// - Admin : bouton ✎ → modale complète pour modifier toutes les données

import { useState } from 'react';
import type { EntreePrix, Unite } from '@/lib/storage';
import { formaterPrix, formaterDate, libellePrixReference, calculerPrixReference, UNITES, normaliserNom } from '@/lib/utils';
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
  const [modale, setModale] = useState<'user' | 'admin' | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [succes, setSucces] = useState(false);
  const [erreur, setErreur] = useState('');

  // Champs modale utilisateur (allégée)
  const [nouveauPrix, setNouveauPrix] = useState(String(entree.prix_unitaire).replace('.', ','));
  const [nouvelleEnseigne, setNouvelleEnseigne] = useState(entree.enseigne);
  const [nouvelleQuantite, setNouvelleQuantite] = useState(String(entree.quantite));
  const [nouvelleUnite, setNouvelleUnite] = useState<Unite>(entree.unite);

  // Champs modale admin (complète)
  const [nomProduit, setNomProduit] = useState(entree.produit_nom_original);
  const [enseigne, setEnseigne] = useState(entree.enseigne);
  const [prix, setPrix] = useState(String(entree.prix_unitaire).replace('.', ','));
  const [quantite, setQuantite] = useState(String(entree.quantite));
  const [unite, setUnite] = useState<Unite>(entree.unite);
  const [categorie, setCategorie] = useState(entree.produit_categorie);

  const prixNombreUser = parseFloat(nouveauPrix.replace(',', '.'));
  const qtNombreUser = parseFloat(nouvelleQuantite.replace(',', '.'));
  const prixRefUser = !isNaN(prixNombreUser) && !isNaN(qtNombreUser)
    ? calculerPrixReference(prixNombreUser, qtNombreUser, nouvelleUnite) : null;

  const prixNombreAdmin = parseFloat(prix.replace(',', '.'));
  const qtNombreAdmin = parseFloat(quantite.replace(',', '.'));
  const prixRefAdmin = !isNaN(prixNombreAdmin) && !isNaN(qtNombreAdmin)
    ? calculerPrixReference(prixNombreAdmin, qtNombreAdmin, unite) : null;

  const ouvrirUser = () => {
    setNouveauPrix(String(entree.prix_unitaire).replace('.', ','));
    setNouvelleEnseigne(entree.enseigne);
    setNouvelleQuantite(String(entree.quantite));
    setNouvelleUnite(entree.unite);
    setSucces(false); setErreur('');
    setModale('user');
  };

  const ouvrirAdmin = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setNomProduit(entree.produit_nom_original);
    setEnseigne(entree.enseigne);
    setPrix(String(entree.prix_unitaire).replace('.', ','));
    setQuantite(String(entree.quantite));
    setUnite(entree.unite);
    setCategorie(entree.produit_categorie);
    setErreur('');
    setModale('admin');
  };

  // Utilisateur — soumet une nouvelle contribution en attente
  const proposerModification = async () => {
    if (isNaN(prixNombreUser) || prixNombreUser <= 0) { setErreur('Prix invalide'); return; }
    if (!nouvelleEnseigne.trim()) { setErreur('Enseigne obligatoire'); return; }
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
          prix_unitaire: prixNombreUser,
          prix_kg_litre: prixRefUser,
          unite: nouvelleUnite,
          quantite: qtNombreUser,
          date_releve: new Date().toISOString(),
          source: 'manuel',
        }),
      });
      setSucces(true);
    } catch {
      setErreur('Erreur lors de l\'envoi');
    } finally {
      setEnCours(false);
    }
  };

  // Admin — modifie directement l'entrée existante
  const enregistrerAdmin = async () => {
    if (!nomProduit.trim() || !enseigne.trim() || isNaN(prixNombreAdmin) || prixNombreAdmin <= 0) {
      setErreur('Champs obligatoires manquants'); return;
    }
    setEnCours(true); setErreur('');
    try {
      const r = await fetch(`/api/prix/${entree.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produit_nom_original: nomProduit.trim(),
          produit_nom: normaliserNom(nomProduit),
          produit_categorie: categorie,
          enseigne: enseigne.trim(),
          prix_unitaire: prixNombreAdmin,
          prix_kg_litre: prixRefAdmin,
          unite, quantite: qtNombreAdmin,
        }),
      });
      if (!r.ok) throw new Error();
      setModale(null); onMiseAJour?.();
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
      setModale(null); onMiseAJour?.();
    } finally { setEnCours(false); }
  };

  const couleurEnseigne = COULEURS_ENSEIGNES[entree.enseigne] ?? '#555';

  return (
    <>
      {/* Carte — clic → fiche produit comparaison */}
      <div
        className={`carte block p-4 transition-all duration-150
          ${meilleurPrix ? 'border-accent/40 bg-accent/5' : ''} animer-entree`}
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
            <div className="flex items-center gap-1.5">
              <a href={`/produit/${entree.id}`}
                className="text-[10px] font-display text-tertiaire border border-bord px-2 py-1 rounded-lg hover:border-accent hover:text-accent transition-colors">
                Comparer
              </a>
              <button type="button" onClick={ouvrirUser}
                className="text-[10px] font-display text-accent border border-accent/40 px-2 py-1 rounded-lg hover:bg-accent/10 transition-colors">
                ✎ Prix
              </button>
              {modeAdmin && (
                <button type="button" onClick={ouvrirAdmin}
                  className="text-[10px] font-display font-600 text-attente border border-attente/40 px-2 py-1 rounded-lg hover:bg-attente/10 transition-colors">
                  ⚙
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---- Modale utilisateur (légère) ---- */}
      {modale === 'user' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setModale(null); }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModale(null)} />
          <div className="relative w-full bg-fond-carte border-t border-bord rounded-t-3xl"
            style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

            <div className="flex items-center justify-between px-4 py-4 border-b border-bord flex-shrink-0">
              <div>
                <h2 className="font-display font-700 text-sm text-texte">Proposer un nouveau prix</h2>
                <p className="text-tertiaire text-xs font-display mt-0.5">{entree.produit_nom_original}</p>
              </div>
              <button type="button" onClick={() => setModale(null)}
                className="w-8 h-8 rounded-xl bg-input flex items-center justify-center text-secondaire">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {succes ? (
                <div className="text-center py-6 space-y-3">
                  <div className="text-3xl">✦</div>
                  <p className="font-display font-700 text-accent">Proposition envoyée !</p>
                  <p className="text-secondaire text-sm">Elle sera visible après validation.</p>
                  <button type="button" className="btn-secondaire w-full" onClick={() => setModale(null)}>Fermer</button>
                </div>
              ) : (
                <>
                  {/* Enseigne */}
                  <div>
                    <label className="label" htmlFor="user-enseigne">Enseigne *</label>
                    <div className="relative">
                      <select id="user-enseigne" className="select-base pr-10"
                        value={ENSEIGNES.includes(nouvelleEnseigne) ? nouvelleEnseigne : '__libre__'}
                        onChange={e => { if (e.target.value !== '__libre__') setNouvelleEnseigne(e.target.value); else setNouvelleEnseigne(''); }}>
                        {ENSEIGNES.map(e => <option key={e} value={e}>{e}</option>)}
                        <option value="__libre__">✏️ Autre…</option>
                      </select>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiaire pointer-events-none">▾</span>
                    </div>
                    {!ENSEIGNES.includes(nouvelleEnseigne) && (
                      <input type="text" className="input-base mt-2" placeholder="Nom de l'enseigne"
                        value={nouvelleEnseigne} onChange={e => setNouvelleEnseigne(e.target.value)} />
                    )}
                  </div>

                  {/* Prix + Quantité + Unité */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label" htmlFor="user-prix">Prix (€) *</label>
                      <input id="user-prix" type="text" inputMode="decimal" className="input-base font-mono"
                        value={nouveauPrix} onChange={e => setNouveauPrix(e.target.value)} />
                    </div>
                    <div>
                      <label className="label" htmlFor="user-qte">Qté</label>
                      <input id="user-qte" type="text" inputMode="decimal" className="input-base font-mono"
                        value={nouvelleQuantite} onChange={e => setNouvelleQuantite(e.target.value)} />
                    </div>
                    <div>
                      <label className="label" htmlFor="user-unite">Unité</label>
                      <div className="relative">
                        <select id="user-unite" className="select-base pr-8 text-xs" value={nouvelleUnite}
                          onChange={e => setNouvelleUnite(e.target.value as Unite)}>
                          {UNITES.map(u => <option key={u.valeur} value={u.valeur}>{u.libelle}</option>)}
                        </select>
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-tertiaire pointer-events-none text-xs">▾</span>
                      </div>
                    </div>
                  </div>

                  {/* Prix/kg calculé */}
                  {prixRefUser !== null && (
                    <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-2 flex items-center justify-between">
                      <span className="text-xs font-display text-accent uppercase tracking-wider">Prix ramené</span>
                      <span className="font-mono text-accent font-500">
                        {formaterPrix(prixRefUser)}/{['kg', 'g'].includes(nouvelleUnite) ? 'kg' : 'L'}
                      </span>
                    </div>
                  )}

                  {erreur && <p className="text-erreur text-sm font-display">{erreur}</p>}

                  <p className="text-tertiaire text-xs font-display">
                    Votre proposition sera visible après validation par notre équipe.
                  </p>
                </>
              )}
            </div>

            {!succes && (
              <div className="flex gap-3 p-4 border-t border-bord flex-shrink-0">
                <button type="button" className="btn-secondaire flex-1" onClick={() => setModale(null)}>Annuler</button>
                <button type="button" className="btn-primaire flex-1" onClick={proposerModification} disabled={enCours}>
                  {enCours ? '⟳' : 'Proposer ce prix'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Modale admin (complète) ---- */}
      {modale === 'admin' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={e => { if (e.target === e.currentTarget) setModale(null); }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModale(null)} />
          <div className="relative w-full bg-fond-carte border-t border-bord rounded-t-3xl"
            style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

            <div className="flex items-center justify-between px-4 py-4 border-b border-bord flex-shrink-0">
              <h2 className="font-display font-700 text-sm text-texte">Modifier (admin)</h2>
              <button type="button" onClick={() => setModale(null)}
                className="w-8 h-8 rounded-xl bg-input flex items-center justify-center text-secondaire">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              <div>
                <label className="label">Nom du produit *</label>
                <input type="text" className="input-base" value={nomProduit} onChange={e => setNomProduit(e.target.value)} />
              </div>

              <div>
                <label className="label">Enseigne *</label>
                <div className="relative">
                  <select className="select-base pr-10"
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
                  <label className="label">Prix (€) *</label>
                  <input type="text" inputMode="decimal" className="input-base font-mono"
                    value={prix} onChange={e => setPrix(e.target.value)} />
                </div>
                <div>
                  <label className="label">Qté *</label>
                  <input type="text" inputMode="decimal" className="input-base font-mono"
                    value={quantite} onChange={e => setQuantite(e.target.value)} />
                </div>
                <div>
                  <label className="label">Unité *</label>
                  <div className="relative">
                    <select className="select-base pr-8 text-xs" value={unite}
                      onChange={e => setUnite(e.target.value as Unite)}>
                      {UNITES.map(u => <option key={u.valeur} value={u.valeur}>{u.libelle}</option>)}
                    </select>
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-tertiaire pointer-events-none text-xs">▾</span>
                  </div>
                </div>
              </div>

              {prixRefAdmin !== null && (
                <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-display text-accent uppercase tracking-wider">Prix ramené</span>
                  <span className="font-mono text-accent font-500">
                    {formaterPrix(prixRefAdmin)}/{['kg', 'g'].includes(unite) ? 'kg' : 'L'}
                  </span>
                </div>
              )}

              <div>
                <label className="label">Catégorie *</label>
                <div className="relative">
                  <select className="select-base pr-10"
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

            <div className="flex gap-3 p-4 border-t border-bord flex-shrink-0">
              <button type="button" className="btn-danger px-4 py-3 text-sm flex-shrink-0"
                onClick={supprimer} disabled={enCours}>🗑</button>
              <button type="button" className="btn-secondaire flex-1 text-sm"
                onClick={() => setModale(null)} disabled={enCours}>Annuler</button>
              <button type="button" className="btn-primaire flex-1 text-sm"
                onClick={enregistrerAdmin} disabled={enCours}>
                {enCours ? '⟳' : '✓ Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
