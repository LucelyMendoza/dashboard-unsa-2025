import { jwtVerify, createRemoteJWKSet } from 'jose';
import { isAdminEmail } from '@/lib/roles';
import { FIREBASE_CONFIG } from '@/lib/firebase-config';

/**
 * Verifica el ID token de Firebase Auth en el backend (runtime de Cloudflare
 * Workers vía opennextjs-cloudflare), SIN el Admin SDK — que requiere una
 * service account y no corre bien en Workers. En su lugar se valida la firma
 * contra las llaves públicas de Google (JWKS) y se revisan `aud`/`iss`/`exp`,
 * igual que hace el Admin SDK por debajo.
 *
 * Esto es lo que hoy falta: la ruta actual de carga de Excel confía en el rol
 * guardado en localStorage del navegador, que cualquiera puede editar. Con
 * esto, el rol se re-verifica en el servidor contra ADMIN_EMAILS antes de
 * tocar D1.
 */
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireAdmin(request: Request): Promise<{ email: string }> {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) throw new AuthError('Falta el token de sesión (Authorization: Bearer <idToken>).', 401);

  let payload;
  try {
    const result = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_CONFIG.projectId}`,
      audience: FIREBASE_CONFIG.projectId,
    });
    payload = result.payload;
  } catch {
    throw new AuthError('Token inválido o expirado.', 401);
  }

  const email = typeof payload.email === 'string' ? payload.email.toLowerCase().trim() : '';
  if (!email || payload.email_verified !== true) {
    throw new AuthError('El token no tiene un correo verificado.', 403);
  }
  if (!isAdminEmail(email)) {
    throw new AuthError('Este correo no tiene rol ADMIN.', 403);
  }
  return { email };
}
