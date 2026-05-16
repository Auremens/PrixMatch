'use client';
// app/admin/page.tsx — Dashboard admin avec contribution directe

import { useState, useEffect, useCallback } from 'react';
import AdminTable from '@/components/AdminTable';
import ContributionForm from '@/components/ContributionForm';
import type { EntreePrix } from '@/lib/storage';

type Onglet = 'moderation' | 'contribuer' | 'gestion';

export default function PageAdmin() {
  const [enAttente, setEnAttente] = useState<EntreePrix[]>([]);
  const [stats, setStats] = useState({ attente: 0, valide: 0, rejete: 0 });
  const [chargement, setChargement] = useState(true);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [onglet, setOnglet] = useState<Onglet>('moderation');

  const chargerDonnees = useCallback(async () => {
    setChargement(true);
    try {
      const [resAttente, resValide, resRejete] = await Promise.all([
        fetch('/api/prix?statut=en_attente'),
        fetch('/api/prix?statut=validé'),
        fetch('/api/prix?statut=rejeté'),
      ]);
      const [dataAttente, dataValide, dataRejete] = await Promise.all([
        resAttente.json(), resValide.json(), resRejete.json(),
      ]);
      setEnAttente(dataAttente.entrees ?? []);
      setStats({
        attente: dataAttente.entrees?.length ?? 0,
        valide: dataValide.entrees?.length ?? 0,
        rejete: dataRejete.entrees?.length ?? 0,
      });
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { chargerDonnees(); }, [chargerDonnees]);

  const exporterCSV = async () => {
    setExportEnCours(true);
    try {
      const reponse = await fetch('/api/admin/export');
      const csv = await reponse.text();
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prixmatch_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportEnCours(false);
    }
  };

  const deconnexion = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' });
    window.location.href = '/admin/login';
  };

  return (
    <div className="px-4 pt-8 pb-8 space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-800 text-2xl text-texte">Dashboard</h1>
          <p className="text-secondaire text-xs mt-1">Administration PrixMatch</p>
        </div>
        <button type="button" onClick={deconnexion} className="text-tertiaire text-xs font-display hover:text-erreur transition-colors">
          Déconnexion
        </button>
      </div>

      {/* Compteurs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'En attente', valeur: stats.attente, couleur: 'text-attente', bg: 'bg-attente/10' },
          { label: 'Validés', valeur: stats.valide, couleur: 'text-succes', bg: 'bg-succes/10' },
          { label: 'Rejetés', valeur: stats.rejete, couleur: 'text-erreur', bg: 'bg-erreur/10' },
        ].map((stat) => (
          <div key={stat.label} className={`carte p-3 text-center ${stat.bg}`}>
            <p className={`font-mono font-500 text-2xl ${stat.couleur}`}>{stat.valeur}</p>
            <p className="text-tertiaire text-[10px] font-display uppercase tracking-wider mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Onglets */}
      <div className="flex gap-2">
        {([
          { id: 'moderation', label: 'Modération' },
          { id: 'contribuer', label: '+ Ajouter un prix' },
          { id: 'gestion', label: 'Gestion' },
        ] as { id: Onglet; label: string }[]).map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setOnglet(o.id)}
            className={`px-4 py-2 rounded-xl text-xs font-display font-600 transition-all ${
              onglet === o.id ? 'bg-accent text-black' : 'bg-carte border border-bord text-secondaire hover:border-accent hover:text-accent'
            }`}
          >
            {o.label}
            {o.id === 'moderation' && stats.attente > 0 && (
              <span className="ml-2 bg-attente text-black text-[10px] px-1.5 py-0.5 rounded-full font-700">
                {stats.attente}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contenu selon onglet */}
      {onglet === 'moderation' && (
        <div>
          <h2 className="font-display font-700 text-sm uppercase tracking-wider text-secondaire mb-3">
            File de modération
          </h2>
          {chargement ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-24 rounded-2xl" />
              ))}
            </div>
          ) : (
            <AdminTable entrees={enAttente} onMiseAJour={chargerDonnees} />
          )}
        </div>
      )}

      {onglet === 'contribuer' && (
        <div>
          <h2 className="font-display font-700 text-sm uppercase tracking-wider text-secondaire mb-3">
            Ajouter un prix (validé directement)
          </h2>
          <ContributionForm modeAdmin={true} />
        </div>
      )}

      {onglet === 'gestion' && (
        <div className="space-y-3">
          <h2 className="font-display font-700 text-sm uppercase tracking-wider text-secondaire mb-3">
            Gestion
          </h2>
          <button
            type="button"
            className="btn-secondaire w-full flex items-center justify-center gap-2"
            onClick={exporterCSV}
            disabled={exportEnCours}
          >
            {exportEnCours ? '⟳ Export…' : '↓ Exporter la base (CSV)'}
          </button>
        </div>
      )}
    </div>
  );
}
