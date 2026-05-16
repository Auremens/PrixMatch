'use client';
// components/BottomNav.tsx — Barre de navigation fixe en bas (mobile-first)
// 3 onglets : Rechercher / Contribuer / Scanner

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface OngletNav {
  href: string;
  libelle: string;
  icone: string;
  iconeActif: string;
}

const ONGLETS: OngletNav[] = [
  {
    href: '/rechercher',
    libelle: 'Rechercher',
    icone: '⊙',
    iconeActif: '◎',
  },
  {
    href: '/contribuer',
    libelle: 'Contribuer',
    icone: '+',
    iconeActif: '✦',
  },
  {
    href: '/scanner',
    libelle: 'Scanner',
    icone: '▣',
    iconeActif: '▤',
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  // Masquer la nav dans l'espace admin
  if (pathname.startsWith('/admin')) return null;

  return (
    <nav className="bottom-nav pb-safe" role="navigation" aria-label="Navigation principale">
      <div className="flex h-16 items-center justify-around px-4">
        {ONGLETS.map((onglet) => {
          const estActif =
            onglet.href === '/rechercher'
              ? pathname === '/'
              : pathname.startsWith(onglet.href);

          return (
            <Link
              key={onglet.href}
              href={onglet.href}
              className={`
                flex flex-col items-center gap-0.5 px-6 py-2 rounded-xl
                transition-all duration-150 select-none
                ${estActif
                  ? 'text-accent'
                  : 'text-tertiaire hover:text-secondaire'
                }
              `}
              aria-current={estActif ? 'page' : undefined}
            >
              {/* Icône */}
              <span
                className={`text-xl leading-none transition-transform duration-150 ${
                  estActif ? 'scale-110' : ''
                }`}
                aria-hidden="true"
              >
                {estActif ? onglet.iconeActif : onglet.icone}
              </span>

              {/* Libellé */}
              <span className={`text-[10px] font-display font-600 uppercase tracking-wider ${
                estActif ? 'text-accent' : 'text-tertiaire'
              }`}>
                {onglet.libelle}
              </span>

              {/* Indicateur actif */}
              {estActif && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-accent" aria-hidden="true" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
