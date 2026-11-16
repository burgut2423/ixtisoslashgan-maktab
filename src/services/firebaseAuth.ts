import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
} from 'firebase/auth';
import type { Auth, User } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
] as const;

let auth: Auth | null = null;
let db: Firestore | null = null;

try {
  const app =
    getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  const databaseId = (firebaseConfig as { firestoreDatabaseId?: string })
    .firestoreDatabaseId;
  db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
} catch {
  auth = null;
  db = null;
}

export { auth, db };

async function testFirestoreConnection(): Promise<void> {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testFirestoreConnection();

const provider = new GoogleAuthProvider();
for (const scope of WORKSPACE_SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: 'consent select_account',
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const FIREBASE_AUTH_SETTINGS_URL = firebaseConfig.projectId
  ? `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`
  : 'https://console.firebase.google.com/';

function mapFirebaseAuthError(err: unknown): Error {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  const msg = err instanceof Error ? err.message : String(err || '');
  const combined = `${code} ${msg}`.toLowerCase();
  const host = typeof window !== 'undefined' ? window.location.hostname : '';

  if (combined.includes('unauthorized-domain')) {
    return new Error(
      `Ushbu domen (${host}) Firebase ruxsat etilgan domenlar ro‘yxatiga kiritilmagan (auth/unauthorized-domain). Firebase Console → Authentication → Settings → Authorized domains bo‘limiga "${host}" ni qo‘shing.`
    );
  }
  if (combined.includes('popup-blocked')) {
    return new Error(
      'Brauzer Google kirish oynasini (popup) blokladi. Brauzer manzil satridan popup oynalarga ruxsat bering.'
    );
  }
  if (combined.includes('popup-closed-by-user')) {
    return new Error('Google kirish oynasi foydalanuvchi tomonidan yopildi.');
  }
  if (combined.includes('cancelled-popup-request')) {
    return new Error('Kirish so‘rovi bekor qilindi. Qaytadan urinib ko‘ring.');
  }
  if (combined.includes('operation-not-allowed')) {
    return new Error(
      'Firebase loyihada Google Sign-In provayderi yoqilmagan. Firebase Console → Authentication → Sign-in method dan Google ni yoqing.'
    );
  }
  if (combined.includes('network-request-failed')) {
    return new Error(
      'Tarmoq xatoligi: Google autentifikatsiya serveriga ulanib bo‘lmadi.'
    );
  }
  return err instanceof Error
    ? err
    : new Error('Google orqali kirishda kutilmagan xatolik yuz berdi');
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void
) => {
  if (!auth) {
    onAuthFailure?.(null);
    return () => {};
  }
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure(user);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure(null);
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  if (!auth) {
    throw new Error(
      'Firebase konfiguratsiyasi ulanmagan. firebase-applet-config.json ni tekshiring.'
    );
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || '';
    cachedAccessToken = token || null;
    return { user: result.user, accessToken: token };
  } catch (err) {
    throw mapFirebaseAuthError(err);
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const getCurrentUser = (): User | null => {
  return auth?.currentUser ?? null;
};

export const logout = async (): Promise<void> => {
  if (auth) {
    await auth.signOut();
  }
  cachedAccessToken = null;
};
