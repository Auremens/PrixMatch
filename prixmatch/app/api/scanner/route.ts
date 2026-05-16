// app/api/scanner/route.ts — Proxy API Claude Vision pour l'analyse de tickets
// L'appel est fait côté serveur pour protéger la clé API

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { base64, type } = await request.json() as { base64: string; type: string };

    if (!base64) {
      return NextResponse.json({ erreur: 'Image manquante' }, { status: 400 });
    }

    const reponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: type || 'image/jpeg', data: base64 }
            },
            {
              type: 'text',
              text: `Analyse ce ticket de caisse et extrais les produits achetés.
Réponds UNIQUEMENT en JSON valide, sans texte avant ou après, dans ce format exact :
{
  "enseigne": "nom de l'enseigne si visible, sinon null",
  "produits": [
    { "nom": "nom du produit", "prix": 1.99 },
    { "nom": "autre produit", "prix": 0.89 }
  ]
}
Règles :
- Inclure uniquement les produits avec un prix clairement lisible
- Ne pas inclure : total, sous-total, TVA, remises, avoir, fidélité, CB, espèces
- Le prix doit être un nombre décimal (ex: 1.99)
- Noms de produits tels qu'ils apparaissent sur le ticket`
            }
          ]
        }]
      })
    });

    if (!reponse.ok) {
      const errDetail = await reponse.text();
      console.error('Erreur Claude API:', reponse.status, errDetail);
      return NextResponse.json({ erreur: `API Claude : ${reponse.status}` }, { status: 502 });
    }

    const data = await reponse.json();
    const texte = data.content?.[0]?.text ?? '';
    const jsonMatch = texte.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ erreur: 'Réponse non parseable' }, { status: 500 });
    }

    return NextResponse.json(JSON.parse(jsonMatch[0]));

  } catch (e) {
    console.error('Erreur scanner route:', e);
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 });
  }
}
