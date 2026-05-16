// app/api/prix/route.ts — GET (liste filtrée) + POST (nouvelle contribution)

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { storage } from '@/lib/storage';
import type { Statut, Enseigne, Categorie, NouvelleEntree } from '@/lib/storage';

// GET /api/prix?statut=validé&enseigne=Lidl&categorie=boissons
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statut = searchParams.get('statut') as Statut | null;
    const enseigne = searchParams.get('enseigne') as Enseigne | null;
    const categorie = searchParams.get('categorie') as Categorie | null;

    const entrees = await storage.lister({
      statut: statut ?? undefined,
      enseigne: enseigne ?? undefined,
      categorie: categorie ?? undefined,
    });

    return NextResponse.json({ entrees, total: entrees.length });
  } catch (e) {
    console.error('GET /api/prix:', e);
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/prix — Soumettre une nouvelle contribution
export async function POST(request: NextRequest) {
  try {
    const corps = await request.json() as NouvelleEntree;

    // Validation minimale
    if (!corps.produit_nom_original?.trim()) {
      return NextResponse.json({ erreur: 'Nom du produit manquant' }, { status: 400 });
    }
    if (!corps.enseigne) {
      return NextResponse.json({ erreur: 'Enseigne manquante' }, { status: 400 });
    }
    if (typeof corps.prix_unitaire !== 'number' || corps.prix_unitaire <= 0) {
      return NextResponse.json({ erreur: 'Prix invalide' }, { status: 400 });
    }

    const nouvelle = await storage.ajouter(corps);
    return NextResponse.json({ entree: nouvelle }, { status: 201 });
  } catch (e) {
    console.error('POST /api/prix:', e);
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}
