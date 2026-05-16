// app/api/admin/rejeter/route.ts — Rejet de contributions

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { storage } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json() as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ erreur: 'Liste d\'IDs manquante' }, { status: 400 });
    }

    const resultats = await Promise.all(
      ids.map((id) =>
        storage.mettreAJour(id, {
          statut: 'rejeté',
          date_moderation: new Date().toISOString(),
        })
      )
    );

    const rejetees = resultats.filter(Boolean).length;
    return NextResponse.json({ rejetees });
  } catch {
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}
