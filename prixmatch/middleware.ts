// middleware.ts — Protection de /admin uniquement
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Laisser passer la page de login et l'API de login sans vérification
  if (pathname === '/admin/login' || pathname === '/api/admin/login') {
    return NextResponse.next();
  }

  // Protéger uniquement les routes /admin/* et /api/admin/*
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const cookie = request.cookies.get('admin_session');

    if (!cookie) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    // Vérification de la signature — si ADMIN_SECRET absent, bloquer quand même
    try {
      const secret = process.env.ADMIN_SECRET ?? '';
      const [payload, signature] = cookie.value.split(/\.(?=[^.]+$)/);
      
      if (!payload || !signature) {
        return NextResponse.redirect(new URL('/admin/login', request.url));
      }

      const encoder = new TextEncoder();
      const cle = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      const sigBytes = new Uint8Array(
        signature.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
      );

      const estValide = await crypto.subtle.verify(
        'HMAC',
        cle,
        sigBytes,
        encoder.encode(payload)
      );

      if (!estValide) {
        const rep = NextResponse.redirect(new URL('/admin/login', request.url));
        rep.cookies.delete('admin_session');
        return rep;
      }

      // Vérifier l'expiration
      const [, expirationStr] = payload.split(':');
      if (!expirationStr || Date.now() >= parseInt(expirationStr, 10)) {
        return NextResponse.redirect(new URL('/admin/login', request.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // Toutes les autres routes passent librement
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
