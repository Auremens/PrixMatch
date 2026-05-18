'use client';
// components/ScannerView.tsx — Scanner code-barres + Open Food Facts
// Flux : scan code-barres → nom/catégorie auto → saisie prix → contribution

import { useState, useRef, useCallback, useEffect } from 'react';
import { normaliserNom, calculerPrixReference, UNITES } from '@/lib/utils';
import { ENSEIGNES, CATEGORIES } from '@/lib/config';
import type { Unite } from '@/lib/storage';

type EtatScanner =
  | 'attente'       // En attente d'un scan
  | 'recherche'     // Appel Open Food Facts
  | 'formulaire'    // Produit trouvé, saisie du prix
  | 'envoi'         // Soumission en cours
  | 'succes'        // Envoyé
  | 'erreur';       // Produit non trouvé ou erreur

interface ProduitOFF {
  nom: string;
  nomOriginal: string;
  categorie: string;
  codeEan: string;
  imageUrl?: string;
  marque?: string;
  quantite?: string;
}

export default function ScannerView() {
  const [etat, setEtat] = useState<EtatScanner>('attente');
  const [produit, setProduit] = useState<ProduitOFF | null>(null);
  const [erreur, setErreur] = useState('');

  // Champs formulaire
  const [prix, setPrix] = useState('');
  const [enseigne, setEnseigne] = useState('');
  const [enseigneLibre, setEnseigneLibre] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [unite, setUnite] = useState<Unite>('pièce');
  const [codeEanSaisi, setCodeEanSaisi] = useState('');

  const inputEanRef = useRef<HTMLInputElement>(null);
  const inputPrixRef = useRef<HTMLInputElement>(null);

  // Focus auto sur le prix quand le formulaire s'affiche
  useEffect(() => {
    if (etat === 'formulaire') {
      setTimeout(() => inputPrixRef.current?.focus(), 100);
    }
  }, [etat]);

  // ---- Recherche Open Food Facts ----
  const rechercherProduit = useCallback(async (ean: string) => {
    if (!ean || ean.length < 8) {
      setErreur('Code-barres trop court (minimum 8 chiffres)');
      return;
    }

    setEtat('recherche');
    setErreur('');

    try {
      const reponse = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=product_name,product_name_fr,categories_tags,brands,quantity,image_front_small_url`
      );
      const data = await reponse.json();

      if (data.status !== 1 || !data.product) {
        setErreur(`Produit introuvable pour le code ${ean}. Saisis le nom manuellement.`);
        setEtat('formulaire');
        setProduit({ nom: '', nomOriginal: '', categorie: 'autre', codeEan: ean });
        return;
      }

      const p = data.product;

      // Nom : préférer le nom français
      const nomBrut = p.product_name_fr || p.product_name || '';
      // Nettoyer le nom : enlever la quantité si présente dans le nom
      const nomNettoye = nomBrut.replace(/\s*\d+\s*(g|kg|ml|cl|l|litre|pièce|x\d+)\b/gi, '').trim();

      // Catégorie : mapper les tags OFF vers nos catégories
      const tags: string[] = p.categories_tags ?? [];
      const categorie = mapperCategorie(tags);

      // Quantité : extraire depuis le champ quantity
      const quantiteStr: string = p.quantity ?? '';

      setProduit({
        nom: nomNettoye || nomBrut,
        nomOriginal: nomBrut,
        categorie,
        codeEan: ean,
        imageUrl: p.image_front_small_url,
        marque: p.brands,
        quantite: quantiteStr,
      });

      // Pré-remplir la quantité si détectée
      const matchQte = quantiteStr.match(/(\d+(?:[.,]\d+)?)\s*(g|kg|ml|cl|l|litre)/i);
      if (matchQte) {
        setQuantite(matchQte[1].replace(',', '.'));
        const u = matchQte[2].toLowerCase();
        if (u === 'kg') setUnite('kg');
        else if (u === 'g') setUnite('g');
        else if (u === 'l' || u === 'litre') setUnite('litre');
        else if (u === 'cl') setUnite('cl');
        else if (u === 'ml') setUnite('ml');
      }

      setEtat('formulaire');
    } catch {
      setErreur('Erreur de connexion. Vérifie ta connexion internet.');
      setEtat('erreur');
    }
  }, []);

  // ---- Mapper catégories Open Food Facts → nos catégories ----
  function mapperCategorie(tags: string[]): string {
    const str = tags.join(' ').toLowerCase();
    if (str.includes('beverage') || str.includes('drink') || str.includes('boisson') || str.includes('water') || str.includes('jus')) return 'boissons';
    if (str.includes('hygiene') || str.includes('cosmetic') || str.includes('shampoo') || str.includes('soap') || str.includes('hygiene')) return 'hygiène';
    if (str.includes('cleaning') || str.includes('household') || str.includes('detergent') || str.includes('lessive')) return 'entretien';
    if (str.includes('baby') || str.includes('infant') || str.includes('bebe')) return 'bébé';
    if (str.includes('pet') || str.includes('animal') || str.includes('cat') || str.includes('dog')) return 'animaux';
    if (str.includes('food') || str.includes('aliment') || str.includes('dairy') || str.includes('meat') || str.includes('vegetable')) return 'alimentaire';
    return 'alimentaire'; // Défaut pour les produits alimentaires
  }

  // ---- Soumission ----
  const soumettre = useCallback(async () => {
    if (!produit) return;
    const prixNombre = parseFloat(prix.replace(',', '.'));
    const enseigneFinale = enseigne === '__libre__' ? enseigneLibre.trim() : enseigne;
    const quantiteNombre = parseFloat(quantite.replace(',', '.'));

    if (isNaN(prixNombre) || prixNombre <= 0) { setErreur('Prix invalide'); return; }
    if (!enseigneFinale) { setErreur('Enseigne obligatoire'); return; }

    setEtat('envoi'); setErreur('');

    try {
      await fetch('/api/prix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produit_nom: normaliserNom(produit.nom || codeEanSaisi),
          produit_nom_original: produit.nom || codeEanSaisi,
          produit_categorie: produit.categorie,
          code_ean: produit.codeEan,
          enseigne: enseigneFinale,
          prix_unitaire: prixNombre,
          prix_kg_litre: calculerPrixReference(prixNombre, quantiteNombre, unite),
          unite,
          quantite: quantiteNombre,
          date_releve: new Date().toISOString(),
          source: 'manuel',
        }),
      });
      setEtat('succes');
    } catch {
      setErreur("Erreur lors de l'envoi");
      setEtat('formulaire');
    }
  }, [produit, prix, enseigne, enseigneLibre, quantite, unite, codeEanSaisi]);

  const recommencer = () => {
    setEtat('attente'); setProduit(null); setPrix(''); setEnseigne('');
    setEnseigneLibre(''); setQuantite('1'); setUnite('pièce');
    setCodeEanSaisi(''); setErreur('');
  };

  // ============================================================
  // Rendu
  // ============================================================

  if (etat === 'succes') {
    return (
      <div className="carte p-8 text-center space-y-4 animer-fade">
        <div className="text-4xl">✦</div>
        <h2 className="font-display font-700 text-lg text-accent">Contribution envoyée !</h2>
        <p className="text-secondaire text-sm">Visible après validation.</p>
        <button type="button" className="btn-primaire w-full" onClick={recommencer}>
          Scanner un autre produit
        </button>
      </div>
    );
  }

  if (etat === 'recherche') {
    return (
      <div className="carte p-8 text-center space-y-4 animer-fade">
        <div className="text-3xl animate-pulse">🔍</div>
        <p className="font-display font-600 text-sm text-texte">Recherche du produit…</p>
        <p className="text-tertiaire text-xs">Consultation d'Open Food Facts</p>
        <div className="barre-ocr mt-2">
          <div className="barre-ocr-progres animate-pulse" style={{ width: '60%' }} />
        </div>
      </div>
    );
  }

  if ((etat === 'formulaire' || etat === 'envoi') && produit) {
    const prixNombre = parseFloat(prix.replace(',', '.'));
    const quantiteNombre = parseFloat(quantite.replace(',', '.'));
    const prixRef = !isNaN(prixNombre) && !isNaN(quantiteNombre)
      ? calculerPrixReference(prixNombre, quantiteNombre, unite) : null;

    return (
      <div className="space-y-4 animer-entree">

        {/* Infos produit détecté */}
        <div className="carte p-4">
          <div className="flex items-start gap-3">
            {produit.imageUrl && (
              <img src={produit.imageUrl} alt={produit.nom}
                className="w-14 h-14 object-contain rounded-xl bg-input flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-display font-700 text-sm text-texte leading-tight">
                {produit.nom || <span className="text-tertiaire italic">Nom non détecté</span>}
              </p>
              {produit.marque && (
                <p className="text-tertiaire text-xs font-display mt-0.5">{produit.marque}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-display text-secondaire bg-input px-2 py-0.5 rounded-full capitalize">
                  {produit.categorie}
                </span>
                <span className="text-[10px] font-mono text-tertiaire">{produit.codeEan}</span>
              </div>
            </div>
          </div>

          {/* Correction du nom si besoin */}
          <div className="mt-3">
            <label className="label">Nom du produit</label>
            <input type="text" className="input-base text-sm"
              value={produit.nom}
              onChange={e => setProduit({ ...produit, nom: e.target.value })}
              placeholder="Nom du produit" />
            <p className="text-tertiaire text-[11px] font-display mt-1">
              💡 Nom générique sans marque ni enseigne pour regrouper les prix
            </p>
          </div>
        </div>

        {/* Enseigne */}
        <div className="carte p-4">
          <label className="label" htmlFor="enseigne-scan">Enseigne *</label>
          <div className="relative">
            <select id="enseigne-scan" className="select-base pr-10" value={enseigne}
              onChange={e => setEnseigne(e.target.value)}>
              <option value="">Sélectionner l'enseigne</option>
              {ENSEIGNES.map(e => <option key={e} value={e}>{e}</option>)}
              <option value="__libre__">✏️ Autre…</option>
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiaire pointer-events-none">▾</span>
          </div>
          {enseigne === '__libre__' && (
            <input type="text" className="input-base mt-2" placeholder="Nom de l'enseigne"
              value={enseigneLibre} onChange={e => setEnseigneLibre(e.target.value)} />
          )}
        </div>

        {/* Prix + Quantité + Unité */}
        <div className="carte p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label" htmlFor="prix-scan">Prix (€) *</label>
              <input ref={inputPrixRef} id="prix-scan" type="text" inputMode="decimal"
                className="input-base font-mono" placeholder="1,99"
                value={prix} onChange={e => setPrix(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="qte-scan">Qté</label>
              <input id="qte-scan" type="text" inputMode="decimal" className="input-base font-mono"
                value={quantite} onChange={e => setQuantite(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="unite-scan">Unité</label>
              <div className="relative">
                <select id="unite-scan" className="select-base pr-8 text-xs" value={unite}
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
                {prixRef.toFixed(2).replace('.', ',')} €/{['kg', 'g'].includes(unite) ? 'kg' : 'L'}
              </span>
            </div>
          )}
        </div>

        {erreur && <p className="text-erreur text-sm font-display">{erreur}</p>}

        <div className="flex gap-3">
          <button type="button" className="btn-secondaire flex-1" onClick={recommencer}>
            Recommencer
          </button>
          <button type="button" className="btn-primaire flex-1" onClick={soumettre}
            disabled={etat === 'envoi'}>
            {etat === 'envoi' ? '⟳ Envoi…' : 'Envoyer'}
          </button>
        </div>
      </div>
    );
  }

  // ---- Écran d'accueil scanner ----
  return (
    <div className="space-y-4">
      <div className="carte overflow-hidden">
        <div className="p-4 border-b border-bord">
          <h2 className="font-display font-700 text-base text-texte">Scanner un code-barres</h2>
          <p className="text-secondaire text-xs mt-0.5">Caméra ou saisie manuelle</p>
        </div>

        {/* Bouton caméra */}
        <div className="p-4 border-b border-bord">
          <ScannerCamera onDetecte={rechercherProduit} />
        </div>

        {/* Séparateur */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 h-px bg-bord" />
          <span className="text-tertiaire text-xs font-display">ou saisir manuellement</span>
          <div className="flex-1 h-px bg-bord" />
        </div>

        {/* Saisie manuelle */}
        <div className="px-4 pb-4 space-y-2">
          <div className="flex gap-2">
            <input
              ref={inputEanRef}
              id="ean-input"
              type="text"
              inputMode="numeric"
              className="input-base font-mono flex-1"
              placeholder="Code-barres (ex : 3017620422003)"
              value={codeEanSaisi}
              onChange={e => setCodeEanSaisi(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && rechercherProduit(codeEanSaisi)}
              maxLength={14}
            />
            <button
              type="button"
              className="btn-primaire px-4 flex-shrink-0"
              onClick={() => rechercherProduit(codeEanSaisi)}
              disabled={codeEanSaisi.length < 8}
            >
              →
            </button>
          </div>
        </div>

        {erreur && <p className="text-erreur text-sm font-display px-4 pb-4">{erreur}</p>}
      </div>
    </div>
  );
}

// ============================================================
// Composant caméra — BarcodeDetector API native + fallback input file
// ============================================================
function ScannerCamera({ onDetecte }: { onDetecte: (ean: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [actif, setActif] = useState(false);
  const [erreurCam, setErreurCam] = useState('');
  const [supporte, setSupporte] = useState<boolean | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Vérifier si BarcodeDetector est disponible
  useEffect(() => {
    setSupporte('BarcodeDetector' in window);
  }, []);

  const demarrer = async () => {
    setErreurCam('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      streamRef.current = stream;

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.setAttribute('autoplay', 'true');
      videoRef.current.muted = true;
      await videoRef.current.play();
      setActif(true);

      // BarcodeDetector API native (Chrome Android, Safari 17+)
      if ('BarcodeDetector' in window) {
        // @ts-ignore
        const detector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
        });

        intervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            // @ts-ignore
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const ean = barcodes[0].rawValue;
              arreter();
              onDetecte(ean);
            }
          } catch { /* frame sans code */ }
        }, 300);
      }
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? String(e);
      if (msg.includes('NotAllowed') || msg.includes('Permission')) {
        setErreurCam("Accès caméra refusé. Autorise l'accès dans les paramètres du navigateur.");
      } else if (msg.includes('NotFound')) {
        setErreurCam("Aucune caméra détectée.");
      } else {
        setErreurCam("Erreur : " + msg);
      }
    }
  };

  const arreter = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setActif(false);
  };

  useEffect(() => () => arreter(), []);

  // Fallback : input file pour les navigateurs sans BarcodeDetector
  const scannerFichier = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    // Créer une image et utiliser BarcodeDetector dessus
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = async () => {
      URL.revokeObjectURL(url);
      if ('BarcodeDetector' in window) {
        try {
          // @ts-ignore
          const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'qr_code'] });
          // @ts-ignore
          const barcodes = await detector.detect(img);
          if (barcodes.length > 0) onDetecte(barcodes[0].rawValue);
          else setErreurCam("Aucun code-barres détecté dans l'image.");
        } catch { setErreurCam("Échec de la détection."); }
      }
    };
    img.src = url;
    e.target.value = '';
  };

  return (
    <div className="space-y-3">
      {/* Flux vidéo */}
      <div className={`relative rounded-xl overflow-hidden bg-black ${actif ? 'block' : 'hidden'}`}
        style={{ aspectRatio: '4/3' }}>
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />
        {/* Viseur */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-64 h-36 border-2 border-accent rounded-xl">
            <div className="absolute top-0 left-0 w-5 h-5 border-t-4 border-l-4 border-accent rounded-tl" />
            <div className="absolute top-0 right-0 w-5 h-5 border-t-4 border-r-4 border-accent rounded-tr" />
            <div className="absolute bottom-0 left-0 w-5 h-5 border-b-4 border-l-4 border-accent rounded-bl" />
            <div className="absolute bottom-0 right-0 w-5 h-5 border-b-4 border-r-4 border-accent rounded-br" />
          </div>
        </div>
        {/* Ligne animée */}
        <div className="absolute left-8 right-8 h-0.5 bg-accent/70 animate-pulse"
          style={{ top: '50%' }} />
      </div>

      {actif && (
        <div className="space-y-2">
          {!('BarcodeDetector' in window) && (
            <p className="text-attente text-xs font-display text-center">
              ⚠ Détection automatique non supportée sur ce navigateur.<br/>
              Utilise la saisie manuelle.
            </p>
          )}
          <p className="text-secondaire text-xs font-display text-center">
            Centre le code-barres dans le cadre vert
          </p>
          <button type="button" className="btn-secondaire w-full text-sm" onClick={arreter}>
            Annuler
          </button>
        </div>
      )}

      {!actif && (
        <div className="space-y-2">
          <button type="button"
            className="btn-primaire w-full flex items-center justify-center gap-2"
            onClick={demarrer}>
            <span className="text-lg">📷</span>
            Scanner avec la caméra
          </button>

          {/* Fallback : photo depuis galerie */}
          <label className="btn-secondaire w-full flex items-center justify-center gap-2 cursor-pointer">
            <span>🖼</span>
            Photo depuis la galerie
            <input type="file" accept="image/*" className="hidden" onChange={scannerFichier} />
          </label>

          {erreurCam && <p className="text-erreur text-xs font-display">{erreurCam}</p>}
        </div>
      )}
    </div>
  );
}