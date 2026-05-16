// app/api/prix/[id]/route.ts — GET / PUT / DELETE sur une entrée spécifique

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { storage } from '@/lib/storage';

interface Params { params: { id: string } }

// GET /api/prix/:id
export async function GET(_: NextRequest, { params }: Params) {
  try {
    const entree = await storage.obtenir(params.id);
    if (!entree) return NextResponse.json({ erreur: 'Introuvable' }, { status: 404 });
    return NextResponse.json({ entree });
  } catch {
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}

// PUT /api/prix/:id — Mise à jour partielle (admin uniquement via middleware)
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const modifications = await request.json();
    const mise_a_jour = await storage.mettreAJour(params.id, modifications);
    if (!mise_a_jour) return NextResponse.json({ erreur: 'Introuvable' }, { status: 404 });
    return NextResponse.json({ entree: mise_a_jour });
  } catch {
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE /api/prix/:id — Suppression (admin uniquement)
export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const supprimee = await storage.supprimer(params.id);
    if (!supprimee) return NextResponse.json({ erreur: 'Introuvable' }, { status: 404 });
    return NextResponse.json({ message: 'Supprimé' });
  } catch {
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}
