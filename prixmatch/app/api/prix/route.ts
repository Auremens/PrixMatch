// app/api/prix/route.ts — GET (liste filtrée) + POST (nouvelle contribution)

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { storage } from '@/lib/storage';
import { verifierCookieSession } from '@/lib/admin-auth';
import type { Statut, Enseigne, Categorie, NouvelleEntree } from '@/lib/storage';

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

export async function POST(request: NextRequest) {
  try {
    const corps = await request.json();
    const { statut_force, ...entreeData } = corps as NouvelleEntree & { statut_force?: string };

    if (!entreeData.produit_nom_original?.trim()) {
      return NextResponse.json({ erreur: 'Nom du produit manquant' }, { status: 400 });
    }
    if (!entreeData.enseigne) {
      return NextResponse.json({ erreur: 'Enseigne manquante' }, { status: 400 });
    }
    if (typeof entreeData.prix_unitaire !== 'number' || entreeData.prix_unitaire <= 0) {
      return NextResponse.json({ erreur: 'Prix invalide' }, { status: 400 });
    }

    // Vérifier si l'admin demande une validation directe
    let validerDirectement = false;
    if (statut_force === 'validé') {
      const cookie = request.cookies.get('admin_session');
      if (cookie) {
        validerDirectement = await verifierCookieSession(cookie.value);
      }
    }

    const nouvelle = await storage.ajouter(entreeData as NouvelleEntree);

    // Si admin authentifié, valider directement
    if (validerDirectement) {
      const validee = await storage.mettreAJour(nouvelle.id, {
        statut: 'validé',
        date_moderation: new Date().toISOString(),
      });
      return NextResponse.json({ entree: validee }, { status: 201 });
    }

    return NextResponse.json({ entree: nouvelle }, { status: 201 });
  } catch (e) {
    console.error('POST /api/prix:', e);
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}
