// app/produit/[id]/page.tsx — Fiche produit avec tableau de comparaison par enseigne

import { notFound } from 'next/navigation';
import { storage } from '@/lib/storage';
import { formaterPrix, formaterDate, libellePrixReference, calculerPrixReference } from '@/lib/utils';
import SparklineChart from '@/components/SparklineChart';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';
import type { Metadata } from 'next';
import type { EntreePrix } from '@/lib/storage';

interface Props { params: { id: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const entree = await storage.obtenir(params.id);
  if (!entree) return { title: 'Produit introuvable — PrixMatch' };
  return {
    title: `${entree.produit_nom_original} — PrixMatch`,
    description: `Comparez les prix de ${entree.produit_nom_original} dans toutes les enseignes`,
  };
}

// Grouper les entrées par enseigne, garder le relevé le plus récent de chaque
function grouperParEnseigne(entrees: EntreePrix[]): Map<string, EntreePrix> {
  const map = new Map<string, EntreePrix>();
  for (const e of entrees) {
    const existant = map.get(e.enseigne);
    if (!existant || new Date(e.date_releve) > new Date(existant.date_releve)) {
      map.set(e.enseigne, e);
    }
  }
  return map;
}

export default async function PageProduit({ params }: Props) {
  const entree = await storage.obtenir(params.id);
  if (!entree || entree.statut !== 'validé') notFound();

  // Toutes les entrées validées pour ce produit normalisé
  const toutes = await storage.lister({ statut: 'validé' });
  const historique = toutes
    .filter((e) => e.produit_nom === entree.produit_nom)
    .sort((a, b) => new Date(a.date_releve).getTime() - new Date(b.date_releve).getTime());

  // Tableau de comparaison : meilleur relevé par enseigne, trié par prix croissant
  const parEnseigne = grouperParEnseigne(historique);
  const comparaison = [...parEnseigne.values()].sort((a, b) => {
    // Comparer sur prix/kg ou litre si disponible, sinon prix unitaire
    const pA = a.prix_kg_litre ?? a.prix_unitaire;
    const pB = b.prix_kg_litre ?? b.prix_unitaire;
    return pA - pB;
  });

  const meilleur = comparaison[0];
  const donneesSparkling = historique.map(e => ({ date: e.date_releve, prix: e.prix_unitaire }));

  // Calculer l'écart entre le moins cher et le plus cher
  const plusCher = comparaison[comparaison.length - 1];
  const ecart = comparaison.length > 1
    ? ((plusCher.prix_unitaire - meilleur.prix_unitaire) / meilleur.prix_unitaire * 100).toFixed(0)
    : null;

  return (
    <>
      <div className="px-4 pt-12 pb-6">

        {/* Bouton retour */}
        <Link href="/rechercher" className="inline-flex items-center gap-2 text-secondaire text-sm font-display mb-6 hover:text-accent transition-colors">
          ← Retour
        </Link>

        {/* En-tête */}
        <div className="mb-6">
          <span className="text-[10px] font-display font-600 uppercase tracking-wider text-secondaire bg-carte border border-bord px-2 py-1 rounded-lg">
            {entree.produit_categorie}
          </span>
          <h1 className="font-display font-800 text-xl text-texte mt-3 mb-1 leading-tight">
            {entree.produit_nom_original}
          </h1>
          <p className="text-secondaire text-xs font-display">
            {comparaison.length} enseigne{comparaison.length > 1 ? 's' : ''} relevée{comparaison.length > 1 ? 's' : ''}
            {ecart && ` · jusqu'à ${ecart}% d'écart`}
          </p>
        </div>

        {/* Tableau de comparaison */}
        {comparaison.length > 0 && (
          <div className="carte overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-bord flex items-center justify-between">
              <h2 className="font-display font-700 text-sm text-texte">
                Comparaison par enseigne
              </h2>
              {entree.prix_kg_litre !== null && (
                <span className="text-tertiaire text-[10px] font-display uppercase tracking-wider">
                  Trié par {libellePrixReference(entree.unite)}
                </span>
              )}
            </div>

            {/* En-tête du tableau */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-4 py-2 border-b border-bord">
              <span className="text-[10px] font-display font-600 uppercase tracking-wider text-tertiaire">Enseigne</span>
              <span className="text-[10px] font-display font-600 uppercase tracking-wider text-tertiaire text-right">Prix</span>
              <span className="text-[10px] font-display font-600 uppercase tracking-wider text-tertiaire text-right w-16">
                {entree.prix_kg_litre !== null ? libellePrixReference(entree.unite) : 'Date'}
              </span>
            </div>

            {/* Lignes */}
            <div className="divide-y divide-bord">
              {comparaison.map((h, i) => {
                const estMeilleur = h.id === meilleur.id;
                const ecartLigne = i > 0
                  ? ((h.prix_unitaire - meilleur.prix_unitaire) / meilleur.prix_unitaire * 100).toFixed(0)
                  : null;

                return (
                  <div
                    key={h.id}
                    className={`grid grid-cols-[1fr_auto_auto] gap-x-3 px-4 py-3 items-center transition-colors ${
                      estMeilleur ? 'bg-accent/5' : ''
                    }`}
                  >
                    {/* Enseigne + rang */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] font-mono w-4 flex-shrink-0 ${
                        estMeilleur ? 'text-accent font-700' : 'text-tertiaire'
                      }`}>
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className={`font-display font-600 text-sm truncate ${
                          estMeilleur ? 'text-accent' : 'text-texte'
                        }`}>
                          {h.enseigne}
                          {estMeilleur && (
                            <span className="ml-1.5 text-[9px] bg-accent text-black px-1.5 py-0.5 rounded-full uppercase tracking-wider font-700">
                              ✦ Moins cher
                            </span>
                          )}
                        </p>
                        <p className="text-tertiaire text-[10px] font-mono">
                          {h.quantite} {h.unite} · {formaterDate(h.date_releve)}
                        </p>
                      </div>
                    </div>

                    {/* Prix unitaire */}
                    <div className="text-right">
                      <p className={`font-mono font-500 text-base ${
                        estMeilleur ? 'text-accent' : 'text-texte'
                      }`}>
                        {formaterPrix(h.prix_unitaire)}
                      </p>
                      {ecartLigne && (
                        <p className="text-erreur text-[10px] font-mono">
                          +{ecartLigne}%
                        </p>
                      )}
                    </div>

                    {/* Prix/kg ou litre */}
                    <div className="text-right w-16">
                      {h.prix_kg_litre !== null ? (
                        <p className={`font-mono text-xs ${
                          estMeilleur ? 'text-accent' : 'text-secondaire'
                        }`}>
                          {formaterPrix(h.prix_kg_litre)}
                        </p>
                      ) : (
                        <p className="text-tertiaire text-[10px] font-mono">—</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Résumé bas de tableau */}
            {comparaison.length > 1 && (
              <div className="px-4 py-3 border-t border-bord bg-carte">
                <p className="text-secondaire text-xs font-display">
                  Économie potentielle :{' '}
                  <span className="text-accent font-600">
                    {formaterPrix(plusCher.prix_unitaire - meilleur.prix_unitaire)}
                  </span>
                  {' '}entre{' '}
                  <span className="text-texte">{meilleur.enseigne}</span>
                  {' '}et{' '}
                  <span className="text-texte">{plusCher.enseigne}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Sparkline historique */}
        {donneesSparkling.length >= 2 && (
          <div className="carte p-4 mb-4">
            <h2 className="font-display font-700 text-xs uppercase tracking-wider text-secondaire mb-3">
              Historique des prix
            </h2>
            <SparklineChart donnees={donneesSparkling} largeur={280} hauteur={60} />
          </div>
        )}

        {/* Tous les relevés */}
        {historique.length > comparaison.length && (
          <div className="carte overflow-hidden">
            <div className="p-4 border-b border-bord">
              <h2 className="font-display font-700 text-sm text-texte">
                Tous les relevés ({historique.length})
              </h2>
            </div>
            <div className="divide-y divide-bord">
              {[...historique].reverse().map((h) => (
                <div key={h.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-display text-texte">{h.enseigne}</p>
                    <p className="text-xs text-tertiaire font-mono">{formaterDate(h.date_releve)}</p>
                  </div>
                  <p className="font-mono font-500 text-sm text-texte">
                    {formaterPrix(h.prix_unitaire)}
                  </p>
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
