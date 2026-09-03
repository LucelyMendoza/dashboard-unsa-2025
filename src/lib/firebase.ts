import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { FIREBASE_CONFIG } from './firebase-config';

const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);

export const firebaseApp = app;
export const firebaseAuth = getAuth(app);

/**
 * Token que el backend (/api/admin/import) verifica en `requireAdmin` — sin
 * esto, el rol ADMIN solo existía en localStorage y era falsificable desde
 * la consola del navegador.
 */
export async function getIdToken(): Promise<string | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}
