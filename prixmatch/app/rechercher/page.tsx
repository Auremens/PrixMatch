'use client';
// app/rechercher/page.tsx — Page de recherche publique

import BottomNav from '@/components/BottomNav';
import ThemeToggle from '@/components/ThemeToggle';
import RechercheView from '@/components/RechercheView';

export default function PageRechercher() {
  return (
    <>
      <div className="min-h-screen bg-fond">
        <header className="px-4 pt-12 pb-6">
          <div className="flex items-start justify-between mb-1">
            <h1 className="font-display font-800 text-3xl text-texte tracking-tight">
              Prix<span className="text-accent">Match</span>
            </h1>
            <ThemeToggle />
          </div>
          <p className="text-secondaire text-sm font-display">
            Comparez les prix en grande surface
          </p>
        </header>
        <div className="px-4">
          <RechercheView />
        </div>
      </div>
      <BottomNav />
    </>
  );
}
