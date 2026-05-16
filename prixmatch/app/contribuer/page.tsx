// app/contribuer/page.tsx — Page de contribution manuelle

import ContributionForm from '@/components/ContributionForm';
import BottomNav from '@/components/BottomNav';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contribuer — PrixMatch',
  description: 'Ajoutez un prix relevé en grande surface.',
};

export default function PageContribuer() {
  return (
    <>
      <div className="px-4 pt-12 pb-6">
        {/* En-tête */}
        <div className="mb-6">
          <h1 className="font-display font-800 text-2xl text-texte tracking-tight mb-1">
            Contribuer
          </h1>
          <p className="text-secondaire text-sm">
            Partagez un prix relevé en magasin
          </p>
        </div>

        {/* Formulaire */}
        <ContributionForm />

        {/* Pied informatif */}
        <div className="mt-6 p-4 border border-bord rounded-xl">
          <h2 className="font-display font-700 text-xs uppercase tracking-wider text-secondaire mb-2">
            Comment ça marche ?
          </h2>
          <ul className="space-y-1.5">
            {[
              '1. Renseignez le produit et son prix',
              '2. Votre contribution est soumise à modération',
              '3. Une fois validée, elle est visible de tous',
            ].map((etape) => (
              <li key={etape} className="text-tertiaire text-xs font-display">
                {etape}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <BottomNav />
    </>
  );
}
