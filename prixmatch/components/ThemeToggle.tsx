'use client';
// components/ThemeToggle.tsx — Bouton de bascule dark/light
// Persiste le choix dans localStorage, applique une classe sur <html>

import { useState, useEffect } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Lire le thème sauvegardé au montage
  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null;
    const initial = saved ?? 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const basculer = () => {
    const nouveau = theme === 'dark' ? 'light' : 'dark';
    setTheme(nouveau);
    localStorage.setItem('theme', nouveau);
    document.documentElement.setAttribute('data-theme', nouveau);
  };

  return (
    <button
      type="button"
      onClick={basculer}
      className="w-9 h-9 rounded-xl bg-carte border border-bord flex items-center justify-center text-base transition-all hover:border-accent"
      aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
      title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  );
}
