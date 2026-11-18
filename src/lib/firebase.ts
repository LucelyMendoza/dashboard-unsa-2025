import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { FIREBASE_CONFIG } from './firebase-config';

const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);

export const firebaseApp = app;
export const firebaseAuth = getAuth(app);

/**
 * Token que el importador local (/api/admin/import) verifica en `requireAdmin`.
 */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}
