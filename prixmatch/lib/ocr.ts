// lib/ocr.ts — OCR de tickets de caisse avec Tesseract.js
// Prétraitement canvas côté client : niveaux de gris + binarisation adaptive
// Filtre heuristique des lignes non pertinentes (TVA, total, etc.)

// ============================================================
// Types
// ============================================================

export interface LigneTicket {
  id: string;
  nomBrut: string;       // Texte extrait par Tesseract
  prixBrut: string;      // Montant extrait (chaîne)
  prixNombre: number | null; // Montant parsé en float
  selectionne: boolean;  // L'utilisateur a coché cette ligne
}

export interface ResultatOCR {
  lignes: LigneTicket[];
  qualite: 'bonne' | 'mediocre'; // Qualite estimée de l'extraction
  texteComplet: string;
}

// ============================================================
// Prétraitement de l'image (canvas)
// ============================================================

/**
 * Convertit une image en version optimisée pour l'OCR :
 * 1. Dessin sur canvas
 * 2. Passage en niveaux de gris via luminance
 * 3. Étirement d'histogramme (normalisation du contraste)
 * 4. Binarisation par seuillage (Otsu simplifié)
 *
 * @param fichier  Fichier image (depuis input file)
 * @returns        URL data: de l'image prétraitée
 */
export async function pretraiterImage(fichier: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(fichier);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context indisponible'));

      // Dessin de l'image originale
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // --- Étape 1 : Conversion en niveaux de gris ---
      const gris = new Uint8ClampedArray(canvas.width * canvas.height);
      for (let i = 0; i < data.length; i += 4) {
        const pixel = i / 4;
        // Formule de luminance perceptuelle
        gris[pixel] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      }

      // --- Étape 2 : Calcul du min/max pour normalisation ---
      let min = 255, max = 0;
      for (const v of gris) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const range = max - min || 1;

      // --- Étape 3 : Étirement d'histogramme + binarisation ---
      // Seuil calculé à 50% de la plage normalisée (approximation Otsu)
      const seuil = 128;

      for (let i = 0; i < gris.length; i++) {
        const normalise = Math.round(((gris[i] - min) / range) * 255);
        const binaire = normalise > seuil ? 255 : 0;
        const px = i * 4;
        data[px] = binaire;
        data[px + 1] = binaire;
        data[px + 2] = binaire;
        data[px + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => reject(new Error('Impossible de charger l\'image'));
    img.src = url;
  });
}

// ============================================================
// Analyse OCR avec Tesseract.js
// ============================================================

/**
 * Lance l'OCR sur une image prétraitée.
 * @param imageData  URL data: de l'image (depuis pretraiterImage)
 * @param onProgres  Callback de progression (0-100)
 */
export async function lancerOCR(
  imageData: string,
  onProgres?: (progres: number) => void
): Promise<ResultatOCR> {
  // Import dynamique pour éviter les problèmes SSR (Tesseract est client-only)
  const { createWorker } = await import('tesseract.js');

  const worker = await createWorker('fra', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text' && onProgres) {
        onProgres(Math.round(m.progress * 100));
      }
    },
  });

  try {
    const { data } = await worker.recognize(imageData);
    const texteComplet = data.text;

    // Parsing et filtrage des lignes
    const lignes = parserLignesTicket(texteComplet);

    // Estimation de la qualité : si moins de 3 lignes avec prix → médiocre
    const qualite = lignes.filter((l) => l.prixNombre !== null).length >= 3
      ? 'bonne'
      : 'mediocre';

    return { lignes, qualite, texteComplet };
  } finally {
    await worker.terminate();
  }
}

// ============================================================
// Parsing et filtrage heuristique des lignes
// ============================================================

// Expression régulière pour détecter un montant en euros (ex: 1,99 ou 12.50)
const REGEX_PRIX = /(\d{1,3}[,.]?\d{0,2})\s*€?$/;

// Mots-clés à filtrer (lignes non produit)
const MOTS_CLES_PARASITES = [
  'total', 'tva', 'avoir', 'ticket', 'caisse', 'merci',
  'cb', 'carte', 'espèces', 'rendu', 'monnaie', 'montant',
  'dont', 'remise', 'reduction', 'fidélité', 'points',
  'sous-total', 'net', 'ttc', 'ht', 'date', 'heure',
];

/**
 * Parse le texte brut d'un ticket en lignes structurées.
 * Filtre les lignes parasites (TVA, total, etc.)
 */
function parserLignesTicket(texte: string): LigneTicket[] {
  const lignesTexte = texte.split('\n').map((l) => l.trim()).filter(Boolean);
  const resultat: LigneTicket[] = [];
  let compteur = 0;

  for (const ligne of lignesTexte) {
    // Ignorer les lignes trop courtes
    if (ligne.length < 4) continue;

    // Ignorer les lignes contenant des mots-clés parasites
    const ligneLower = ligne.toLowerCase();
    const estParasite = MOTS_CLES_PARASITES.some((mot) => ligneLower.includes(mot));
    if (estParasite) continue;

    // Extraire le prix si présent
    const matchPrix = ligne.match(REGEX_PRIX);
    let prixBrut = '';
    let prixNombre: number | null = null;
    let nomBrut = ligne;

    if (matchPrix) {
      prixBrut = matchPrix[1];
      // Normaliser la virgule/point pour parseFloat
      prixNombre = parseFloat(prixBrut.replace(',', '.'));
      // Le nom = tout ce qui précède le prix
      nomBrut = ligne.slice(0, matchPrix.index).trim();
    }

    // Ne conserver que les lignes qui semblent être des produits
    // (avec un prix ou un nom assez long)
    if (nomBrut.length >= 3 || prixNombre !== null) {
      resultat.push({
        id: `ligne_${compteur++}`,
        nomBrut,
        prixBrut,
        prixNombre,
        selectionne: prixNombre !== null, // Pré-sélectionner les lignes avec prix
      });
    }
  }

  return resultat;
}
