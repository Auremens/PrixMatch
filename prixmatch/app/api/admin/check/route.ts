// app/api/admin/check/route.ts — Vérifie si l'utilisateur est admin
// Retourne { admin: true } si le cookie de session est valide, { admin: false } sinon

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifierCookieSession } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get('admin_session');
  if (!cookie) return NextResponse.json({ admin: false });
  const valide = await verifierCookieSession(cookie.value);
  return NextResponse.json({ admin: valide });
}
