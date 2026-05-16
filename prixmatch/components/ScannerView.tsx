'use client';
// components/ScannerView.tsx — Interface de scan de ticket de caisse
// Capture photo → prétraitement canvas → Tesseract.js → tableau éditable

import { useState, useRef, useCallback } from 'react';
import { pretraiterImage, lancerOCR } from '@/lib/ocr';
import { normaliserNom, calculerPrixReference, ENSEIGNES_PREDEFINIES, ENSEIGNE_AUTRE } from '@/lib/utils';
import type { LigneTicket } from '@/lib/ocr';
import type { Enseigne, Categorie, Unite } from '@/lib/storage';

type EtatScanner =
  | 'attente'        // En attente d'une photo
  | 'pretraitement'  // Traitement de l'image
  | 'ocr'            // OCR en cours
  | 'edition'        // Tableau de correction
  | 'envoi'          // Soumission en cours
  | 'succes'         // Envoyé avec succès
  | 'erreur';

export default function ScannerView() {
  const [etat, setEtat] = useState<EtatScanner>('attente');
  const [progresOCR, setProgresOCR] = useState(0);
  const [lignes, setLignes] = useState<LigneTicket[]>([]);
  const [qualiteOCR, setQualiteOCR] = useState<'bonne' | 'mediocre'>('bonne');
  const [enseigne, setEnseigne] = useState<string>('');
  const [enseignePersonnalisee, setEnseignePersonnalisee] = useState('');
  const [erreur, setErreur] = useState('');
  const [nbValides, setNbValides] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ---- Traitement de la photo ----
  const traiterPhoto = useCallback(async (fichier: File) => {
    setEtat('pretraitement');
    setErreur('');
    setProgresOCR(0);

    try {
      // Étape 1 : prétraitement canvas
      const imagePretraitee = await pretraiterImage(fichier);

      // Étape 2 : OCR
      setEtat('ocr');
      const resultat = await lancerOCR(imagePretraitee, (p) => setProgresOCR(p));

      // Étape 3 : affichage du tableau éditable
      setLignes(resultat.lignes);
      setQualiteOCR(resultat.qualite);
      setNbValides(resultat.lignes.filter((l) => l.selectionne).length);
      setEtat('edition');
    } catch (e) {
      console.error('Erreur OCR:', e);
      setErreur("L'analyse du ticket a échoué. Vérifiez la qualité de la photo.");
      setEtat('erreur');
    }
  }, []);

  const gererFichier = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    if (fichier) traiterPhoto(fichier);
    // Réinitialiser l'input pour permettre le re-scan du même fichier
    e.target.value = '';
  }, [traiterPhoto]);

  // ---- Modification d'une ligne ----
  const modifierLigne = useCallback((id: string, champ: keyof LigneTicket, valeur: string | boolean) => {
    setLignes((prev) => {
      const nouvelles = prev.map((l) => {
        if (l.id !== id) return l;
        if (champ === 'selectionne') {
          const updated = { ...l, selectionne: valeur as boolean };
          setNbValides(prev.filter((x) => x.selectionne).length + (valeur ? 0 : -1));
          return updated;
        }
        if (champ === 'prixBrut') {
          const num = parseFloat((valeur as string).replace(',', '.'));
          return { ...l, prixBrut: valeur as string, prixNombre: isNaN(num) ? null : num };
        }
        return { ...l, [champ]: valeur };
      });
      // Recalculer nbValides
      setNbValides(nouvelles.filter((l) => l.selectionne).length);
      return nouvelles;
    });
  }, []);

  const supprimerLigne = useCallback((id: string) => {
    setLignes((prev) => {
      const nouvelles = prev.filter((l) => l.id !== id);
      setNbValides(nouvelles.filter((l) => l.selectionne).length);
      return nouvelles;
    });
  }, []);

  // ---- Soumission groupée ----
  const soumettre = useCallback(async () => {
    const enseigneFinale = enseigne === ENSEIGNE_AUTRE ? enseignePersonnalisee.trim() : enseigne;
    if (!enseigneFinale) {
      setErreur('Veuillez sélectionner ou saisir une enseigne avant de valider');
      return;
    }

    const lignesSelectionnees = lignes.filter((l) => l.selectionne && l.nomBrut.trim().length >= 2);
    if (lignesSelectionnees.length === 0) {
      setErreur('Aucune ligne sélectionnée');
      return;
    }

    setEtat('envoi');
    setErreur('');

    try {
      // Soumettre toutes les lignes en parallèle
      await Promise.all(
        lignesSelectionnees.map((ligne) => {
          const prixUnitaire = ligne.prixNombre ?? 0;
          const quantite = 1;
          const unite: Unite = 'pièce';

          return fetch('/api/prix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              produit_nom: normaliserNom(ligne.nomBrut),
              produit_nom_original: ligne.nomBrut.trim(),
              produit_categorie: 'autre' as Categorie,
              code_ean: null,
              enseigne: enseigneFinale,
              prix_unitaire: prixUnitaire,
              prix_kg_litre: calculerPrixReference(prixUnitaire, quantite, unite),
              unite,
              quantite,
              date_releve: new Date().toISOString(),
              source: 'ticket_ocr',
            }),
          });
        })
      );

      setEtat('succes');
    } catch {
      setEtat('erreur');
      setErreur('Erreur lors de l\'envoi. Veuillez réessayer.');
    }
  }, [lignes, enseigne]);

  // ---- Réinitialiser ----
  const recommencer = () => {
    setEtat('attente');
    setLignes([]);
    setEnseigne('');
    setErreur('');
    setProgresOCR(0);
  };

  // ============================================================
  // Rendus selon l'état
  // ============================================================

  if (etat === 'succes') {
    return (
      <div className="carte p-8 text-center animer-fade">
        <div className="text-4xl mb-4">✦</div>
        <h2 className="font-display font-700 text-lg text-accent mb-2">
          {nbValides} contribution{nbValides > 1 ? 's' : ''} envoyée{nbValides > 1 ? 's' : ''}
        </h2>
        <p className="text-secondaire text-sm mb-6">
          Elles seront visibles après validation par notre équipe.
        </p>
        <button type="button" className="btn-secondaire" onClick={recommencer}>
          Scanner un autre ticket
        </button>
      </div>
    );
  }

  if (etat === 'pretraitement' || etat === 'ocr') {
    return (
      <div className="carte p-8 text-center space-y-4 animer-fade">
        <div className="text-3xl animate-pulse">
          {etat === 'pretraitement' ? '⚙️' : '🔍'}
        </div>
        <p className="font-display font-600 text-sm text-texte">
          {etat === 'pretraitement'
            ? 'Optimisation de l\'image…'
            : 'Analyse du ticket en cours…'}
        </p>
        {etat === 'ocr' && (
          <div className="space-y-2">
            <div className="barre-ocr">
              <div className="barre-ocr-progres" style={{ width: `${progresOCR}%` }} />
            </div>
            <p className="text-tertiaire text-xs font-mono">{progresOCR}%</p>
          </div>
        )}
      </div>
    );
  }

  if (etat === 'edition' || etat === 'envoi') {
    return (
      <div className="space-y-4 animer-entree">
        {/* Alerte qualité médiocre */}
        {qualiteOCR === 'mediocre' && (
          <div className="bg-attente/10 border border-attente/30 rounded-xl p-3">
            <p className="text-attente text-sm font-display">
              ⚠ Extraction difficile — vérifiez et corrigez chaque ligne avant de valider.
            </p>
          </div>
        )}

        {/* Sélection de l'enseigne */}
        <div className="carte p-4">
          <label className="label" htmlFor="enseigne-scan">
            Enseigne du ticket *
          </label>
          <div className="relative">
            <select
              id="enseigne-scan"
              className="select-base pr-10"
              value={enseigne}
              onChange={(e) => setEnseigne(e.target.value)}
            >
              <option value="">Sélectionner l'enseigne</option>
              {ENSEIGNES_PREDEFINIES.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
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

        {/* Tableau des lignes extraites */}
        <div className="carte overflow-hidden">
          <div className="p-4 border-b border-bord flex items-center justify-between">
            <h3 className="font-display font-700 text-sm text-texte">
              {lignes.length} ligne{lignes.length > 1 ? 's' : ''} extraite{lignes.length > 1 ? 's' : ''}
            </h3>
            <span className="text-accent text-xs font-display font-600">
              {nbValides} sélectionnée{nbValides > 1 ? 's' : ''}
            </span>
          </div>

          <div className="divide-y divide-bord">
            {lignes.map((ligne) => (
              <div
                key={ligne.id}
                className={`p-3 transition-colors ${
                  ligne.selectionne ? '' : 'opacity-40'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={ligne.selectionne}
                    onChange={(e) => modifierLigne(ligne.id, 'selectionne', e.target.checked)}
                    className="mt-3 accent-accent flex-shrink-0"
                    aria-label="Sélectionner cette ligne"
                  />

                  {/* Champs éditables */}
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={ligne.nomBrut}
                      onChange={(e) => modifierLigne(ligne.id, 'nomBrut', e.target.value)}
                      className="input-base text-sm"
                      placeholder="Nom du produit"
                      aria-label="Nom du produit"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={ligne.prixBrut}
                      onChange={(e) => modifierLigne(ligne.id, 'prixBrut', e.target.value)}
                      className="input-base font-mono text-sm w-32"
                      placeholder="Prix (€)"
                      aria-label="Prix"
                    />
                  </div>

                  {/* Bouton supprimer */}
                  <button
                    type="button"
                    onClick={() => supprimerLigne(ligne.id)}
                    className="text-tertiaire hover:text-erreur transition-colors mt-2 text-lg"
                    aria-label="Supprimer cette ligne"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Erreur */}
        {erreur && (
          <p className="text-erreur text-sm font-display">{erreur}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button type="button" className="btn-secondaire flex-1" onClick={recommencer}>
            Recommencer
          </button>
          <button
            type="button"
            className="btn-primaire flex-1"
            onClick={soumettre}
            disabled={etat === 'envoi'}
          >
            {etat === 'envoi' ? '⟳ Envoi…' : `Valider (${nbValides})`}
          </button>
        </div>
      </div>
    );
  }

  // État par défaut : attente de photo
  return (
    <div className="space-y-6">
      {/* Zone de capture */}
      <div className="carte p-8 text-center">
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto mb-4 bg-accent/10 rounded-2xl flex items-center justify-center border-2 border-dashed border-accent/40">
            <span className="text-3xl">📷</span>
          </div>
          <h2 className="font-display font-700 text-base text-texte mb-2">
            Photographier un ticket
          </h2>
          <p className="text-secondaire text-sm">
            Les prix seront extraits automatiquement.<br />
            Vous pourrez corriger avant l'envoi.
          </p>
        </div>

        {/* Input file caché */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={gererFichier}
          aria-label="Prendre une photo du ticket"
        />

        <button
          type="button"
          className="btn-primaire w-full"
          onClick={() => inputRef.current?.click()}
        >
          Prendre une photo
        </button>

        <button
          type="button"
          className="btn-secondaire w-full mt-3"
          onClick={() => {
            if (inputRef.current) {
              inputRef.current.removeAttribute('capture');
              inputRef.current.click();
              // Remettre capture après
              setTimeout(() => inputRef.current?.setAttribute('capture', 'environment'), 1000);
            }
          }}
        >
          Choisir depuis la galerie
        </button>

        {erreur && (
          <p className="text-erreur text-sm font-display mt-4">{erreur}</p>
        )}
      </div>

      {/* Conseils */}
      <div className="carte p-4 space-y-2">
        <h3 className="font-display font-700 text-xs uppercase tracking-wider text-secondaire mb-3">
          Conseils pour un bon résultat
        </h3>
        {[
          ['💡', 'Bonne luminosité, éviter les reflets'],
          ['📐', 'Ticket bien à plat, sans plis'],
          ['🎯', 'Cadrer tout le ticket dans la photo'],
          ['🔍', 'Ne pas flouter les bords'],
        ].map(([icone, conseil]) => (
          <div key={conseil} className="flex items-center gap-3">
            <span className="text-base">{icone}</span>
            <span className="text-secondaire text-sm">{conseil}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
