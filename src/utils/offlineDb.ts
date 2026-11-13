import type { VaultItem } from '@/src/types/vault';

const DB_NAME = 'aethelvault_offline_db';
const DB_VERSION = 2;
const STORE_NAME = 'vault_state';

function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function clearLegacySeedFromIndexedDB(): Promise<void> {
  try {
    const db = await openVaultDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete('current-vault');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore IDB errors
  }
}

export async function saveVaultSnapshotToIndexedDB(
  items: VaultItem[],
  userUid?: string
): Promise<void> {
  if (!userUid) return;
  try {
    const db = await openVaultDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(
        { items, syncedAt: new Date().toISOString() },
        `vault-user-${userUid}`
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback to localStorage if IDB is unavailable
  }
}

export async function loadVaultSnapshotFromIndexedDB(
  userUid?: string
): Promise<{ items: VaultItem[]; syncedAt: string } | null> {
  if (!userUid) return null;
  try {
    const db = await openVaultDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(`vault-user-${userUid}`);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}
