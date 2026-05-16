'use client';
// components/ScannerView.tsx — Scanner de tickets via API Claude Vision
// Remplace Tesseract.js par un appel à claude-sonnet pour une extraction fiable

import { useState, useRef, useCallback } from 'react';
import { normaliserNom, calculerPrixReference, ENSEIGNES_PREDEFINIES, ENSEIGNE_AUTRE } from '@/lib/utils';
import type { LigneTicket } from '@/lib/ocr';
import type { Categorie, Unite } from '@/lib/storage';

type EtatScanner =
  | 'attente'
  | 'analyse'
  | 'edition'
  | 'envoi'
  | 'succes'
  | 'erreur';

export default function ScannerView() {
  const [etat, setEtat] = useState<EtatScanner>('attente');
  const [lignes, setLignes] = useState<LigneTicket[]>([]);
  const [enseigne, setEnseigne] = useState<string>('');
  const [enseignePersonnalisee, setEnseignePersonnalisee] = useState('');
  const [erreur, setErreur] = useState('');
  const [nbValides, setNbValides] = useState(0);
  const [imageBase64, setImageBase64] = useState<string>('');
  const [imageType, setImageType] = useState<string>('image/jpeg');
  const inputRef = useRef<HTMLInputElement>(null);

  // ---- Convertir le fichier en base64 ----
  const fichierVersBase64 = (fichier: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Enlever le préfixe data:...
      };
      reader.onerror = reject;
      reader.readAsDataURL(fichier);
    });

  // ---- Analyse du ticket via Claude Vision ----
  const analyserAvecClaude = useCallback(async (base64: string, type: string) => {
    const reponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: type, data: base64 }
            },
            {
              type: 'text',
              text: `Analyse ce ticket de caisse et extrais les produits achetés.
Réponds UNIQUEMENT en JSON valide, sans texte avant ou après, dans ce format exact :
{
  "enseigne": "nom de l'enseigne si visible, sinon null",
  "produits": [
    { "nom": "nom du produit", "prix": 1.99 },
    { "nom": "autre produit", "prix": 0.89 }
  ]
}
Règles :
- Inclure uniquement les produits avec un prix clairement lisible
- Ne pas inclure : total, sous-total, TVA, remises, avoir, fidélité, CB, espèces
- Le prix doit être un nombre décimal (ex: 1.99, pas "1,99 €")
- Si le prix n'est pas lisible, ne pas inclure le produit
- Noms de produits tels qu'ils apparaissent sur le ticket`
            }
          ]
        }]
      })
    });

    if (!reponse.ok) throw new Error(`API Claude : ${reponse.status}`);
    const data = await reponse.json();
    const texte = data.content?.[0]?.text ?? '';

    // Parser le JSON retourné
    const jsonMatch = texte.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Réponse non parseable');
    return JSON.parse(jsonMatch[0]);
  }, []);

  // ---- Traitement de la photo ----
  const traiterPhoto = useCallback(async (fichier: File) => {
    setEtat('analyse');
    setErreur('');

    try {
      const base64 = await fichierVersBase64(fichier);
      const type = fichier.type || 'image/jpeg';
      setImageBase64(base64);
      setImageType(type);

      const resultat = await analyserAvecClaude(base64, type);

      // Convertir en LigneTicket
      const nouvelles: LigneTicket[] = (resultat.produits ?? []).map(
        (p: { nom: string; prix: number }, i: number) => ({
          id: `ligne_${i}`,
          nomBrut: p.nom,
          prixBrut: String(p.prix),
          prixNombre: p.prix,
          selectionne: true,
        })
      );

      // Pré-remplir l'enseigne si détectée
      if (resultat.enseigne) {
        const enseigneDetectee = resultat.enseigne;
        const connue = ENSEIGNES_PREDEFINIES.find(
          e => e.toLowerCase() === enseigneDetectee.toLowerCase()
        );
        if (connue) {
          setEnseigne(connue);
        } else {
          setEnseigne(ENSEIGNE_AUTRE);
          setEnseignePersonnalisee(enseigneDetectee);
        }
      }

      setLignes(nouvelles);
      setNbValides(nouvelles.length);
      setEtat('edition');
    } catch (e) {
      console.error('Erreur analyse:', e);
      setErreur("L'analyse du ticket a échoué. Vérifiez la qualité de la photo et réessayez.");
      setEtat('erreur');
    }
  }, [analyserAvecClaude]);

  const gererFichier = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    if (fichier) traiterPhoto(fichier);
    e.target.value = '';
  }, [traiterPhoto]);

  // ---- Modification d'une ligne ----
  const modifierLigne = useCallback((id: string, champ: keyof LigneTicket, valeur: string | boolean) => {
    setLignes(prev => {
      const nouvelles = prev.map(l => {
        if (l.id !== id) return l;
        if (champ === 'selectionne') return { ...l, selectionne: valeur as boolean };
        if (champ === 'prixBrut') {
          const num = parseFloat((valeur as string).replace(',', '.'));
          return { ...l, prixBrut: valeur as string, prixNombre: isNaN(num) ? null : num };
        }
        return { ...l, [champ]: valeur };
      });
      setNbValides(nouvelles.filter(l => l.selectionne).length);
      return nouvelles;
    });
  }, []);

  const supprimerLigne = useCallback((id: string) => {
    setLignes(prev => {
      const nouvelles = prev.filter(l => l.id !== id);
      setNbValides(nouvelles.filter(l => l.selectionne).length);
      return nouvelles;
    });
  }, []);

  // ---- Soumission groupée ----
  const soumettre = useCallback(async () => {
    const enseigneFinale = enseigne === ENSEIGNE_AUTRE ? enseignePersonnalisee.trim() : enseigne;
    if (!enseigneFinale) { setErreur('Veuillez sélectionner ou saisir une enseigne'); return; }

    const selectionnees = lignes.filter(l => l.selectionne && l.nomBrut.trim().length >= 2);
    if (selectionnees.length === 0) { setErreur('Aucune ligne sélectionnée'); return; }

    setEtat('envoi');
    setErreur('');

    try {
      await Promise.all(selectionnees.map(ligne => {
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
            unite, quantite,
            date_releve: new Date().toISOString(),
            source: 'ticket_ocr',
          }),
        });
      }));
      setNbValides(selectionnees.length);
      setEtat('succes');
    } catch {
      setEtat('erreur');
      setErreur("Erreur lors de l'envoi. Veuillez réessayer.");
    }
  }, [lignes, enseigne, enseignePersonnalisee]);

  const recommencer = () => {
    setEtat('attente'); setLignes([]); setEnseigne('');
    setEnseignePersonnalisee(''); setErreur('');
  };

  // ============================================================
  // Rendus
  // ============================================================

  if (etat === 'succes') {
    return (
      <div className="carte p-8 text-center animer-fade space-y-4">
        <div className="text-4xl">✦</div>
        <h2 className="font-display font-700 text-lg text-accent">
          {nbValides} contribution{nbValides > 1 ? 's' : ''} envoyée{nbValides > 1 ? 's' : ''}
        </h2>
        <p className="text-secondaire text-sm">Elles seront visibles après validation.</p>
        <button type="button" className="btn-secondaire w-full" onClick={recommencer}>
          Scanner un autre ticket
        </button>
      </div>
    );
  }

  if (etat === 'analyse') {
    return (
      <div className="carte p-8 text-center space-y-4 animer-fade">
        <div className="text-3xl animate-pulse">🔍</div>
        <p className="font-display font-600 text-sm text-texte">
          Analyse du ticket en cours…
        </p>
        <p className="text-tertiaire text-xs">Claude Vision extrait les produits et les prix</p>
        <div className="barre-ocr mt-2">
          <div className="barre-ocr-progres animate-pulse" style={{ width: '70%' }} />
        </div>
      </div>
    );
  }

  if (etat === 'edition' || etat === 'envoi') {
    return (
      <div className="space-y-4 animer-entree">

        {/* Sélection enseigne */}
        <div className="carte p-4">
          <label className="label" htmlFor="enseigne-scan">Enseigne *</label>
          <div className="relative">
            <select id="enseigne-scan" className="select-base pr-10" value={enseigne}
              onChange={e => setEnseigne(e.target.value)}>
              <option value="">Sélectionner l'enseigne</option>
              {ENSEIGNES_PREDEFINIES.map(e => <option key={e} value={e}>{e}</option>)}
              <option value={ENSEIGNE_AUTRE}>+ Ajouter une enseigne…</option>
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiaire pointer-events-none">▾</span>
          </div>
          {enseigne === ENSEIGNE_AUTRE && (
            <input type="text" className="input-base mt-2"
              placeholder="Nom de l'enseigne" value={enseignePersonnalisee}
              onChange={e => setEnseignePersonnalisee(e.target.value)} autoFocus />
          )}
        </div>

        {/* Tableau des lignes */}
        <div className="carte overflow-hidden">
          <div className="p-4 border-b border-bord flex items-center justify-between">
            <h3 className="font-display font-700 text-sm text-texte">
              {lignes.length} produit{lignes.length > 1 ? 's' : ''} détecté{lignes.length > 1 ? 's' : ''}
            </h3>
            <span className="text-accent text-xs font-display font-600">
              {nbValides} sélectionné{nbValides > 1 ? 's' : ''}
            </span>
          </div>

          <div className="divide-y divide-bord">
            {lignes.map(ligne => (
              <div key={ligne.id} className={`p-3 transition-colors ${!ligne.selectionne ? 'opacity-40' : ''}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={ligne.selectionne}
                    onChange={e => modifierLigne(ligne.id, 'selectionne', e.target.checked)}
                    className="mt-3 accent-accent flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <input type="text" value={ligne.nomBrut}
                      onChange={e => modifierLigne(ligne.id, 'nomBrut', e.target.value)}
                      className="input-base text-sm" placeholder="Nom du produit" />
                    <input type="text" inputMode="decimal" value={ligne.prixBrut}
                      onChange={e => modifierLigne(ligne.id, 'prixBrut', e.target.value)}
                      className="input-base font-mono text-sm w-32" placeholder="Prix (€)" />
                  </div>
                  <button type="button" onClick={() => supprimerLigne(ligne.id)}
                    className="text-tertiaire hover:text-erreur transition-colors mt-2 text-lg">×</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {erreur && <p className="text-erreur text-sm font-display">{erreur}</p>}

        <div className="flex gap-3">
          <button type="button" className="btn-secondaire flex-1" onClick={recommencer}>
            Recommencer
          </button>
          <button type="button" className="btn-primaire flex-1" onClick={soumettre}
            disabled={etat === 'envoi'}>
            {etat === 'envoi' ? '⟳ Envoi…' : `Valider (${nbValides})`}
          </button>
        </div>
      </div>
    );
  }

  // Attente / erreur
  return (
    <div className="space-y-6">
      <div className="carte p-8 text-center">
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto mb-4 bg-accent/10 rounded-2xl flex items-center justify-center border-2 border-dashed border-accent/40">
            <span className="text-3xl">📷</span>
          </div>
          <h2 className="font-display font-700 text-base text-texte mb-2">
            Scanner un ticket
          </h2>
          <p className="text-secondaire text-sm">
            Claude Vision extrait automatiquement tous les produits et prix.
          </p>
        </div>

        <input ref={inputRef} type="file" accept="image/*" capture="environment"
          className="hidden" onChange={gererFichier} />

        <button type="button" className="btn-primaire w-full"
          onClick={() => inputRef.current?.click()}>
          Prendre une photo
        </button>
        <button type="button" className="btn-secondaire w-full mt-3"
          onClick={() => {
            if (inputRef.current) {
              inputRef.current.removeAttribute('capture');
              inputRef.current.click();
              setTimeout(() => inputRef.current?.setAttribute('capture', 'environment'), 500);
            }
          }}>
          Choisir depuis la galerie
        </button>

        {erreur && <p className="text-erreur text-sm font-display mt-4">{erreur}</p>}
      </div>

      <div className="carte p-4 space-y-2">
        <h3 className="font-display font-700 text-xs uppercase tracking-wider text-secondaire mb-3">
          Conseils
        </h3>
        {[
          ['💡', 'Bonne luminosité, éviter les reflets'],
          ['📐', 'Ticket bien à plat, sans plis'],
          ['🎯', 'Tout le ticket dans le cadre'],
        ].map(([icone, conseil]) => (
          <div key={conseil} className="flex items-center gap-3">
            <span>{icone}</span>
            <span className="text-secondaire text-sm">{conseil}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
