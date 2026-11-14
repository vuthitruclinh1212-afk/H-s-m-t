import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  fetchCloudVaultApi,
  handleFirestoreError,
  OperationType,
  type VaultAuthUser,
} from '@/src/firebase';
import type {
  CanvasConnection,
  CanvasNodePos,
  CollaborativeComment,
  DashboardWidget,
  HabitProfile,
  VaultItem,
} from '@/src/types/vault';
import { INITIAL_HABITS, INITIAL_WIDGETS } from '@/src/data/seedVault';
import { loadVaultSnapshotFromIndexedDB } from '@/src/utils/offlineDb';

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
  return cleaned || 'id-1';
}

function clampStr(val: string | undefined, max: number, fallback = ''): string {
  if (!val) return fallback;
  return val.slice(0, max);
}

function clampStringList(list: string[] | undefined, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((s) => typeof s === 'string' && s.trim().length > 0)
    .slice(0, maxItems)
    .map((s) => s.slice(0, maxLen));
}

export interface HydratedUserVaultMeta {
  habits: HabitProfile;
  widgets: DashboardWidget[];
}

function getLocalMetaKey(uid: string): string {
  return `aethelvault_meta_${uid}`;
}

function getLocalItemsKey(uid: string): string {
  return `aethelvault_items_${uid}`;
}

function getLocalCommentsKey(uid: string): string {
  return `aethelvault_comments_${uid}`;
}

function isFirebaseAuthenticated(uid: string): boolean {
  return Boolean(auth.currentUser && auth.currentUser.uid === uid);
}

function parseHydratedMeta(d: Record<string, unknown>): HydratedUserVaultMeta {
  const earnedSet = new Set<string>(
    Array.isArray(d.earnedBadgeIds) ? (d.earnedBadgeIds as string[]) : []
  );
  const hiddenSet = new Set<string>(
    Array.isArray(d.hiddenWidgetIds) ? (d.hiddenWidgetIds as string[]) : []
  );

  const habits: HabitProfile = {
    expPoints: typeof d.expPoints === 'number' ? d.expPoints : 0,
    level: typeof d.level === 'number' ? d.level : 1,
    streakDays: typeof d.streakDays === 'number' ? d.streakDays : 1,
    readingMinutesToday: typeof d.readingMinutesToday === 'number' ? d.readingMinutesToday : 0,
    dailyGoalMinutes: typeof d.dailyGoalMinutes === 'number' ? d.dailyGoalMinutes : 60,
    badges: INITIAL_HABITS.badges.map((b) => ({
      ...b,
      earned: earnedSet.has(b.id),
    })),
  };

  const widgets: DashboardWidget[] = INITIAL_WIDGETS.map((w) => ({
    ...w,
    visible: !hiddenSet.has(w.id),
  }));

  return { habits, widgets };
}

/**
 * Ensures the user's root profile document exists WITHOUT overwriting
 * existing data when the user logs back into the same account on any device or domain.
 */
