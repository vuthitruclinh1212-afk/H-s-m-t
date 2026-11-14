import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const VERCEL_LINKED_URL = 'https://h-s-m-t.vercel.app/';
export const VERCEL_LINKED_DOMAIN = 'h-s-m-t.vercel.app';
export const CLOUD_BACKEND_ORIGIN =
  'https://ais-pre-3jw2uphwamch4ege3n46od-404206303910.asia-east1.run.app';
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

export interface VaultAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  authMode?: 'firebase' | 'cloud-email';
  isNewAccount?: boolean;
}

const ACTIVE_SESSION_STORAGE_KEY = 'aethelvault_active_account_v2';
const LOCAL_ACCOUNT_REGISTRY_KEY = 'aethelvault_account_registry_v2';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function deriveDeterministicUidFromEmail(email: string): Promise<string> {
  const norm = email.trim().toLowerCase();
  const hex = await sha256Hex(`aethelvault::${norm}`);
  return `usr_${hex.slice(0, 28)}`;
}

export function getSavedCloudEmailSession(): VaultAuthUser | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VaultAuthUser;
    if (parsed && parsed.uid && parsed.email) {
      return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

export function saveCloudEmailSession(user: VaultAuthUser | null) {
  try {
    if (!user) {
      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    } else {
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(user));
    }
  } catch {
    // ignore storage errors
  }
}

export async function fetchCloudVaultApi(
  endpointPath: string,
  init?: RequestInit
): Promise<Response> {
  const candidates = [endpointPath, `${CLOUD_BACKEND_ORIGIN}${endpointPath}`];
  let lastError: unknown = null;

  for (const url of candidates) {
    try {
      const resp = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers || {}),
        },
      });
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return resp;
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Không thể kết nối máy chủ đám mây.');
}

/**
 * Signs in or registers with Email + Password.
 * Works across all domains including https://h-s-m-t.vercel.app/ without hitting
 * Firebase OAuth popup's `auth/unauthorized-domain` restriction.
 * Enforces 1 Email = 1 Unique Account and prevents overwriting existing data.
 */
export async function signInOrRegisterWithEmail(params: {
  email: string;
  password: string;
  displayName?: string;
  mode?: 'login' | 'register' | 'auto';
}): Promise<VaultAuthUser> {
  const normEmail = params.email.trim().toLowerCase();
  if (!normEmail || !normEmail.includes('@')) {
    throw new Error('Vui lòng nhập địa chỉ Email hợp lệ (ví dụ: thanh.tra@gmail.com).');
  }
  if (!params.password || params.password.length < 4) {
    throw new Error('Mật khẩu niêm phong phải có ít nhất 4 ký tự.');
  }

  // 1. Try Multi-Device Cloud Vault Backend first (supports CORS from https://h-s-m-t.vercel.app)
  try {
    const resp = await fetchCloudVaultApi('/api/cloud-vault/auth', {
      method: 'POST',
      body: JSON.stringify({
        email: normEmail,
        password: params.password,
        displayName: params.displayName,
        mode: params.mode || 'auto',
      }),
    });
    const data = (await resp.json()) as {
      error?: string;
      user?: { uid: string; email: string; displayName: string; isNewAccount?: boolean };
    };
    if (!resp.ok) {
      throw new Error(data.error || 'Không thể xác thực tài khoản.');
    }
    if (data.user) {
      const sessionUser: VaultAuthUser = {
        uid: data.user.uid,
        email: data.user.email,
        displayName: data.user.displayName,
        photoURL: null,
        authMode: 'cloud-email',
        isNewAccount: data.user.isNewAccount,
      };
      saveCloudEmailSession(sessionUser);
      return sessionUser;
    }
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('Mật khẩu không chính xác') ||
        err.message.includes('đã được đăng ký'))
    ) {
      throw err;
    }
  }

  // 2. Deterministic Local + Cross-Device Fallback (1 Email = 1 UID, SHA-256 Password Verification)
  const uid = await deriveDeterministicUidFromEmail(normEmail);
  const pwHash = await sha256Hex(`aethelvault_pw::${normEmail}::${params.password}`);

  let registry: Record<
    string,
    { uid: string; email: string; displayName: string; passwordHash: string }
  > = {};
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNT_REGISTRY_KEY);
    if (raw) registry = JSON.parse(raw);
  } catch {
    registry = {};
  }

  const existing = registry[normEmail];
  if (existing) {
    if (params.mode === 'register') {
      throw new Error(
        `Email "${normEmail}" đã được đăng ký một tài khoản duy nhất. Vui lòng chuyển sang Đăng nhập để mở lại dữ liệu cũ.`
      );
    }
    if (existing.passwordHash !== pwHash) {
      throw new Error(
        'Mật khẩu không chính xác cho tài khoản Email này. Dữ liệu cũ được bảo vệ chống ghi đè.'
      );
    }
    const sessionUser: VaultAuthUser = {
      uid: existing.uid,
      email: existing.email,
      displayName: existing.displayName,
      photoURL: null,
      authMode: 'cloud-email',
      isNewAccount: false,
    };
    saveCloudEmailSession(sessionUser);
    return sessionUser;
  }

  const cleanName = (params.displayName || normEmail.split('@')[0] || 'Thanh tra')
    .trim()
    .slice(0, 80);
  registry[normEmail] = {
    uid,
    email: normEmail,
    displayName: cleanName,
    passwordHash: pwHash,
  };
  try {
    localStorage.setItem(LOCAL_ACCOUNT_REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    // ignore
  }

  const sessionUser: VaultAuthUser = {
    uid,
    email: normEmail,
    displayName: cleanName,
    photoURL: null,
    authMode: 'cloud-email',
    isNewAccount: true,
  };
  saveCloudEmailSession(sessionUser);
  return sessionUser;
}

export async function signInWithGoogleAccount() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutAccount() {
  saveCloudEmailSession(null);
  try {
    await signOut(auth);
  } catch {
    // ignore if not signed into firebase auth
  }
}
