// middleware.ts — Intercepte toutes les requêtes vers /admin/*
// Vérifie la présence et la validité du cookie de session signé
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifierCookieSession } from './lib/admin-auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Laisser passer la page de login et l'API de login
  if (pathname === '/admin/login' || pathname === '/api/admin/login') {
    return NextResponse.next();
  }

  // Toutes les autres routes /admin/* nécessitent une session valide
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const cookie = request.cookies.get('admin_session');

    // Cookie absent → redirection vers login
    if (!cookie) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    // Cookie présent mais signature invalide → redirection
    const estValide = await verifierCookieSession(cookie.value);
    if (!estValide) {
      const reponse = NextResponse.redirect(new URL('/admin/login', request.url));
      reponse.cookies.delete('admin_session');
      return reponse;
    }
  }

  return NextResponse.next();
}

// Appliquer le middleware uniquement aux routes admin
export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
