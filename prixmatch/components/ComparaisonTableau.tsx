'use client';
// components/ComparaisonTableau.tsx — Tableau de comparaison avec édition admin
// Vérifie si l'utilisateur est admin via l'API, affiche les boutons modifier si oui

import { useState, useEffect } from 'react';
import type { EntreePrix } from '@/lib/storage';
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

  // Vérifier si l'utilisateur est admin en testant une route protégée
  useEffect(() => {
    fetch('/api/admin/valider', { method: 'GET' })
      .then(r => { if (r.status !== 405 && r.status !== 401) setEstAdmin(true); })
      .catch(() => {});
    // 405 = Method Not Allowed (route existe, pas admin)
    // 401 = non authentifié
    // 200 ou autre = admin connecté
  }, []);

  // Vérifier l'admin via un endpoint dédié
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

  const meilleur = donnees[0];
  const plusCher = donnees[donnees.length - 1];

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
          {donnees.map((h, i) => {
            const estMeilleur = meilleur && h.id === meilleur.id;
            const ecartLigne = i > 0 && meilleur
              ? ((h.prix_unitaire - meilleur.prix_unitaire) / meilleur.prix_unitaire * 100).toFixed(0)
              : null;
            return (
              <LigneComparaison key={h.id} entree={h} rang={i} estMeilleur={!!estMeilleur} ecart={ecartLigne} />
            );
          })}
        </div>

        {donnees.length > 1 && meilleur && plusCher && (
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
        {donnees.map((h, i) => (
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

// Composant ligne du tableau lecture seule
function LigneComparaison({ entree, rang, estMeilleur, ecart }: {
  entree: EntreePrix; rang: number; estMeilleur: boolean; ecart: string | null;
}) {
  return (
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
          <p className="text-tertiaire text-[10px] font-mono">
            {entree.quantite} {entree.unite} · {formaterDate(entree.date_releve)}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className={`font-mono font-500 text-base ${estMeilleur ? 'text-accent' : 'text-texte'}`}>
          {formaterPrix(entree.prix_unitaire)}
        </p>
        {ecart && <p className="text-erreur text-[10px] font-mono">+{ecart}%</p>}
      </div>
      <div className="text-right w-16">
        {entree.prix_kg_litre !== null
          ? <p className={`font-mono text-xs ${estMeilleur ? 'text-accent' : 'text-secondaire'}`}>{formaterPrix(entree.prix_kg_litre)}</p>
          : <p className="text-tertiaire text-[10px] font-mono">—</p>}
      </div>
    </div>
  );
}
