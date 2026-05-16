// app/scanner/page.tsx — Page de scan OCR des tickets de caisse

import ScannerView from '@/components/ScannerView';
import ThemeToggle from '@/components/ThemeToggle';
import BottomNav from '@/components/BottomNav';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Scanner un ticket — PrixMatch',
  description: 'Photographiez votre ticket de caisse pour extraire les prix automatiquement.',
};

export default function PageScanner() {
  return (
    <>
      <div className="px-4 pt-12 pb-6">
        {/* En-tête */}
        <div className="mb-6">
          <div className="flex items-start justify-between mb-1">
            <h1 className="font-display font-800 text-2xl text-texte tracking-tight">
              Scanner
            </h1>
            <ThemeToggle />
          </div>
          <p className="text-secondaire text-sm">
            Importez un ticket de caisse en photo
          </p>
        </div>

        {/* Vue scanner */}
        <ScannerView />
      </div>

      <BottomNav />
    </>
  );
}
