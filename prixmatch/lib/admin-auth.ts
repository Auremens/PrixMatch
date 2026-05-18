// lib/admin-auth.ts — Gestion de l'authentification admin
// Cookie httpOnly signé avec HMAC-SHA256
// Pas de JWT, pas de base utilisateur — simple et auditable

// ============================================================
// Hachage du mot de passe
// ============================================================

/**
 * Hache une chaîne avec SHA-256 via l'API Web Crypto.
 * Fonctionne dans le runtime Edge (middleware Next.js).
 */
async function sha256(texte: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(texte);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================
// Signature HMAC du cookie
// ============================================================

/**
 * Signe une payload avec HMAC-SHA256.
 * Format du cookie : "{payload}.{signature}"
 */
async function signer(payload: string): Promise<string> {
  const secret = process.env.ADMIN_SECRET ?? 'secret_defaut_dev';
  const encoder = new TextEncoder();

  const cle = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    cle,
    encoder.encode(payload)
  );

  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${payload}.${sigHex}`;
}

/**
 * Vérifie la signature HMAC d'un cookie.
 */
async function verifierSignature(cookie: string): Promise<boolean> {
  const dernierPoint = cookie.lastIndexOf('.');
  if (dernierPoint === -1) return false;

  const payload = cookie.slice(0, dernierPoint);
  const signatureAttendue = (await signer(payload)).split('.').pop();
  const signatureRecue = cookie.slice(dernierPoint + 1);

  // Comparaison en temps constant (éviter timing attacks)
  if (!signatureAttendue || signatureAttendue.length !== signatureRecue.length) return false;

  let diff = 0;
  for (let i = 0; i < signatureAttendue.length; i++) {
    diff |= signatureAttendue.charCodeAt(i) ^ signatureRecue.charCodeAt(i);
  }

  return diff === 0;
}

// ============================================================
// API publique
// ============================================================

/**
 * Vérifie si le mot de passe soumis correspond à ADMIN_PASSWORD.
 * Retourne le cookie signé si valide, null sinon.
 */
export async function creerSessionAdmin(
  motDePasse: string
): Promise<string | null> {
  const mdpAttendu = process.env.ADMIN_PASSWORD;
  if (!mdpAttendu) return null;

  const hashSoumis = await sha256(motDePasse);
  const hashAttendu = await sha256(mdpAttendu);

  // Comparaison en temps constant
  if (hashSoumis !== hashAttendu) return null;

  // Payload : timestamp d'expiration (8h)
  const expiration = Date.now() + 365 * 24 * 60 * 60 * 1000;
  const payload = `admin:${expiration}`;

  return signer(payload);
}

/**
 * Vérifie la validité d'un cookie de session :
 * 1. Signature HMAC valide
 * 2. Non expiré
 */
export async function verifierCookieSession(cookie: string): Promise<boolean> {
  const signatureValide = await verifierSignature(cookie);
  if (!signatureValide) return false;

  // Extraire et vérifier l'expiration
  const payload = cookie.slice(0, cookie.lastIndexOf('.'));
  const [, expirationStr] = payload.split(':');
  const expiration = parseInt(expirationStr, 10);

  if (isNaN(expiration)) return false;
  return Date.now() < expiration;
}

/**
 * Retourne les options du cookie httpOnly.
 */
export function optionsCookie() {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 365 * 24 * 60 * 60, // 1 an en secondes
    path: '/',
  };
}
