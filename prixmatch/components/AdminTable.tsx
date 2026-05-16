'use client';
// components/AdminTable.tsx — Tableau de modération des contributions en attente

import { useState } from 'react';
import { formaterPrix, formaterDate } from '@/lib/utils';
import type { EntreePrix } from '@/lib/storage';

interface PropsAdminTable {
  entrees: EntreePrix[];
  onMiseAJour: () => void; // Callback après action (pour recharger)
}

export default function AdminTable({ entrees, onMiseAJour }: PropsAdminTable) {
  const [selectionnees, setSelectionnees] = useState<Set<string>>(new Set());
  const [enCours, setEnCours] = useState<Set<string>>(new Set());

  // ---- Sélection multiple ----
  const toggleSelection = (id: string) => {
    setSelectionnees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toutSelectionner = () => {
    if (selectionnees.size === entrees.length) {
      setSelectionnees(new Set());
    } else {
      setSelectionnees(new Set(entrees.map((e) => e.id)));
    }
  };

  // ---- Actions individuelles ----
  const agirSur = async (id: string, action: 'valider' | 'rejeter') => {
    setEnCours((prev) => new Set([...prev, id]));
    try {
      await fetch(`/api/admin/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      onMiseAJour();
    } finally {
      setEnCours((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // ---- Validation groupée ----
  const validerGroupees = async () => {
    if (selectionnees.size === 0) return;
    const ids = [...selectionnees];
    ids.forEach((id) => setEnCours((prev) => new Set([...prev, id])));

    try {
      await fetch('/api/admin/valider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      setSelectionnees(new Set());
      onMiseAJour();
    } finally {
      setEnCours(new Set());
    }
  };

  if (entrees.length === 0) {
    return (
      <div className="carte p-8 text-center">
        <div className="text-3xl mb-3">✓</div>
        <p className="font-display font-600 text-secondaire text-sm">
          Aucune contribution en attente
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Barre d'actions groupées */}
      {selectionnees.size > 0 && (
        <div className="sticky top-0 z-10 bg-accent/10 border border-accent/30 rounded-xl p-3 flex items-center justify-between animer-fade">
          <span className="font-display font-600 text-accent text-sm">
            {selectionnees.size} sélectionnée{selectionnees.size > 1 ? 's' : ''}
          </span>
          <button type="button" className="btn-primaire py-2 text-xs" onClick={validerGroupees}>
            Tout valider ✓
          </button>
        </div>
      )}

      {/* En-tête avec tout sélectionner */}
      <div className="flex items-center gap-3 px-1">
        <input
          type="checkbox"
          checked={selectionnees.size === entrees.length && entrees.length > 0}
          onChange={toutSelectionner}
          className="accent-accent"
          aria-label="Tout sélectionner"
        />
        <span className="text-secondaire text-xs font-display uppercase tracking-wider">
          Tout sélectionner
        </span>
      </div>

      {/* Liste des entrées */}
      {entrees.map((entree) => (
        <div
          key={entree.id}
          className={`carte p-4 transition-all ${
            selectionnees.has(entree.id) ? 'border-accent/40' : ''
          } ${enCours.has(entree.id) ? 'opacity-50' : ''}`}
        >
          <div className="flex items-start gap-3">
            {/* Checkbox */}
            <input
              type="checkbox"
              checked={selectionnees.has(entree.id)}
              onChange={() => toggleSelection(entree.id)}
              className="mt-1 accent-accent flex-shrink-0"
            />

            {/* Infos */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-[10px] font-display font-600 px-2 py-0.5 rounded-full uppercase ${
                  entree.source === 'ticket_ocr'
                    ? 'bg-attente/10 text-attente'
                    : 'bg-accent/10 text-accent'
                }`}>
                  {entree.source === 'ticket_ocr' ? '📷 OCR' : '✏️ Manuel'}
                </span>
                <span className="text-tertiaire text-[10px] font-mono">
                  {formaterDate(entree.date_releve)}
                </span>
              </div>

              <p className="font-display font-600 text-sm text-texte truncate">
                {entree.produit_nom_original}
              </p>

              <div className="flex items-center gap-3 mt-1">
                <span className="text-secondaire text-xs">{entree.enseigne}</span>
                <span className="font-mono text-accent text-sm font-500">
                  {formaterPrix(entree.prix_unitaire)}
                </span>
                <span className="text-tertiaire text-xs">
                  {entree.quantite} {entree.unite}
                </span>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button
                type="button"
                className="w-8 h-8 rounded-lg bg-succes/10 text-succes hover:bg-succes/20 transition-colors flex items-center justify-center text-sm font-700"
                onClick={() => agirSur(entree.id, 'valider')}
                disabled={enCours.has(entree.id)}
                aria-label="Valider"
              >
                ✓
              </button>
              <button
                type="button"
                className="w-8 h-8 rounded-lg bg-erreur/10 text-erreur hover:bg-erreur/20 transition-colors flex items-center justify-center text-sm font-700"
                onClick={() => agirSur(entree.id, 'rejeter')}
                disabled={enCours.has(entree.id)}
                aria-label="Rejeter"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
