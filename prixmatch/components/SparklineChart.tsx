'use client';
// components/SparklineChart.tsx — Mini graphique SVG d'historique des prix
// Génère un sparkline inline sans dépendance externe

interface PropsSparkling {
  donnees: { date: string; prix: number }[];
  largeur?: number;
  hauteur?: number;
}

export default function SparklineChart({
  donnees,
  largeur = 120,
  hauteur = 40,
}: PropsSparkling) {
  if (donnees.length < 2) {
    return (
      <span className="text-tertiaire text-xs font-display">
        Pas assez de données
      </span>
    );
  }

  // Trier par date croissante
  const triees = [...donnees].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const prix = triees.map((d) => d.prix);
  const min = Math.min(...prix);
  const max = Math.max(...prix);
  const plage = max - min || 1;

  const padding = 4;
  const w = largeur - padding * 2;
  const h = hauteur - padding * 2;

  // Calculer les coordonnées SVG de chaque point
  const points = triees.map((d, i) => ({
    x: padding + (i / (triees.length - 1)) * w,
    y: padding + (1 - (d.prix - min) / plage) * h,
    prix: d.prix,
    date: d.date,
  }));

  // Construire le chemin SVG
  const cheminLigne = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  // Aire sous la courbe (dégradé)
  const cheminAire = [
    `M ${points[0].x.toFixed(1)} ${hauteur}`,
    ...points.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`),
    `L ${points[points.length - 1].x.toFixed(1)} ${hauteur}`,
    'Z',
  ].join(' ');

  const dernierPoint = points[points.length - 1];
  const premierPoint = points[0];
  const tendance = dernierPoint.prix <= premierPoint.prix ? 'baisse' : 'hausse';

  return (
    <div className="sparkline relative">
      <svg
        width={largeur}
        height={hauteur}
        viewBox={`0 0 ${largeur} ${hauteur}`}
        aria-label="Historique des prix"
        role="img"
      >
        <defs>
          <linearGradient id="gradient-sparkline" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={tendance === 'baisse' ? '#9cff57' : '#f87171'}
              stopOpacity="0.3"
            />
            <stop
              offset="100%"
              stopColor={tendance === 'baisse' ? '#9cff57' : '#f87171'}
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {/* Aire sous la courbe */}
        <path
          d={cheminAire}
          fill="url(#gradient-sparkline)"
        />

        {/* Ligne principale */}
        <path
          d={cheminLigne}
          fill="none"
          stroke={tendance === 'baisse' ? '#9cff57' : '#f87171'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Point final (dernier prix) */}
        <circle
          cx={dernierPoint.x}
          cy={dernierPoint.y}
          r="3"
          fill={tendance === 'baisse' ? '#9cff57' : '#f87171'}
        />
      </svg>

      {/* Légende min/max */}
      <div className="flex justify-between mt-1">
        <span className="text-[9px] font-mono text-tertiaire">
          min {min.toFixed(2).replace('.', ',')} €
        </span>
        <span className="text-[9px] font-mono text-tertiaire">
          max {max.toFixed(2).replace('.', ',')} €
        </span>
      </div>
    </div>
  );
}
