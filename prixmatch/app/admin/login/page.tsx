'use client';
// app/admin/login/page.tsx — Formulaire de connexion admin

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PageLoginAdmin() {
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);
  const router = useRouter();

  const connexion = async () => {
    if (!motDePasse) return;
    setChargement(true);
    setErreur('');

    try {
      const reponse = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motDePasse }),
      });

      if (reponse.ok) {
        router.push('/admin');
        router.refresh();
      } else {
        setErreur('Mot de passe incorrect');
      }
    } catch {
      setErreur('Erreur de connexion');
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display font-800 text-2xl text-texte mb-2 text-center">
          Administration
        </h1>
        <p className="text-secondaire text-sm text-center mb-8">
          Accès réservé aux modérateurs
        </p>

        <div className="carte p-6 space-y-4">
          <div>
            <label className="label" htmlFor="mdp">Mot de passe</label>
            <input
              id="mdp"
              type="password"
              className="input-base"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && connexion()}
              autoFocus
              autoComplete="current-password"
            />
          </div>

          {erreur && (
            <p className="text-erreur text-sm font-display">{erreur}</p>
          )}

          <button
            type="button"
            className="btn-primaire w-full"
            onClick={connexion}
            disabled={chargement || !motDePasse}
          >
            {chargement ? '⟳ Connexion…' : 'Se connecter'}
          </button>
        </div>

        <p className="text-tertiaire text-xs text-center mt-4">
          Session valide 8 heures
        </p>
      </div>
    </div>
  );
}
