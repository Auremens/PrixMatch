// app/api/admin/login/route.ts — Connexion (POST) et déconnexion (DELETE)

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { creerSessionAdmin, optionsCookie } from '@/lib/admin-auth';

// POST /api/admin/login — Vérifier le mot de passe et créer la session
export async function POST(request: NextRequest) {
  try {
    const { motDePasse } = await request.json() as { motDePasse: string };

    if (!motDePasse) {
      return NextResponse.json({ erreur: 'Mot de passe manquant' }, { status: 400 });
    }

    const cookieValue = await creerSessionAdmin(motDePasse);

    if (!cookieValue) {
      // Délai artificiel pour décourager le brute-force
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json({ erreur: 'Mot de passe incorrect' }, { status: 401 });
    }

    // Créer la réponse avec le cookie de session
    const reponse = NextResponse.json({ message: 'Connecté' });
    reponse.cookies.set('admin_session', cookieValue, optionsCookie());

    return reponse;
  } catch {
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE /api/admin/login — Déconnexion (suppression du cookie)
export async function DELETE() {
  const reponse = NextResponse.json({ message: 'Déconnecté' });
  reponse.cookies.delete('admin_session');
  return reponse;
}
