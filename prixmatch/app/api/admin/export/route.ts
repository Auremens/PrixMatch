// app/api/admin/export/route.ts — Export CSV de toute la base

import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';

export async function GET() {
  try {
    const csv = await storage.exporterCSV();
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="prixmatch_${new Date().toISOString().slice(0,10)}.csv"`,
      },
    });
  } catch {
    return NextResponse.json({ erreur: 'Erreur export' }, { status: 500 });
  }
}
