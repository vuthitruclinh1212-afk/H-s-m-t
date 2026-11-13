import type { User } from 'firebase/auth';
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
import { db, handleFirestoreError, OperationType } from '@/src/firebase';
import type {
  CanvasConnection,
  CanvasNodePos,
  CollaborativeComment,
  DashboardWidget,
  HabitProfile,
  VaultItem,
} from '@/src/types/vault';
import { INITIAL_HABITS, INITIAL_WIDGETS } from '@/src/data/seedVault';

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

/**
 * Ensures the user's root profile document (/users/{uid}) exists WITHOUT overwriting
 * existing data when the user logs back into the same account on any device.
 */
export async function ensureAndLoadUserVaultState(user: User): Promise<HydratedUserVaultMeta> {
  const uid = user.uid;
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
    const d = snap.data();
    const earnedSet = new Set<string>(Array.isArray(d.earnedBadgeIds) ? d.earnedBadgeIds : []);
    const hiddenSet = new Set<string>(Array.isArray(d.hiddenWidgetIds) ? d.hiddenWidgetIds : []);

    const habits: HabitProfile = {
      expPoints: typeof d.expPoints === 'number' ? d.expPoints : 0,
      level: typeof d.level === 'number' ? d.level : 1,
      streakDays: typeof d.streakDays === 'number' ? d.streakDays : 0,
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

  // First time this account ever logs in: initialize a clean empty vault state
  const displayName = clampStr(user.displayName || user.email?.split('@')[0] || 'Thanh tra', 120, 'Thanh tra');
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

export async function saveUserVaultMetaToCloud(
  user: User,
  habits: HabitProfile,
  widgets: DashboardWidget[]
): Promise<void> {
  const uid = user.uid;
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);
  const displayName = clampStr(user.displayName || user.email?.split('@')[0] || 'Thanh tra', 120, 'Thanh tra');
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

  try {
    await updateDoc(userRef, {
      displayName,
      expPoints: Math.max(0, Math.min(10000000, Math.round(habits.expPoints))),
      level: Math.max(1, Math.min(10000, Math.round(habits.level))),
      streakDays: Math.max(0, Math.min(100000, Math.round(habits.streakDays))),
      readingMinutesToday: Math.max(0, Math.min(14400, Math.round(habits.readingMinutesToday))),
      dailyGoalMinutes: Math.max(1, Math.min(1440, Math.round(habits.dailyGoalMinutes))),
      earnedBadgeIds,
      hiddenWidgetIds,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
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

export async function createVaultItemInCloud(
  uid: string,
  item: VaultItem,
  canvasPos?: CanvasNodePos
): Promise<void> {
  const cleanId = sanitizeId(item.id);
  const path = `users/${uid}/items/${cleanId}`;
  const ref = doc(db, 'users', uid, 'items', cleanId);
  const payload = serializeVaultItemForFirestore(uid, { ...item, id: cleanId }, canvasPos);

  try {
    await setDoc(ref, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateVaultItemInCloud(
  uid: string,
  item: VaultItem,
  canvasPos?: CanvasNodePos
): Promise<void> {
  const cleanId = sanitizeId(item.id);
  const path = `users/${uid}/items/${cleanId}`;
  const ref = doc(db, 'users', uid, 'items', cleanId);
  const payload = serializeVaultItemForFirestore(uid, { ...item, id: cleanId }, canvasPos);

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
}

export async function deleteVaultItemFromCloud(uid: string, itemId: string): Promise<void> {
  const cleanId = sanitizeId(itemId);
  const path = `users/${uid}/items/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'items', cleanId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createCommentInCloud(
  uid: string,
  comment: CollaborativeComment
): Promise<void> {
  const cleanId = sanitizeId(comment.id);
  const path = `users/${uid}/comments/${cleanId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'comments', cleanId), {
      id: cleanId,
      ownerId: uid,
      itemId: sanitizeId(comment.itemId),
      author: clampStr(comment.author, 120, 'Thanh tra'),
      text: clampStr(comment.text, 2000, ''),
      createdAtIso: clampStr(comment.createdAt, 40, new Date().toISOString()),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeUserVaultItems(
  uid: string,
  onReceive: (
    items: VaultItem[],
    canvasPositions: Record<string, CanvasNodePos>,
    canvasConnections: CanvasConnection[]
  ) => void
) {
  const path = `users/${uid}/items`;
  const q = query(collection(db, 'users', uid, 'items'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const loadedItems: VaultItem[] = [];
      const positions: Record<string, CanvasNodePos> = {};
      const connections: CanvasConnection[] = [];

      snapshot.docs.forEach((docSnap, idx) => {
        const d = docSnap.data();
        const item: VaultItem = {
          id: d.id,
          workspaceId: d.workspaceId,
          title: d.title,
          type: d.type,
          smartFolder: d.smartFolder,
          tags: Array.isArray(d.tags) ? d.tags : [],
          excerpt: d.excerpt || '',
          content: d.content || '',
          sourceUrl: d.sourceUrl || undefined,
          coverImage: d.coverImage || undefined,
          mediaUrl: d.mediaUrl || undefined,
          pdfDataBase64: d.pdfDataBase64 || undefined,
          ocrText: d.ocrText || undefined,
          aiSummary: d.aiSummary || undefined,
          fileSizeLabel: d.fileSizeLabel || '12 KB',
          pageCount: typeof d.pageCount === 'number' ? d.pageCount : undefined,
          lastReadPage: typeof d.lastReadPage === 'number' ? d.lastReadPage : 1,
          readProgressPct: typeof d.readProgressPct === 'number' ? d.readProgressPct : 0,
          pinned: Boolean(d.pinned),
          offlineCached: Boolean(d.offlineCached),
          linkedIds: Array.isArray(d.linkedIds) ? d.linkedIds : [],
          annotations: [],
          versions: [],
          createdAt: d.createdAtIso || new Date().toISOString(),
          updatedAt: d.updatedAtIso || new Date().toISOString(),
        };
        loadedItems.push(item);

        if (d.onCanvas) {
          positions[d.id] = {
            x: typeof d.canvasX === 'number' ? d.canvasX : 80 + (idx % 3) * 290,
            y: typeof d.canvasY === 'number' ? d.canvasY : 80 + Math.floor(idx / 3) * 260,
          };
        }
      });

      // Build red-string connections from linkedIds
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
      onReceive(loadedItems, positions, connections);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeUserVaultComments(
  uid: string,
  onReceive: (comments: CollaborativeComment[]) => void
) {
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
