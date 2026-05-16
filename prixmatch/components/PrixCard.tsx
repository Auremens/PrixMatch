'use client';
// components/PrixCard.tsx — Carte d'affichage d'une entrée prix
// Affiche : nom produit, enseigne, prix, prix/kg, date, badge meilleur prix

import Link from 'next/link';
import type { EntreePrix } from '@/lib/storage';
import { formaterPrix, formaterDate, libellePrixReference } from '@/lib/utils';

interface PropsPrixCard {
  entree: EntreePrix;
  meilleurPrix?: boolean;
  rang?: number;
}

// Couleurs associées aux enseignes (pour le badge enseigne)
const COULEURS_ENSEIGNES: Record<string, string> = {
  Carrefour: '#004F9F',
  'Carrefour Market': '#004F9F',
  Leclerc: '#003189',
  'Super U': '#E31E24',
  Intermarché: '#E31E24',
  Auchan: '#E40019',
  Lidl: '#0050AA',
  Aldi: '#00529B',
  Monoprix: '#E2001A',
  Franprix: '#E2001A',
  Casino: '#007A3D',
  Autre: '#555555',
};

export default function PrixCard({ entree, meilleurPrix = false, rang }: PropsPrixCard) {
  const couleurEnseigne = COULEURS_ENSEIGNES[entree.enseigne] ?? '#555';

  return (
    <Link
      href={`/produit/${entree.id}`}
      className={`
        carte block p-4 transition-all duration-150 active:scale-[0.98]
        ${meilleurPrix ? 'border-accent/40 bg-accent/5' : ''}
        animer-entree
      `}
      style={rang ? { animationDelay: `${rang * 0.05}s` } : {}}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Colonne gauche : infos produit */}
        <div className="flex-1 min-w-0">
          {/* Badges en ligne */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {meilleurPrix && (
              <span className="badge-meilleur-prix">
                ✦ Meilleur prix
              </span>
            )}
            {/* Badge enseigne coloré */}
            <span
              className="text-[10px] font-display font-700 px-2 py-0.5 rounded-full uppercase tracking-wider text-white"
              style={{ backgroundColor: couleurEnseigne }}
            >
              {entree.enseigne}
            </span>
            {/* Source OCR */}
            {entree.source === 'ticket_ocr' && (
              <span className="text-[10px] text-tertiaire font-display">
                📷 ticket
              </span>
            )}
          </div>

          {/* Nom du produit */}
          <p className="font-display font-600 text-sm text-texte leading-tight truncate">
            {entree.produit_nom_original}
          </p>

          {/* Quantité + unité */}
          <p className="text-tertiaire text-xs font-mono mt-1">
            {entree.quantite} {entree.unite}
            {' · '}
            {formaterDate(entree.date_releve)}
          </p>
        </div>

        {/* Colonne droite : prix */}
        <div className="text-right flex-shrink-0">
          <p className="prix-principal">
            {formaterPrix(entree.prix_unitaire)}
          </p>
          {entree.prix_kg_litre !== null && (
            <p className="prix-reference mt-0.5">
              {formaterPrix(entree.prix_kg_litre)}&nbsp;{libellePrixReference(entree.unite)}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
