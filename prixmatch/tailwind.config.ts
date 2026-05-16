// tailwind.config.ts — Configuration Tailwind pour PrixMatch
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-syne)', 'sans-serif'],
        mono: ['var(--font-dm-mono)', 'monospace'],
      },
      colors: {
        // Toutes les couleurs référencées dans globals.css
        fond: 'var(--fond)',
        carte: 'var(--fond-carte)',
        input: 'var(--fond-input)',
        bord: 'var(--bord)',
        texte: 'var(--texte)',
        secondaire: 'var(--texte-secondaire)',
        tertiaire: 'var(--texte-tertiaire)',
        accent: 'var(--accent)',
        'accent-sombre': 'var(--accent-sombre)',
        succes: 'var(--succes)',
        erreur: 'var(--erreur)',
        attente: 'var(--attente)',
      },
      fontWeight: {
        '500': '500',
        '600': '600',
        '700': '700',
        '800': '800',
      },
    },
  },
  plugins: [],
};

export default config;
