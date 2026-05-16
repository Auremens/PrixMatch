// app/admin/layout.tsx — Layout de l'espace admin (sans BottomNav)

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Administration — PrixMatch',
  robots: { index: false, follow: false },
};

export default function LayoutAdmin({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-fond">
      {/* Bandeau admin */}
      <div className="bg-attente/10 border-b border-attente/20 px-4 py-2">
        <span className="text-attente text-xs font-display font-600 uppercase tracking-wider">
          ⚙ Espace administration
        </span>
      </div>
      {children}
    </div>
  );
}