export async function ensureAndLoadUserVaultState(
  user: VaultAuthUser
): Promise<HydratedUserVaultMeta> {
  const uid = user.uid;

  // 1. If authenticated via Firebase Auth, use Firestore primary + Cloud API mirror
  if (isFirebaseAuthenticated(uid)) {
    const userPath = `users/${uid}`;
    const userRef = doc(db, 'users', uid);

    let snap;
    try {
      try {
        snap = await getDocFromServer(userRef);
      } catch {
        snap = await getDoc(userRef);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, userPath);
    }

    if (snap && snap.exists()) {
      return parseHydratedMeta(snap.data() as Record<string, unknown>);
    }

    const displayName = clampStr(
      user.displayName || user.email?.split('@')[0] || 'Thanh tra',
      120,
      'Thanh tra'
    );
    try {
      await setDoc(userRef, {
        ownerId: uid,
        displayName,
        expPoints: 0,
        level: 1,
        streakDays: 1,
        readingMinutesToday: 0,
        dailyGoalMinutes: 60,
        earnedBadgeIds: [],
        hiddenWidgetIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }

    return {
      habits: { ...INITIAL_HABITS, streakDays: 1 },
      widgets: INITIAL_WIDGETS,
    };
  }

  // 2. Domain-independent Cloud Vault API (works on https://h-s-m-t.vercel.app/ and all browsers)
  try {
    const q = new URLSearchParams({
      email: user.email || '',
      displayName: user.displayName || '',
    });
    const resp = await fetchCloudVaultApi(`/api/cloud-vault/snapshot/${encodeURIComponent(uid)}?${q.toString()}`);
    if (resp.ok) {
      const data = (await resp.json()) as { meta?: Record<string, unknown> };
      if (data.meta) {
        try {
          localStorage.setItem(getLocalMetaKey(uid), JSON.stringify(data.meta));
        } catch {
          // ignore
        }
        return parseHydratedMeta(data.meta);
      }
    }
  } catch {
    // Fallback to per-account local storage if offline
  }

  try {
    const raw = localStorage.getItem(getLocalMetaKey(uid));
    if (raw) {
      return parseHydratedMeta(JSON.parse(raw) as Record<string, unknown>);
    }
  } catch {
    // ignore
  }

  return {
    habits: { ...INITIAL_HABITS, streakDays: 1 },
    widgets: INITIAL_WIDGETS,
  };
}

export async function saveUserVaultMetaToCloud(
  user: VaultAuthUser,
  habits: HabitProfile,
  widgets: DashboardWidget[]
): Promise<void> {
  const uid = user.uid;
  const displayName = clampStr(
    user.displayName || user.email?.split('@')[0] || 'Thanh tra',
    120,
    'Thanh tra'
  );
  const earnedBadgeIds = clampStringList(
    habits.badges.filter((b) => b.earned).map((b) => b.id),
    10,
    64
  );
  const hiddenWidgetIds = clampStringList(
    widgets.filter((w) => !w.visible).map((w) => w.id),
    10,
    64
  );

  const metaPayload = {
    displayName,
    expPoints: Math.max(0, Math.min(10000000, Math.round(habits.expPoints))),
    level: Math.max(1, Math.min(10000, Math.round(habits.level))),
    streakDays: Math.max(0, Math.min(100000, Math.round(habits.streakDays))),
    readingMinutesToday: Math.max(0, Math.min(14400, Math.round(habits.readingMinutesToday))),
    dailyGoalMinutes: Math.max(1, Math.min(1440, Math.round(habits.dailyGoalMinutes))),
    earnedBadgeIds,
    hiddenWidgetIds,
  };

  try {
    localStorage.setItem(getLocalMetaKey(uid), JSON.stringify(metaPayload));
  } catch {
    // ignore
  }

  if (isFirebaseAuthenticated(uid)) {
    const userPath = `users/${uid}`;
    const userRef = doc(db, 'users', uid);
    try {
      await updateDoc(userRef, {
        ...metaPayload,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, userPath);
    }
    return;
  }

  try {
    await fetchCloudVaultApi(`/api/cloud-vault/meta/${encodeURIComponent(uid)}`, {
      method: 'PUT',
      body: JSON.stringify(metaPayload),
    });
  } catch {
    // Already saved in per-account local cache
  }
}

export function serializeVaultItemForFirestore(
  uid: string,
  item: VaultItem,
  canvasPos?: CanvasNodePos
) {
  const cleanId = sanitizeId(item.id);
  const nowIso = new Date().toISOString();
  return {
    id: cleanId,
    ownerId: uid,
    workspaceId: ['personal', 'design-lab', 'engineering'].includes(item.workspaceId)
      ? item.workspaceId
      : 'personal',
    title: clampStr(item.title, 300, 'Hồ sơ chưa đặt tên'),
    type: [
      'pdf',
      'office_doc',
      'web_archive',
      'video',
      'audio',
      'note',
      'image',
      'model_3d',
    ].includes(item.type)
      ? item.type
      : 'note',
    smartFolder: clampStr(item.smartFolder, 120, 'Tất cả'),
    tags: clampStringList(item.tags, 10, 64),
    excerpt: clampStr(item.excerpt, 500, ''),
    content: clampStr(item.content, 200000, ''),
    sourceUrl: clampStr(item.sourceUrl, 2000, ''),
    coverImage: clampStr(item.coverImage, 500000, ''),
    mediaUrl: clampStr(item.mediaUrl, 500000, ''),
    pdfDataBase64: clampStr(item.pdfDataBase64, 700000, ''),
    ocrText: clampStr(item.ocrText, 100000, ''),
    aiSummary: clampStr(item.aiSummary, 50000, ''),
    fileSizeLabel: clampStr(item.fileSizeLabel, 60, '12 KB'),
    pageCount: Math.max(0, Math.min(10000, Math.round(item.pageCount ?? 0))),
    lastReadPage: Math.max(0, Math.min(10000, Math.round(item.lastReadPage ?? 1))),
    readProgressPct: Math.max(0, Math.min(100, Math.round(item.readProgressPct ?? 0))),
    pinned: Boolean(item.pinned),
    offlineCached: Boolean(item.offlineCached),
    onCanvas: Boolean(canvasPos),
    canvasX: canvasPos ? Math.max(-10000, Math.min(10000, Math.round(canvasPos.x))) : 120,
    canvasY: canvasPos ? Math.max(-10000, Math.min(10000, Math.round(canvasPos.y))) : 120,
    linkedIds: clampStringList(item.linkedIds, 10, 128),
    createdAtIso: clampStr(item.createdAt || nowIso, 40, nowIso),
    updatedAtIso: clampStr(item.updatedAt || nowIso, 40, nowIso),
  };
}

function saveItemInPerUserLocalStore(uid: string, payload: Record<string, unknown>) {
  try {
    const raw = localStorage.getItem(getLocalItemsKey(uid));
    const map: Record<string, Record<string, unknown>> = raw ? JSON.parse(raw) : {};
    map[String(payload.id)] = payload;
    localStorage.setItem(getLocalItemsKey(uid), JSON.stringify(map));
  } catch {
    // ignore quota error
  }
}

function deleteItemFromPerUserLocalStore(uid: string, itemId: string) {
  try {
    const raw = localStorage.getItem(getLocalItemsKey(uid));
    if (!raw) return;
    const map: Record<string, Record<string, unknown>> = JSON.parse(raw);
    delete map[itemId];
    localStorage.setItem(getLocalItemsKey(uid), JSON.stringify(map));
  } catch {
    // ignore
  }
}

export async function createVaultItemInCloud(
  uid: string,
  item: VaultItem,
  canvasPos?: CanvasNodePos
): Promise<void> {
  const cleanId = sanitizeId(item.id);
  const payload = serializeVaultItemForFirestore(uid, { ...item, id: cleanId }, canvasPos);
  saveItemInPerUserLocalStore(uid, payload);

  if (isFirebaseAuthenticated(uid)) {
    const path = `users/${uid}/items/${cleanId}`;
    const ref = doc(db, 'users', uid, 'items', cleanId);
    try {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
    return;
  }

  try {
    await fetchCloudVaultApi(
      `/api/cloud-vault/item/${encodeURIComponent(uid)}/${encodeURIComponent(cleanId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
  } catch {
    // Already persisted in per-user local store
  }
}

export async function updateVaultItemInCloud(
  uid: string,
  item: VaultItem,
  canvasPos?: CanvasNodePos
): Promise<void> {
  const cleanId = sanitizeId(item.id);
  const payload = serializeVaultItemForFirestore(uid, { ...item, id: cleanId }, canvasPos);
  saveItemInPerUserLocalStore(uid, payload);

  if (isFirebaseAuthenticated(uid)) {
    const path = `users/${uid}/items/${cleanId}`;
    const ref = doc(db, 'users', uid, 'items', cleanId);
    try {
      await updateDoc(ref, {
        workspaceId: payload.workspaceId,
        title: payload.title,
        type: payload.type,
        smartFolder: payload.smartFolder,
        tags: payload.tags,
        excerpt: payload.excerpt,
        content: payload.content,
        sourceUrl: payload.sourceUrl,
        coverImage: payload.coverImage,
        mediaUrl: payload.mediaUrl,
        pdfDataBase64: payload.pdfDataBase64,
        ocrText: payload.ocrText,
        aiSummary: payload.aiSummary,
        fileSizeLabel: payload.fileSizeLabel,
        pageCount: payload.pageCount,
        lastReadPage: payload.lastReadPage,
        readProgressPct: payload.readProgressPct,
        pinned: payload.pinned,
        offlineCached: payload.offlineCached,
        onCanvas: payload.onCanvas,
        canvasX: payload.canvasX,
        canvasY: payload.canvasY,
        linkedIds: payload.linkedIds,
        updatedAtIso: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    return;
  }

  try {
    await fetchCloudVaultApi(
      `/api/cloud-vault/item/${encodeURIComponent(uid)}/${encodeURIComponent(cleanId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
  } catch {
    // Already persisted in per-user local store
  }
}

export async function deleteVaultItemFromCloud(uid: string, itemId: string): Promise<void> {
  const cleanId = sanitizeId(itemId);
  deleteItemFromPerUserLocalStore(uid, cleanId);

  if (isFirebaseAuthenticated(uid)) {
    const path = `users/${uid}/items/${cleanId}`;
    try {
      await deleteDoc(doc(db, 'users', uid, 'items', cleanId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
    return;
  }

  try {
    await fetchCloudVaultApi(
      `/api/cloud-vault/item/${encodeURIComponent(uid)}/${encodeURIComponent(cleanId)}`,
      {
        method: 'DELETE',
      }
    );
  } catch {
    // Ignore network error if offline
  }
}

export async function createCommentInCloud(
  uid: string,
  comment: CollaborativeComment
): Promise<void> {
  const cleanId = sanitizeId(comment.id);
  const payload = {
    id: cleanId,
    ownerId: uid,
    itemId: sanitizeId(comment.itemId),
    author: clampStr(comment.author, 120, 'Thanh tra'),
    text: clampStr(comment.text, 2000, ''),
    createdAtIso: clampStr(comment.createdAt, 40, new Date().toISOString()),
  };

  try {
    const raw = localStorage.getItem(getLocalCommentsKey(uid));
    const map: Record<string, Record<string, unknown>> = raw ? JSON.parse(raw) : {};
    map[cleanId] = payload;
    localStorage.setItem(getLocalCommentsKey(uid), JSON.stringify(map));
  } catch {
    // ignore
  }

  if (isFirebaseAuthenticated(uid)) {
    const path = `users/${uid}/comments/${cleanId}`;
    try {
      await setDoc(doc(db, 'users', uid, 'comments', cleanId), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
    return;
  }

  try {
    await fetchCloudVaultApi(`/api/cloud-vault/comment/${encodeURIComponent(uid)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    // Ignore offline error
  }
}

function hydrateItemsAndCanvasFromRawDocs(
  rawDocs: Array<Record<string, unknown>>
): {
  loadedItems: VaultItem[];
  positions: Record<string, CanvasNodePos>;
  connections: CanvasConnection[];
} {
  const loadedItems: VaultItem[] = [];
  const positions: Record<string, CanvasNodePos> = {};
  const connections: CanvasConnection[] = [];

  rawDocs.forEach((d, idx) => {
    const id = String(d.id || `item-${idx}`);
    const item: VaultItem = {
      id,
      workspaceId: (d.workspaceId as VaultItem['workspaceId']) || 'personal',
      title: String(d.title || 'Hồ sơ chưa đặt tên'),
      type: (d.type as VaultItem['type']) || 'note',
      smartFolder: String(d.smartFolder || 'Tất cả'),
      tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
      excerpt: String(d.excerpt || ''),
      content: String(d.content || ''),
      sourceUrl: d.sourceUrl ? String(d.sourceUrl) : undefined,
      coverImage: d.coverImage ? String(d.coverImage) : undefined,
      mediaUrl: d.mediaUrl ? String(d.mediaUrl) : undefined,
      pdfDataBase64: d.pdfDataBase64 ? String(d.pdfDataBase64) : undefined,
      ocrText: d.ocrText ? String(d.ocrText) : undefined,
      aiSummary: d.aiSummary ? String(d.aiSummary) : undefined,
      fileSizeLabel: String(d.fileSizeLabel || '12 KB'),
      pageCount: typeof d.pageCount === 'number' ? d.pageCount : undefined,
      lastReadPage: typeof d.lastReadPage === 'number' ? d.lastReadPage : 1,
      readProgressPct: typeof d.readProgressPct === 'number' ? d.readProgressPct : 0,
      pinned: Boolean(d.pinned),
      offlineCached: Boolean(d.offlineCached),
      linkedIds: Array.isArray(d.linkedIds) ? (d.linkedIds as string[]) : [],
      annotations: [],
      versions: [],
      createdAt: String(d.createdAtIso || d.createdAt || new Date().toISOString()),
      updatedAt: String(d.updatedAtIso || d.updatedAt || new Date().toISOString()),
    };
    loadedItems.push(item);

    if (d.onCanvas) {
      positions[id] = {
        x: typeof d.canvasX === 'number' ? d.canvasX : 80 + (idx % 3) * 290,
        y: typeof d.canvasY === 'number' ? d.canvasY : 80 + Math.floor(idx / 3) * 260,
      };
    }
  });

  const seenPairs = new Set<string>();
  loadedItems.forEach((it) => {
    it.linkedIds.forEach((targetId) => {
      const pairKey = [it.id, targetId].sort().join('::');
      if (!seenPairs.has(pairKey)) {
        seenPairs.add(pairKey);
        connections.push({
          id: `conn-${pairKey}`,
          fromId: it.id,
          toId: targetId,
        });
      }
    });
  });

  loadedItems.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { loadedItems, positions, connections };
}

export function subscribeUserVaultItems(
  uid: string,
  onReceive: (
    items: VaultItem[],
    canvasPositions: Record<string, CanvasNodePos>,
    canvasConnections: CanvasConnection[]
  ) => void
) {
  if (isFirebaseAuthenticated(uid)) {
    const path = `users/${uid}/items`;
    const q = query(collection(db, 'users', uid, 'items'), where('ownerId', '==', uid));
    return onSnapshot(
      q,
      (snapshot) => {
        const rawDocs = snapshot.docs.map((docSnap) => docSnap.data() as Record<string, unknown>);
        const { loadedItems, positions, connections } = hydrateItemsAndCanvasFromRawDocs(rawDocs);
        onReceive(loadedItems, positions, connections);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  }

  // Cloud-Email Session Subscription (Syncs with Cloud Vault API + IndexedDB + LocalStorage)
  let active = true;

  const pullSnapshot = async () => {
    if (!active) return;
    try {
      const resp = await fetchCloudVaultApi(`/api/cloud-vault/snapshot/${encodeURIComponent(uid)}`);
      if (resp.ok) {
        const data = (await resp.json()) as {
          items?: Array<Record<string, unknown>>;
        };
        if (Array.isArray(data.items) && data.items.length > 0) {
          const map: Record<string, Record<string, unknown>> = {};
          data.items.forEach((it) => {
            if (it.id) map[String(it.id)] = it;
          });
          try {
            localStorage.setItem(getLocalItemsKey(uid), JSON.stringify(map));
          } catch {
            // ignore
          }
          const { loadedItems, positions, connections } = hydrateItemsAndCanvasFromRawDocs(
            data.items
          );
          if (active) onReceive(loadedItems, positions, connections);
          return;
        }
      }
    } catch {
      // Fallback to local / IndexedDB below
    }

    try {
      const raw = localStorage.getItem(getLocalItemsKey(uid));
      if (raw) {
        const map = JSON.parse(raw) as Record<string, Record<string, unknown>>;
        const list = Object.values(map);
        const { loadedItems, positions, connections } = hydrateItemsAndCanvasFromRawDocs(list);
        if (active) onReceive(loadedItems, positions, connections);
        return;
      }
    } catch {
      // ignore
    }

    const idbSnap = await loadVaultSnapshotFromIndexedDB(uid);
    if (active) {
      if (idbSnap && idbSnap.items.length > 0) {
        onReceive(idbSnap.items, {}, []);
      } else {
        onReceive([], {}, []);
      }
    }
  };

  pullSnapshot();

  return () => {
    active = false;
  };
}

export function subscribeUserVaultComments(
  uid: string,
  onReceive: (comments: CollaborativeComment[]) => void
) {
  if (isFirebaseAuthenticated(uid)) {
    const path = `users/${uid}/comments`;
    const q = query(collection(db, 'users', uid, 'comments'), where('ownerId', '==', uid));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: CollaborativeComment[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: d.id,
            itemId: d.itemId,
            author: d.author,
            text: d.text,
            createdAt: d.createdAtIso || new Date().toISOString(),
          };
        });
        onReceive(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    );
  }

  let active = true;
  (async () => {
    try {
      const resp = await fetchCloudVaultApi(`/api/cloud-vault/snapshot/${encodeURIComponent(uid)}`);
      if (resp.ok) {
        const data = (await resp.json()) as {
          comments?: Array<Record<string, unknown>>;
        };
        if (Array.isArray(data.comments) && active) {
          const list: CollaborativeComment[] = data.comments.map((d) => ({
            id: String(d.id || ''),
            itemId: String(d.itemId || ''),
            author: String(d.author || 'Thanh tra'),
            text: String(d.text || ''),
            createdAt: String(d.createdAtIso || d.createdAt || new Date().toISOString()),
          }));
          onReceive(list);
          return;
        }
      }
    } catch {
      // Fallback to local
    }

    try {
      const raw = localStorage.getItem(getLocalCommentsKey(uid));
      if (raw && active) {
        const map = JSON.parse(raw) as Record<string, Record<string, unknown>>;
        const list: CollaborativeComment[] = Object.values(map).map((d) => ({
          id: String(d.id || ''),
          itemId: String(d.itemId || ''),
          author: String(d.author || 'Thanh tra'),
          text: String(d.text || ''),
          createdAt: String(d.createdAtIso || new Date().toISOString()),
        }));
        onReceive(list);
      }
    } catch {
      // ignore
    }
  })();

  return () => {
    active = false;
  };
}
