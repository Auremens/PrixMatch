// app/produit/[id]/page.tsx — Fiche produit avec historique des prix (sparkline)

import { notFound } from 'next/navigation';
import { storage } from '@/lib/storage';
import { formaterPrix, formaterDate, libellePrixReference } from '@/lib/utils';
import SparklineChart from '@/components/SparklineChart';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';
import type { Metadata } from 'next';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const entree = await storage.obtenir(params.id);
  if (!entree) return { title: 'Produit introuvable — PrixMatch' };
  return {
    title: `${entree.produit_nom_original} — PrixMatch`,
    description: `Prix de ${entree.produit_nom_original} chez ${entree.enseigne}`,
  };
}

export default async function PageProduit({ params }: Props) {
  const entree = await storage.obtenir(params.id);

  if (!entree || entree.statut !== 'validé') {
    notFound();
  }

  // Charger l'historique : toutes les entrées validées pour ce produit normalisé
  const toutes = await storage.lister({ statut: 'validé' });
  const historique = toutes
    .filter((e) => e.produit_nom === entree.produit_nom)
    .sort((a, b) => new Date(a.date_releve).getTime() - new Date(b.date_releve).getTime());

  // Données sparkline
  const donneesSparkling = historique.map((e) => ({
    date: e.date_releve,
    prix: e.prix_unitaire,
  }));

  // Trouver le meilleur prix parmi les entrées similaires
  const meilleurPrix = historique.reduce(
    (min, e) => e.prix_unitaire < min.prix_unitaire ? e : min,
    historique[0]
  );

  return (
    <>
      <div className="px-4 pt-12 pb-6">
        {/* Bouton retour */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-secondaire text-sm font-display mb-6 hover:text-accent transition-colors"
        >
          ← Retour
        </Link>

        {/* En-tête produit */}
        <div className="mb-6">
          <span className="text-[10px] font-display font-600 uppercase tracking-wider text-secondaire bg-carte border border-bord px-2 py-1 rounded-lg">
            {entree.produit_categorie}
          </span>

          <h1 className="font-display font-800 text-xl text-texte mt-3 mb-2 leading-tight">
            {entree.produit_nom_original}
          </h1>

          <div className="flex items-baseline gap-3">
            <span className="prix-principal text-3xl">
              {formaterPrix(entree.prix_unitaire)}
            </span>
            {entree.prix_kg_litre !== null && (
              <span className="prix-reference">
                soit {formaterPrix(entree.prix_kg_litre)}&nbsp;{libellePrixReference(entree.unite)}
              </span>
            )}
          </div>

          <p className="text-secondaire text-sm mt-1">
            {entree.enseigne} · {entree.quantite} {entree.unite}
          </p>
          <p className="text-tertiaire text-xs mt-0.5">
            Relevé le {formaterDate(entree.date_releve)}
            {entree.source === 'ticket_ocr' && ' · via ticket scanné'}
          </p>
        </div>

        {/* Badge meilleur prix */}
        {entree.id === meilleurPrix.id && historique.length > 1 && (
          <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 mb-4 flex items-center gap-2">
            <span className="text-accent text-lg">✦</span>
            <span className="text-accent text-sm font-display font-600">
              Meilleur prix observé pour ce produit
            </span>
          </div>
        )}

        {/* Historique sparkline */}
        {donneesSparkling.length >= 2 && (
          <div className="carte p-4 mb-4">
            <h2 className="font-display font-700 text-xs uppercase tracking-wider text-secondaire mb-3">
              Historique des prix
            </h2>
            <SparklineChart donnees={donneesSparkling} largeur={280} hauteur={60} />
          </div>
        )}

        {/* Autres relevés pour ce produit */}
        {historique.length > 1 && (
          <div className="carte overflow-hidden">
            <div className="p-4 border-b border-bord">
              <h2 className="font-display font-700 text-sm text-texte">
                Tous les relevés ({historique.length})
              </h2>
            </div>
            <div className="divide-y divide-bord">
              {historique.map((h) => (
                <div key={h.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-display text-texte">{h.enseigne}</p>
                    <p className="text-xs text-tertiaire font-mono">
                      {formaterDate(h.date_releve)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono font-500 text-sm ${
                      h.id === meilleurPrix.id ? 'text-accent' : 'text-texte'
                    }`}>
                      {formaterPrix(h.prix_unitaire)}
                    </p>
                    {h.id === meilleurPrix.id && (
                      <p className="text-[10px] text-accent font-display">meilleur</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </>
  );
}
