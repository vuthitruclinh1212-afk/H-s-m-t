import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  ArrowLeft,
  Award,
  BookmarkPlus,
  Camera,
  CloudCheck,
  ExternalLink,
  Folder,
  Globe,
  HardDriveDownload,
  LayoutGrid,
  LogOut,
  Menu,
  Network,
  Paperclip,
  PenTool,
  Plus,
  Search,
  Share2,
  Shield,
  Tag,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import type {
  CanvasConnection,
  CanvasNodePos,
  CollaborativeComment,
  DashboardWidget,
  HabitProfile,
  NavSection,
  VaultItem,
  VaultItemType,
  WorkspaceId,
} from '@/src/types/vault';
import {
  INITIAL_CANVAS_CONNECTIONS,
  INITIAL_CANVAS_POSITIONS,
  INITIAL_COMMENTS,
  INITIAL_HABITS,
  INITIAL_VAULT_ITEMS,
  INITIAL_WIDGETS,
} from '@/src/data/seedVault';
import {
  clearLegacySeedFromIndexedDB,
  saveVaultSnapshotToIndexedDB,
} from '@/src/utils/offlineDb';
import {
  playCameraShutterFlash,
  playDateClick,
  playPaperCrumple,
  playStampThud,
  playTypewriterDing,
} from '@/src/utils/bureauAudio';
import { ITEM_TYPE_TYPOGRAPHY, SECTION_TYPOGRAPHY } from '@/src/utils/bureauTypography';
import {
  auth,
  getSavedCloudEmailSession,
  signInOrRegisterWithEmail,
  signInWithGoogleAccount,
  signOutAccount,
  type VaultAuthUser,
} from '@/src/firebase';
import {
  createCommentInCloud,
  createVaultItemInCloud,
  deleteVaultItemFromCloud,
  ensureAndLoadUserVaultState,
  saveUserVaultMetaToCloud,
  subscribeUserVaultComments,
  subscribeUserVaultItems,
  updateVaultItemInCloud,
} from '@/src/utils/cloudVaultSync';
import {
  BureauPocketWatch,
  DeskBackgroundDecor,
  EmptyAshtrayState,
  EvidenceThumbnailIcon,
  MetalToggleSwitch,
  RevolverSpinner,
  RollingDateStamp,
  RubberStampButton,
  TopSecretLoginGate,
  VietnameseTypographyModal,
} from '@/src/components/bureau/BureauDecorations';
import UniversalPdfReader from '@/src/components/pdf/UniversalPdfReader';
import PdfSplitMergeModal from '@/src/components/pdf/PdfSplitMergeModal';
import MediaStudioViewer from '@/src/components/viewer/MediaStudioViewer';
import UniversalItemViewer from '@/src/components/viewer/UniversalItemViewer';
import KnowledgeGraphView from '@/src/components/graph/KnowledgeGraphView';
import InfiniteCanvasView from '@/src/components/canvas/InfiniteCanvasView';
import EncryptedVaultView from '@/src/components/e2ee/EncryptedVaultView';
import GamificationHabitsView from '@/src/components/habits/GamificationHabitsView';
import QuickClipperModal from '@/src/components/modals/QuickClipperModal';
import SemanticSearchModal from '@/src/components/modals/SemanticSearchModal';
import SelfDestructShareModal from '@/src/components/modals/SelfDestructShareModal';
import CustomDashboardView from '@/src/components/dashboard/CustomDashboardView';
import { CustomTagEditor } from '@/src/components/bureau/CustomTagManager';

const WORKSPACES: Array<{ id: WorkspaceId; label: string }> = [
  { id: 'personal', label: 'Kho Thám Tử Cá Nhân' },
  { id: 'design-lab', label: 'Phòng Hiện Trường (Nhóm)' },
  { id: 'engineering', label: 'Cục Tình Báo Tín Hiệu' },
];

const SMART_FOLDERS = [
  'Tất cả',
  'Trang Web Thường Tới',
  'Tài liệu PDF',
  'Ghi chú Cá nhân',
  'Kiến trúc & Hệ thống',
  'Nghiên cứu AI',
  'Tư liệu Media',
];

const TYPE_LABEL: Record<VaultItemType, string> = {
  pdf: 'Hồ sơ PDF',
  office_doc: 'Sổ cái / Office',
  web_archive: 'Trang Web / Báo',
  video: 'Băng CCTV / Video',
  audio: 'Băng Ghi âm',
  note: 'Sổ tay Điều tra',
  image: 'Ảnh Vật chứng',
  model_3d: 'Mô hình Pháp y 3D',
};

const FOLDER_TABS: Array<{
  id: NavSection;
  num: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', num: '01', label: 'Bảng Tin', icon: LayoutGrid },
  { id: 'library', num: '02', label: 'Kho Hồ Sơ', icon: Folder },
  { id: 'graph', num: '03', label: 'Dây Đỏ', icon: Network },
  { id: 'canvas', num: '04', label: 'Bảng Ghim', icon: PenTool },
  { id: 'e2ee', num: '05', label: 'Két Mật', icon: Shield },
  { id: 'habits', num: '06', label: 'Công Tác', icon: Award },
];

export default function App() {
  // Authentication & Cloud Hydration State
  const [currentUser, setCurrentUser] = useState<VaultAuthUser | null>(() =>
    getSavedCloudEmailSession()
  );
  const [authReady, setAuthReady] = useState(false);
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Darkroom Red Safelight Mode
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navSection, setNavSection] = useState<NavSection>('dashboard');
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId | 'all'>('all');
  const [activeFolder, setActiveFolder] = useState<string>('Tất cả');
  const [typeFilter, setTypeFilter] = useState<'all' | VaultItemType>('all');

  // Binder Clip Priority Filter, Date Stamp Filter, Tag Filter & Keyword Search
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'pinned' | 'standard'>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [catalogQuery, setCatalogQuery] = useState<string>('');
  const [inlineTagItemId, setInlineTagItemId] = useState<string | null>(null);
  const [inlineTagValue, setInlineTagValue] = useState<string>('');
  const [polaroidMode, setPolaroidMode] = useState<boolean>(false);
  const [crumplingId, setCrumplingId] = useState<string | null>(null);

  // Camera Flash Transition & Shake State
  const [cameraFlashing, setCameraFlashing] = useState(false);
  const [screenShaking, setScreenShaking] = useState(false);
  const [hasUnreadAlert, setHasUnreadAlert] = useState(false);

  // Clean Empty Initial Vault State (No sample data)
  const [items, setItems] = useState<VaultItem[]>(INITIAL_VAULT_ITEMS);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [jumpPage, setJumpPage] = useState<number | undefined>(undefined);
  const [jumpTimestampSec, setJumpTimestampSec] = useState<number | undefined>(undefined);

  const [canvasPositions, setCanvasPositions] =
    useState<Record<string, CanvasNodePos>>(INITIAL_CANVAS_POSITIONS);
  const [canvasConnections, setCanvasConnections] = useState<CanvasConnection[]>(
    INITIAL_CANVAS_CONNECTIONS
  );
  const [widgets, setWidgets] = useState<DashboardWidget[]>(INITIAL_WIDGETS);
  const [habits, setHabits] = useState<HabitProfile>(INITIAL_HABITS);
  const [comments, setComments] = useState<CollaborativeComment[]>(INITIAL_COMMENTS);

  const [clipperOpen, setClipperOpen] = useState(false);
  const [clipperInitialTab, setClipperInitialTab] = useState<'bookmark' | 'file'>('bookmark');
  const [searchOpen, setSearchOpen] = useState(false);
  const [splitMergeOpen, setSplitMergeOpen] = useState(false);
  const [typoModalOpen, setTypoModalOpen] = useState(false);
  const [shareTargetItem, setShareTargetItem] = useState<VaultItem | null>(null);

  const [offlineSyncTime, setOfflineSyncTime] = useState<string | null>(null);
  const [toastInfo, setToastInfo] = useState<{
    msg: string;
    kind: 'approved' | 'denied';
  } | null>(null);

  const itemsRef = useRef<VaultItem[]>(items);
  itemsRef.current = items;
  const canvasPositionsRef = useRef<Record<string, CanvasNodePos>>(canvasPositions);
  canvasPositionsRef.current = canvasPositions;

  useEffect(() => {
    clearLegacySeedFromIndexedDB();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [darkMode]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const showToast = useCallback(
    (msg: string, kind: 'approved' | 'denied' = 'approved') => {
      if (kind === 'approved') {
        playTypewriterDing();
      } else {
        playStampThud();
        setScreenShaking(true);
        setTimeout(() => setScreenShaking(false), 380);
      }
      setToastInfo({ msg, kind });
      setTimeout(() => {
        setToastInfo((cur) => (cur?.msg === msg ? null : cur));
      }, 3400);
    },
    []
  );

  // Listen to Firebase Auth state changes AND restore saved Cloud-Email session
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setCurrentUser({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName,
          photoURL: fbUser.photoURL,
          authMode: 'firebase',
        });
      } else {
        const savedEmailUser = getSavedCloudEmailSession();
        if (savedEmailUser) {
          setCurrentUser(savedEmailUser);
        } else {
          setCurrentUser(null);
        }
      }
      setAuthReady(true);
    });

    return () => {
      unsubAuth();
    };
  }, []);

  // Per-Account Cloud Hydration & Subscription (Anti-Overwrite across devices & domains)
  useEffect(() => {
    let unsubItems: (() => void) | null = null;
    let unsubComments: (() => void) | null = null;
    let cancelled = false;

    if (!currentUser) {
      setCloudHydrated(false);
      setItems([]);
      setCanvasPositions({});
      setCanvasConnections([]);
      setComments([]);
      setHabits(INITIAL_HABITS);
      setWidgets(INITIAL_WIDGETS);
      setActiveItemId(null);
      return;
    }

    setCloudHydrated(false);

    (async () => {
      try {
        // 1. Load existing user profile/habits/widgets from Cloud WITHOUT overwriting
        const meta = await ensureAndLoadUserVaultState(currentUser);
        if (cancelled) return;
        setHabits(meta.habits);
        setWidgets(meta.widgets);

        // 2. Subscribe to this user's personal items in Cloud / Cross-Domain Store
        unsubItems = subscribeUserVaultItems(
          currentUser.uid,
          (cloudItems, cloudPositions, cloudConnections) => {
            if (cancelled) return;
            setItems(cloudItems);
            setCanvasPositions(cloudPositions);
            setCanvasConnections(cloudConnections);
            setOfflineSyncTime(new Date().toISOString());
            saveVaultSnapshotToIndexedDB(cloudItems, currentUser.uid);
            setCloudHydrated(true);
          }
        );

        // 3. Subscribe to this user's comments
        unsubComments = subscribeUserVaultComments(currentUser.uid, (cloudComments) => {
          if (cancelled) return;
          setComments(cloudComments);
        });
      } catch (err) {
        console.error('Lỗi đồng bộ tài khoản:', err);
        setCloudHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
      if (unsubItems) unsubItems();
      if (unsubComments) unsubComments();
    };
  }, [currentUser]);

  // Persist habits & widgets changes ONLY after initial cloud hydration has completed
  useEffect(() => {
    if (!currentUser || !cloudHydrated) return;
    const timer = setTimeout(() => {
      saveUserVaultMetaToCloud(currentUser, habits, widgets).catch((err) =>
        console.error('Lỗi lưu trạng thái công tác:', err)
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [currentUser, cloudHydrated, habits, widgets]);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogleAccount();
      showToast('Đã xác thực tài khoản Google & đồng bộ kho lưu trữ cá nhân.', 'approved');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể đăng nhập bằng Google.';
      setAuthError(msg);
      throw err;
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleEmailLogin = async (params: {
    email: string;
    password: string;
    displayName?: string;
    mode: 'login' | 'register' | 'auto';
  }) => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      const sessionUser = await signInOrRegisterWithEmail(params);
      setCurrentUser(sessionUser);
      showToast(
        sessionUser.isNewAccount
          ? `Đã khởi tạo Kho Lưu Trữ độc lập cho ${sessionUser.email}`
          : `Đã khôi phục dữ liệu tài khoản ${sessionUser.email}`,
        'approved'
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể xác thực tài khoản Email.';
      setAuthError(msg);
      throw err;
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogoutAndSave = async () => {
    if (!currentUser) return;
    playStampThud();
    try {
      await saveUserVaultMetaToCloud(currentUser, habits, widgets);
      await saveVaultSnapshotToIndexedDB(items, currentUser.uid);
      await signOutAccount();
      setCurrentUser(null);
    } catch (err) {
      console.error('Lỗi khi đăng xuất:', err);
    }
  };

  const triggerCameraTransition = useCallback(() => {
    playCameraShutterFlash();
    setCameraFlashing(true);
    setTimeout(() => setCameraFlashing(false), 360);
  }, []);

  const handleGainExp = useCallback(
    (amount: number, reason: string) => {
      setHabits((prev) => {
        const nextExp = prev.expPoints + amount;
        const nextLevel = Math.floor(nextExp / 300) + 1;
        return {
          ...prev,
          expPoints: nextExp,
          level: nextLevel,
        };
      });
      showToast(`+${amount} EXP · ${reason}`, 'approved');
    },
    [showToast]
  );

  const handleLogMinutes = useCallback((mins: number) => {
    setHabits((prev) => ({
      ...prev,
      readingMinutesToday: prev.readingMinutesToday + mins,
    }));
  }, []);

  const handleAddNewItem = useCallback(
    async (newItem: VaultItem) => {
      setItems((prev) => [newItem, ...prev]);
      if (currentUser) {
        await createVaultItemInCloud(
          currentUser.uid,
          newItem,
          canvasPositionsRef.current[newItem.id]
        );
      }
    },
    [currentUser]
  );

  const updateItemById = useCallback(
    (id: string, patch: Partial<VaultItem>) => {
      const now = new Date().toISOString();
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== id) return it;
          const updated: VaultItem = { ...it, ...patch, updatedAt: now };
          if (currentUser) {
            updateVaultItemInCloud(
              currentUser.uid,
              updated,
              canvasPositionsRef.current[id]
            ).catch((err) => console.error('Lỗi lưu hồ sơ:', err));
          }
          return updated;
        })
      );
    },
    [currentUser]
  );

  const handleUpdateCanvasPositions = useCallback(
    (nextPositions: Record<string, CanvasNodePos>) => {
      const prevPositions = canvasPositionsRef.current;
      setCanvasPositions(nextPositions);
      if (!currentUser) return;

      // Sync any item whose canvas position or pin state changed
      itemsRef.current.forEach((item) => {
        const prevPos = prevPositions[item.id];
        const nextPos = nextPositions[item.id];
        const changed =
          Boolean(prevPos) !== Boolean(nextPos) ||
          (prevPos && nextPos && (prevPos.x !== nextPos.x || prevPos.y !== nextPos.y));
        if (changed) {
          updateVaultItemInCloud(currentUser.uid, item, nextPos).catch((err) =>
            console.error('Lỗi lưu tọa độ bảng ghim:', err)
          );
        }
      });
    },
    [currentUser]
  );

  const openItem = (item: VaultItem, opts?: { page?: number; timestampSec?: number }) => {
    triggerCameraTransition();
    setActiveItemId(item.id);
    setJumpPage(opts?.page);
    setJumpTimestampSec(opts?.timestampSec);
    setSidebarOpen(false);
  };

  const switchSection = (sec: NavSection) => {
    triggerCameraTransition();
    setActiveItemId(null);
    setNavSection(sec);
    setSidebarOpen(false);
  };

  // Tin Trash Bin Crumple & Shred Delete (Also removes from Cloud Firestore)
  const handleCrumpleDelete = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    playPaperCrumple();
    setCrumplingId(id);
    setTimeout(() => {
      setItems((prev) => prev.filter((it) => it.id !== id));
      if (currentUser) {
        deleteVaultItemFromCloud(currentUser.uid, id).catch((err) =>
          console.error('Lỗi xóa hồ sơ trên đám mây:', err)
        );
      }
      setCrumplingId(null);
      showToast(`Đã vò nát & hủy hồ sơ "${title}" khỏi tài khoản.`, 'denied');
    }, 430);
  };

  const toggleBinderPin = (e: React.MouseEvent, item: VaultItem) => {
    e.stopPropagation();
    playDateClick();
    updateItemById(item.id, { pinned: !item.pinned });
  };

  const activeItem = useMemo(
    () => items.find((it) => it.id === activeItemId) ?? null,
    [items, activeItemId]
  );

  // All custom tags created across the user's vault with counts
  const allVaultTagsWithCounts = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    items.forEach((it) => {
      (it.tags || []).forEach((rawTag) => {
        const clean = rawTag.trim();
        if (!clean) return;
        const key = clean.toLowerCase();
        const existing = counts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(key, { label: clean, count: 1 });
        }
      });
    });
    return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [items]);

  const existingVaultTags = useMemo(
    () => allVaultTagsWithCounts.map((t) => t.label),
    [allVaultTagsWithCounts]
  );

  const toggleTagFilter = (tagLabel: string) => {
    playDateClick();
    setSelectedTags((prev) => {
      const exists = prev.some((t) => t.toLowerCase() === tagLabel.toLowerCase());
      if (exists) {
        return prev.filter((t) => t.toLowerCase() !== tagLabel.toLowerCase());
      }
      return [...prev, tagLabel];
    });
  };

  const filteredItems = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    return items
      .filter((it) => {
        if (activeWorkspace !== 'all' && it.workspaceId !== activeWorkspace) return false;
        if (activeFolder !== 'Tất cả') {
          if (activeFolder === 'Trang Web Thường Tới') {
            if (it.smartFolder !== 'Trang Web Thường Tới' && it.type !== 'web_archive') {
              return false;
            }
          } else if (it.smartFolder !== activeFolder) {
            return false;
          }
        }
        if (typeFilter !== 'all' && it.type !== typeFilter) return false;
        if (priorityFilter === 'pinned' && !it.pinned) return false;
        if (priorityFilter === 'standard' && it.pinned) return false;
        if (
          dateFilter &&
          !it.updatedAt.startsWith(dateFilter) &&
          !it.createdAt.startsWith(dateFilter)
        ) {
          return false;
        }
        if (selectedTags.length > 0) {
          const itemTagSet = new Set((it.tags || []).map((t) => t.toLowerCase()));
          const matchesAllSelected = selectedTags.every((sel) =>
            itemTagSet.has(sel.toLowerCase())
          );
          if (!matchesAllSelected) return false;
        }
        if (q) {
          const hay = [
            it.title,
            it.excerpt,
            it.content,
            it.sourceUrl || '',
            it.smartFolder,
            ...(it.tags || []),
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }, [
    items,
    activeWorkspace,
    activeFolder,
    typeFilter,
    priorityFilter,
    dateFilter,
    selectedTags,
    catalogQuery,
  ]);

  const allPdfs = useMemo(() => items.filter((it) => it.type === 'pdf'), [items]);

  const sectionLabelMap: Record<NavSection, string> = {
    dashboard: 'Bảng Tin Cục',
    library: 'Kho Hồ Sơ Vật Chứng',
    clipper: 'Nạp Chứng Cứ',
    graph: 'Sơ Đồ Điều Tra Dây Đỏ',
    canvas: 'Bảng Ghim Chứng Cứ',
    e2ee: 'Két Sắt Mật Mã E2EE',
    habits: 'Nhật Ký Công Tác',
  };

  if (!authReady) {
    return (
      <div className="min-h-screen oak-desk-bg flex items-center justify-center p-4">
        <div className="p-6 manila-paper torn-paper-card border-2 border-[#2A2018]">
          <RevolverSpinner label="Đang kiểm tra niêm phong tài khoản..." />
        </div>
      </div>
    );
  }

  // Require Login (Email+Password or Google) so each email gets its own isolated multi-device account
  if (!currentUser) {
    return (
      <TopSecretLoginGate
        onUnlockGoogle={handleGoogleLogin}
        onUnlockEmail={handleEmailLogin}
        isAuthenticating={isSigningIn}
        authError={authError}
      />
    );
  }

  return (
    <div
      className={`min-h-screen flex oak-desk-bg text-[#1B1510] dark:text-[#FFD6CE] relative ${
        screenShaking ? 'animate-stamp-shake' : ''
      }`}
    >
      <DeskBackgroundDecor />

      {cameraFlashing && (
        <div className="pointer-events-none fixed inset-0 z-[70] bg-[#FFF8E1] animate-camera-flash" />
      )}

      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-[#120C08]/75 lg:hidden"
        />
      )}

      {/* SIDEBAR METAL SPRING CLIPBOARD */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[274px] p-2.5 lg:static lg:translate-x-0 transition-transform duration-200 flex flex-col shrink-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="relative flex-1 flex flex-col bg-[#5C3D24] dark:bg-[#2E0909] border-2 border-[#1A120B] p-2 pt-7 hard-shadow-lg">
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-32 h-8 bg-gradient-to-b from-[#B9B2A8] via-[#8E877D] to-[#5E5850] border-2 border-[#1A120B] shadow-md flex items-center justify-center z-20">
            <div className="w-4 h-4 rounded-full border-2 border-[#1A120B] bg-[#2B1D13]" />
            <span className="ml-2 font-typewriter text-[9px] text-[#14100C] tracking-widest">
              BUREAU-CLIP
            </span>
          </div>

          <div className="flex-1 flex flex-col manila-paper border border-[#6E5332] overflow-hidden">
            <div className="h-12 px-4 flex items-center justify-between border-b-2 border-[#2A2018] dark:border-[#9E1B16] bg-[#DFC79C] dark:bg-[#3A0C0C] shrink-0">
              <button
                onClick={() => switchSection('dashboard')}
                className="font-typewriter text-base font-extrabold tracking-wide whitespace-nowrap"
              >
                AETHEL BUREAU
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-1 hover:bg-[#C9B38C]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Rolodex Workspace Selector */}
            <div className="p-3 border-b border-[#6E5332]/60 bg-[#E6D1A8]/60 dark:bg-[#240606]">
              <div className="flex items-center justify-between px-1 mb-1.5">
                <label className="font-typewriter text-[10px] uppercase tracking-wider text-[#574A3D] dark:text-[#FF9E8E]">
                  Rolodex Chuyên Án
                </label>
                <span className="w-2.5 h-2.5 rounded-full bg-[#C69C4B] border border-[#1A120B]" />
              </div>
              <div className="relative border-2 border-[#2A2018] bg-[#FAF0D7] dark:bg-[#1E0505] hard-shadow">
                <select
                  value={activeWorkspace}
                  onChange={(e) => {
                    playDateClick();
                    setActiveWorkspace(e.target.value as WorkspaceId | 'all');
                  }}
                  className="w-full px-2.5 py-2 text-xs font-typewriter bg-transparent focus:outline-none"
                >
                  <option value="all">Toàn Kho Của Bạn ({items.length})</option>
                  {WORKSPACES.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filing Labels & Smart Folders */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-4">
              <div className="space-y-1">
                <div className="px-2 pb-1 font-typewriter text-[10px] uppercase tracking-widest text-[#574A3D] dark:text-[#FF9E8E]">
                  Nhãn Lưu Trữ (Filing Labels)
                </div>
                {FOLDER_TABS.map((nav) => {
                  const Icon = nav.icon;
                  const active = !activeItem && navSection === nav.id;
                  return (
                    <button
                      key={nav.id}
                      onClick={() => switchSection(nav.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-typewriter whitespace-nowrap transition-colors border ${
                        active
                          ? 'bg-[#9E1B16] border-[#2A2018] text-[#F5EAD2] hard-shadow'
                          : 'border-transparent hover:bg-[#DFC79C] dark:hover:bg-[#3A0C0C]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">
                        {nav.num}. {nav.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="masking-tape-divider" />

              <div className="space-y-1">
                <div className="px-2 pb-1 font-typewriter text-[10px] uppercase tracking-widest text-[#574A3D] dark:text-[#FF9E8E]">
                  Ngăn Hồ Sơ Thông Minh
                </div>
                {SMART_FOLDERS.map((folder) => {
                  const isSelected =
                    activeFolder === folder && navSection === 'library' && !activeItem;
                  return (
                    <button
                      key={folder}
                      onClick={() => {
                        triggerCameraTransition();
                        setActiveItemId(null);
                        setNavSection('library');
                        setActiveFolder(folder);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${
                        isSelected
                          ? 'bg-[#2A2018] dark:bg-[#9E1B16] text-[#F5EAD2] font-bold'
                          : 'hover:bg-[#DFC79C] dark:hover:bg-[#3A0C0C]'
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        {folder === 'Trang Web Thường Tới' ? (
                          <Globe className="w-3.5 h-3.5 shrink-0 text-[#9E1B16] dark:text-[#FF6B5B]" />
                        ) : (
                          <Folder className="w-3.5 h-3.5 shrink-0 opacity-75" />
                        )}
                        <span className="truncate">{folder}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {allVaultTagsWithCounts.length > 0 && (
                <>
                  <div className="masking-tape-divider" />
                  <div className="space-y-1.5">
                    <div className="px-2 flex items-center justify-between font-typewriter text-[10px] uppercase tracking-widest text-[#574A3D] dark:text-[#FF9E8E]">
                      <span>Lọc Theo Tag Của Bạn</span>
                      {selectedTags.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedTags([])}
                          className="text-[#9E1B16] hover:underline"
                        >
                          Xóa lọc
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 px-1">
                      {allVaultTagsWithCounts.map((t) => {
                        const isTagSelected = selectedTags.some(
                          (s) => s.toLowerCase() === t.label.toLowerCase()
                        );
                        return (
                          <button
                            key={t.label}
                            type="button"
                            onClick={() => {
                              setActiveItemId(null);
                              setNavSection('library');
                              toggleTagFilter(t.label);
                              setSidebarOpen(false);
                            }}
                            className={`px-2 py-0.5 text-[10px] font-stamp uppercase border transition-colors ${
                              isTagSelected
                                ? 'bg-[#9E1B16] text-[#F5EAD2] border-[#2A2018]'
                                : 'bg-[#F5EAD2] dark:bg-[#1E0505] border-[#6E5332] hover:bg-[#DFC79C]'
                            }`}
                          >
                            #{t.label} ({t.count})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </nav>

            {/* Footer Account Profile & Cloud Sync Status */}
            <div className="p-3 border-t-2 border-[#2A2018] dark:border-[#9E1B16] space-y-2.5 bg-[#DFC79C]/85 dark:bg-[#240606]">
              <button
                onClick={() => {
                  saveVaultSnapshotToIndexedDB(items, currentUser.uid).then(() => {
                    setOfflineSyncTime(new Date().toISOString());
                    showToast(
                      'Đã đồng bộ hồ sơ về bộ nhớ Đám mây & PWA ngoại tuyến.',
                      'approved'
                    );
                  });
                }}
                className="w-full flex items-center justify-between px-3 py-2 bg-[#F5EAD2] dark:bg-[#1E0505] border border-[#6E5332] text-[11px] hover:bg-[#EBDAB9]"
              >
                <span className="flex items-center gap-1.5 font-typewriter">
                  {cloudHydrated ? (
                    <CloudCheck className="w-3.5 h-3.5 text-[#166534]" />
                  ) : (
                    <HardDriveDownload className="w-3.5 h-3.5 text-[#9E1B16]" />
                  )}
                  Đồng Bộ Đa Thiết Bị
                </span>
                <span className="font-mono-tabular text-[10px]">
                  {offlineSyncTime
                    ? new Date(offlineSyncTime).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Đã lưu'}
                </span>
              </button>

              {/* Logged-in User Police Shield Badge Avatar */}
              <div className="flex items-center justify-between gap-2 px-1">
                <div
                  onClick={() => setHasUnreadAlert(false)}
                  className="flex items-center gap-2 min-w-0 cursor-pointer"
                >
                  <div className="relative w-10 h-11 shrink-0 flex items-center justify-center">
                    <svg viewBox="0 0 40 44" className="absolute inset-0 w-full h-full">
                      <path
                        d="M20 2 L36 8 V21 C36 31 28 38 20 42 C12 38 4 31 4 21 V8 Z"
                        fill="#C69C4B"
                        stroke="#1A120B"
                        strokeWidth="2.2"
                      />
                    </svg>
                    {currentUser.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt={currentUser.displayName || 'Thanh tra'}
                        referrerPolicy="no-referrer"
                        className="relative w-6 h-6 rounded-full object-cover border border-[#1A120B] sepia-[0.15]"
                      />
                    ) : (
                      <span className="relative font-stamp text-xs text-[#1A120B]">
                        {(currentUser.displayName || currentUser.email || 'T')[0].toUpperCase()}
                      </span>
                    )}
                    {hasUnreadAlert && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#FF4500] border border-[#1A120B] shadow-[0_0_8px_#FF4500] animate-pulse" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-typewriter text-xs font-bold truncate">
                      {currentUser.displayName || currentUser.email?.split('@')[0]}
                    </div>
                    <div className="font-mono-tabular text-[10px] text-[#574A3D] dark:text-[#FF9E8E] truncate">
                      {currentUser.email}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLogoutAndSave}
                  title="Đăng xuất tài khoản (Dữ liệu đã được lưu an toàn trên đám mây)"
                  className="p-2 border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] hover:bg-[#9E1B16] hover:text-white transition-colors shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN ARCHIVE WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="px-4 sm:px-6 pt-2.5 pb-2 bg-[#2B1D13]/85 dark:bg-[#1A0404]/90 border-b-2 border-[#14100C] dark:border-[#9E1B16] flex flex-col gap-2 shrink-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-end gap-1 overflow-x-auto max-w-full">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 mb-1 bg-[#EBDAB9] border border-[#2A2018]"
                aria-label="Mở menu"
              >
                <Menu className="w-4 h-4 text-[#1A120B]" />
              </button>

              {FOLDER_TABS.map((tab, idx) => {
                const isActive = !activeItem && navSection === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => switchSection(tab.id)}
                    style={{ marginBottom: isActive ? '-2px' : '0px' }}
                    className={`px-3 py-1.5 border-2 border-b-0 border-[#1A120B] font-typewriter text-[11px] uppercase whitespace-nowrap transition-transform ${
                      isActive
                        ? 'manila-paper font-bold translate-y-0.5 z-10 shadow-[2px_-2px_0px_rgba(0,0,0,0.3)]'
                        : idx % 2 === 0
                        ? 'bg-[#C9AD7D] text-[#1A120B] hover:bg-[#DFC79C]'
                        : 'bg-[#B89864] text-[#1A120B] hover:bg-[#DFC79C]'
                    }`}
                  >
                    <span className="text-[#9E1B16] mr-1">[{tab.num}]</span>
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0 pb-1">
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 border-2 border-[#9E7531] bg-[#EBDAB9] dark:bg-[#2B0909] text-xs font-typewriter hover:border-[#9E1B16] whitespace-nowrap"
              >
                <Search className="w-3.5 h-3.5 text-[#9E1B16]" />
                <span className="hidden sm:inline">Soi Kính Lúp</span>
                <span className="font-mono-tabular text-[10px] opacity-70 hidden md:inline">
                  ⌘K
                </span>
              </button>

              <button
                onClick={() => {
                  playDateClick();
                  setTypoModalOpen(true);
                }}
                title="Bảng giám định 12 Font chữ Tiếng Việt thiết kế riêng cho từng phần & từng loại hồ sơ"
                className="flex items-center gap-1.5 px-2.5 py-1.5 border-2 border-[#9E7531] bg-[#EBDAB9] dark:bg-[#2B0909] text-xs font-dossier font-bold hover:border-[#9E1B16] whitespace-nowrap"
              >
                <Type className="w-3.5 h-3.5 text-[#9E1B16]" />
                <span className="hidden md:inline">Bộ Chữ Việt (12 Font)</span>
              </button>

              <BureauPocketWatch />

              <MetalToggleSwitch
                checked={darkMode}
                onToggle={() => {
                  playDateClick();
                  setDarkMode((d) => !d);
                }}
                label="Phòng Rửa Ảnh"
              />

              <button
                onClick={handleLogoutAndSave}
                title="Đăng xuất & Lưu toàn bộ dữ liệu tài khoản"
                className="flex items-center gap-1 px-2.5 py-1.5 border border-[#6E5332] bg-[#C9B38C] dark:bg-[#3A0C0C] hover:bg-[#9E1B16] hover:text-white text-xs font-typewriter transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Đăng xuất</span>
              </button>

              <button
                onClick={() => {
                  setClipperInitialTab('bookmark');
                  setClipperOpen(true);
                }}
                title="Lưu trang web bạn thường xuyên lui tới (kèm ảnh Ctrl+V, mô tả và gắn Tag tự do)"
                className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-[#2A2018] bg-[#EBDAB9] dark:bg-[#2B0909] hover:bg-[#DFC79C] text-xs font-stamp uppercase tracking-wider whitespace-nowrap hard-shadow"
              >
                <BookmarkPlus className="w-3.5 h-3.5 text-[#9E1B16]" />
                <span>+ Lưu Trang Web</span>
              </button>

              <RubberStampButton
                onClick={() => {
                  setClipperInitialTab('file');
                  setClipperOpen(true);
                }}
                stampWord="INTAKE"
              >
                <span className="inline-flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  Nạp Tài Liệu
                </span>
              </RubberStampButton>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#EBDAB9] dark:text-[#FFD6CE] pt-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#9E1B16] border border-[#F5EAD2] shrink-0" />
              <button
                onClick={() => switchSection(navSection)}
                className="font-typewriter uppercase text-[11px] hover:underline whitespace-nowrap shrink-0"
              >
                {sectionLabelMap[navSection]}
              </button>
              {activeItem && (
                <>
                  <span className="w-8 h-0.5 bg-[#9E1B16] inline-block shrink-0" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#9E1B16] border border-[#F5EAD2] shrink-0" />
                  <span
                    className={`${
                      ITEM_TYPE_TYPOGRAPHY[activeItem.type].titleClass
                    } text-[#F5EAD2] truncate`}
                  >
                    {activeItem.title}
                  </span>
                </>
              )}
            </div>

            <button
              onClick={() => setTypoModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#1B120B] border border-[#8C6426] font-cipher text-[10px] text-[#EBDAB9] hover:border-[#9E1B16]"
            >
              <span>
                FONT PHÂN KHU:{' '}
                {activeItem
                  ? ITEM_TYPE_TYPOGRAPHY[activeItem.type].badgeFontName
                  : SECTION_TYPOGRAPHY[navSection].fontNameLabel}
              </span>
            </button>
          </div>
        </header>

        {toastInfo && (
          <div className="fixed bottom-8 right-5 z-50 px-4 py-3 manila-paper torn-paper-card border-2 border-[#2A2018] hard-shadow-lg flex items-center gap-3 max-w-md">
            <span
              className={
                toastInfo.kind === 'approved'
                  ? 'stamp-approved text-[10px]'
                  : 'stamp-crimson text-[10px]'
              }
            >
              {toastInfo.kind === 'approved' ? 'APPROVED' : 'DENIED'}
            </span>
            <span className="font-typewriter text-xs">{toastInfo.msg}</span>
          </div>
        )}

        {/* CONTENT VIEWPORT */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            {!cloudHydrated ? (
              <div className="p-8 manila-paper torn-paper-card border-2 border-[#2A2018] text-center">
                <RevolverSpinner label="Đang tải kho hồ sơ riêng của tài khoản từ đám mây..." />
              </div>
            ) : activeItem ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16]">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => {
                        triggerCameraTransition();
                        setActiveItemId(null);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5EAD2] dark:bg-[#1E0505] border border-[#2A2018] text-xs font-typewriter uppercase hover:bg-[#DFC79C] shrink-0"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Trở về
                    </button>
                    <div className="min-w-0">
                      <h1
                        className={`${
                          ITEM_TYPE_TYPOGRAPHY[activeItem.type].titleClass
                        } truncate`}
                      >
                        {activeItem.title}
                      </h1>
                      <div
                        className={`${
                          ITEM_TYPE_TYPOGRAPHY[activeItem.type].metaClass
                        } text-[#574A3D] dark:text-[#FF9E8E] flex flex-wrap items-center gap-2`}
                      >
                        <span>{TYPE_LABEL[activeItem.type]}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Font: {ITEM_TYPE_TYPOGRAPHY[activeItem.type].badgeFontName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{activeItem.smartFolder}</span>
                        <span aria-hidden="true">·</span>
                        <span>{activeItem.fileSizeLabel}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {activeItem.sourceUrl && (
                      <a
                        href={activeItem.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#9E1B16] hover:bg-[#C81E1E] text-[#F5EAD2] border border-[#2A2018] text-xs font-stamp uppercase tracking-wider"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Mở Trang Web
                      </a>
                    )}
                    <button
                      onClick={() => setShareTargetItem(activeItem)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5EAD2] dark:bg-[#1E0505] border border-[#2A2018] text-xs font-typewriter uppercase hover:bg-[#DFC79C]"
                    >
                      <Share2 className="w-3.5 h-3.5 text-[#9E1B16]" />
                      Link Tự Hủy
                    </button>
                  </div>
                </div>

                {/* Universal Custom Tag Editor Bar for ANY open item (PDF, Video, Website, Note, etc.) */}
                <div className="p-3.5 manila-paper border-2 border-[#2A2018] dark:border-[#9E1B16] space-y-2">
                  <div className="font-stamp text-xs uppercase text-[#9E1B16] dark:text-[#FF6B5B]">
                    GẮN TAG TỰ DO CHO MỤC NÀY (ÁP DỤNG CHO CẢ TÀI LIỆU PDF, VIDEO & TRANG WEB)
                  </div>
                  <CustomTagEditor
                    tags={activeItem.tags}
                    onChangeTags={(nextTags) =>
                      updateItemById(activeItem.id, { tags: nextTags })
                    }
                    existingVaultTags={existingVaultTags}
                  />
                </div>

                {activeItem.type === 'pdf' ? (
                  <UniversalPdfReader
                    itemId={activeItem.id}
                    title={activeItem.title}
                    pdfBase64={activeItem.pdfDataBase64}
                    initialPage={jumpPage ?? activeItem.lastReadPage ?? 1}
                    annotations={activeItem.annotations ?? []}
                    onUpdateAnnotations={(anns) =>
                      updateItemById(activeItem.id, { annotations: anns })
                    }
                    onPageProgress={(page, total) =>
                      updateItemById(activeItem.id, {
                        lastReadPage: page,
                        pageCount: total,
                        readProgressPct: Math.round((page / Math.max(1, total)) * 100),
                      })
                    }
                    onOpenSplitMerge={() => setSplitMergeOpen(true)}
                    onGainExp={handleGainExp}
                  />
                ) : activeItem.type === 'video' || activeItem.type === 'audio' ? (
                  <MediaStudioViewer
                    item={activeItem}
                    initialTimestampSec={jumpTimestampSec}
                    onUpdateItem={(patch) => updateItemById(activeItem.id, patch)}
                    onGainExp={handleGainExp}
                  />
                ) : (
                  <UniversalItemViewer
                    item={activeItem}
                    comments={comments.filter((c) => c.itemId === activeItem.id)}
                    existingVaultTags={existingVaultTags}
                    onUpdateItem={(patch) => updateItemById(activeItem.id, patch)}
                    onAddComment={(text) => {
                      const newComment: CollaborativeComment = {
                        id: `cm-${crypto.randomUUID().slice(0, 8)}`,
                        itemId: activeItem.id,
                        author:
                          currentUser.displayName ||
                          currentUser.email?.split('@')[0] ||
                          'Thanh tra',
                        text,
                        createdAt: new Date().toISOString(),
                      };
                      setComments((prev) => [...prev, newComment]);
                      createCommentInCloud(currentUser.uid, newComment).catch((err) =>
                        console.error('Lỗi lưu bút phê:', err)
                      );
                    }}
                    onOpenShareModal={() => setShareTargetItem(activeItem)}
                    onGainExp={handleGainExp}
                  />
                )}
              </div>
            ) : navSection === 'dashboard' ? (
              <CustomDashboardView
                items={items}
                widgets={widgets}
                habits={habits}
                onUpdateWidgets={setWidgets}
                onOpenItem={(it) => openItem(it)}
                onOpenHabits={() => switchSection('habits')}
                onOpenAddWebsite={() => {
                  setClipperInitialTab('bookmark');
                  setClipperOpen(true);
                }}
              />
            ) : navSection === 'graph' ? (
              <KnowledgeGraphView
                items={items}
                onOpenItem={(it) => openItem(it)}
                onCreateLink={(src, dst) => {
                  const srcItem = items.find((i) => i.id === src);
                  if (srcItem && !srcItem.linkedIds.includes(dst)) {
                    updateItemById(src, { linkedIds: [...srcItem.linkedIds, dst] });
                  }
                  handleGainExp(10, 'Căng dây đỏ liên kết đầu mối');
                }}
              />
            ) : navSection === 'canvas' ? (
              <InfiniteCanvasView
                items={items}
                positions={canvasPositions}
                connections={canvasConnections}
                onUpdatePositions={handleUpdateCanvasPositions}
                onAddConnection={(fromId, toId) => {
                  setCanvasConnections((prev) => [
                    ...prev,
                    { id: crypto.randomUUID(), fromId, toId },
                  ]);
                  const srcItem = items.find((i) => i.id === fromId);
                  if (srcItem && !srcItem.linkedIds.includes(toId)) {
                    updateItemById(fromId, { linkedIds: [...srcItem.linkedIds, toId] });
                  }
                  handleGainExp(10, 'Liên kết chứng cứ trên Bảng ghim');
                }}
                onOpenItem={(it) => openItem(it)}
              />
            ) : navSection === 'e2ee' ? (
              <EncryptedVaultView onGainExp={handleGainExp} />
            ) : navSection === 'habits' ? (
              <GamificationHabitsView
                habits={habits}
                onGainExp={handleGainExp}
                onLogMinutes={handleLogMinutes}
              />
            ) : (
              /* EVIDENCE, FREQUENT WEBSITES & DOSSIER CATALOG */
              <div className="space-y-5">
                <div className="p-5 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="font-mono-tabular text-[11px] uppercase tracking-widest text-[#574A3D] dark:text-[#FF9E8E]">
                        DANH MỤC LƯU TRỮ CÁ NHÂN · {currentUser.email}
                      </div>
                      <h1 className="font-typewriter text-2xl font-bold tracking-tight">
                        {activeFolder === 'Trang Web Thường Tới' || typeFilter === 'web_archive'
                          ? 'Sổ Địa Chỉ Trang Web Thường Xuyên Lui Tới'
                          : 'Kho Hồ Sơ, Tài Liệu & Trang Web Thường Tới'}
                      </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setClipperInitialTab('bookmark');
                          setClipperOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#9E1B16] hover:bg-[#C81E1E] text-[#F5EAD2] border-2 border-[#2A2018] text-xs font-stamp uppercase tracking-wider hard-shadow"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        + Lưu Trang Web Mới
                      </button>

                      <RollingDateStamp value={dateFilter} onChange={setDateFilter} />
                      {dateFilter && (
                        <button
                          onClick={() => setDateFilter('')}
                          className="px-2 py-1 text-xs font-typewriter border border-[#6E5332] bg-[#F5EAD2]"
                        >
                          Xóa ngày
                        </button>
                      )}
                      <button
                        onClick={() => setPolaroidMode((p) => !p)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-typewriter uppercase border-2 ${
                          polaroidMode
                            ? 'bg-[#9E1B16] text-[#F5EAD2] border-[#2A2018]'
                            : 'bg-[#F5EAD2] dark:bg-[#1E0505] border-[#2A2018]'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        {polaroidMode ? 'Chế độ Polaroid Bàn' : 'Kiểu Polaroid'}
                      </button>
                    </div>
                  </div>

                  {/* Direct Search Bar & Free-form Tag Filter Bar */}
                  <div className="p-3.5 bg-[#F5EAD2] dark:bg-[#1E0505] border border-[#6E5332] space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-[220px]">
                        <Search className="w-4 h-4 text-[#9E1B16] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={catalogQuery}
                          onChange={(e) => setCatalogQuery(e.target.value)}
                          placeholder="Tìm nhanh theo tên trang web, URL, mô tả, nội dung tài liệu hoặc #tag..."
                          className="w-full pl-9 pr-8 py-2 text-xs font-typewriter border border-[#6E5332] bg-[#FAF3E3] dark:bg-[#240606] focus:outline-none focus:border-[#9E1B16]"
                        />
                        {catalogQuery && (
                          <button
                            type="button"
                            onClick={() => setCatalogQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#574A3D] hover:text-[#9E1B16]"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {(selectedTags.length > 0 ||
                        catalogQuery ||
                        typeFilter !== 'all' ||
                        activeFolder !== 'Tất cả') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTags([]);
                            setCatalogQuery('');
                            setTypeFilter('all');
                            setActiveFolder('Tất cả');
                          }}
                          className="px-3 py-2 text-xs font-typewriter border border-[#9E1B16] text-[#9E1B16] bg-[#FAF3E3] hover:bg-[#9E1B16] hover:text-white transition-colors"
                        >
                          Xóa tất cả bộ lọc
                        </button>
                      )}
                    </div>

                    {/* Tag Filter Chips */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 font-stamp text-[11px] uppercase text-[#9E1B16] dark:text-[#FF6B5B] mr-1">
                        <Tag className="w-3.5 h-3.5" />
                        Lọc theo Tag ({allVaultTagsWithCounts.length}):
                      </span>

                      <button
                        type="button"
                        onClick={() => setSelectedTags([])}
                        className={`px-2.5 py-0.5 text-[11px] font-stamp uppercase border transition-colors ${
                          selectedTags.length === 0
                            ? 'bg-[#2A2018] text-[#F5EAD2] border-[#2A2018]'
                            : 'bg-[#FAF3E3] dark:bg-[#240606] border-[#6E5332] hover:bg-[#DFC79C]'
                        }`}
                      >
                        Tất cả Tag
                      </button>

                      {allVaultTagsWithCounts.map((tagObj) => {
                        const isSelected = selectedTags.some(
                          (s) => s.toLowerCase() === tagObj.label.toLowerCase()
                        );
                        return (
                          <button
                            key={tagObj.label}
                            type="button"
                            onClick={() => toggleTagFilter(tagObj.label)}
                            className={`px-2.5 py-0.5 text-[11px] font-stamp uppercase border transition-colors ${
                              isSelected
                                ? 'bg-[#9E1B16] text-[#F5EAD2] border-[#2A2018] shadow-sm'
                                : 'bg-[#DFC79C] dark:bg-[#3D0D0D] border-[#6E5332] hover:border-[#9E1B16]'
                            }`}
                          >
                            #{tagObj.label} ({tagObj.count})
                          </button>
                        );
                      })}

                      {allVaultTagsWithCounts.length === 0 && (
                        <span className="font-typewriter text-[11px] text-[#574A3D] dark:text-[#FF9E8E] italic">
                          Khi bạn gắn Tag cho trang web hoặc tài liệu, các Tag sẽ xuất hiện tại đây để lọc 1-click.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="masking-tape-divider" />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {(
                        [
                          { id: 'all', label: 'Tất cả Mục' },
                          { id: 'web_archive', label: '🌐 Trang Web Thường Tới' },
                          { id: 'pdf', label: 'Hồ sơ PDF' },
                          { id: 'note', label: 'Sổ tay' },
                          { id: 'image', label: 'Ảnh Chứng cứ' },
                          { id: 'video', label: 'CCTV / Video' },
                          { id: 'office_doc', label: 'Sổ cái' },
                          { id: 'model_3d', label: '3D Pháp y' },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setTypeFilter(f.id)}
                          className={`px-2.5 py-1 text-xs font-typewriter border whitespace-nowrap transition-colors ${
                            typeFilter === f.id
                              ? 'bg-[#9E1B16] text-[#F5EAD2] border-[#2A2018]'
                              : 'bg-[#F5EAD2] dark:bg-[#1E0505] border-[#6E5332] hover:bg-[#DFC79C]'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="font-typewriter text-[10px] uppercase">
                        Kẹp Phân Loại:
                      </span>
                      {(
                        [
                          { id: 'all', label: 'Tất cả', clipColor: 'bg-[#2A2018]' },
                          { id: 'pinned', label: 'Ghim ưu tiên', clipColor: 'bg-[#9E1B16]' },
                          { id: 'standard', label: 'Thường', clipColor: 'bg-[#C69C4B]' },
                        ] as const
                      ).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setPriorityFilter(p.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-typewriter border ${
                            priorityFilter === p.id
                              ? 'bg-[#2A2018] text-[#F5EAD2] border-[#2A2018]'
                              : 'bg-[#F5EAD2] dark:bg-[#1E0505] border-[#6E5332]'
                          }`}
                        >
                          <span
                            className={`w-2.5 h-2.5 ${p.clipColor} border border-[#F5EAD2]`}
                          />
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {filteredItems.length === 0 ? (
                  <EmptyAshtrayState
                    onAction={() => {
                      setClipperInitialTab('bookmark');
                      setClipperOpen(true);
                    }}
                  />
                ) : (
                  <div
                    className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 ${
                      polaroidMode ? 'gap-8 py-4' : 'gap-5'
                    }`}
                  >
                    {filteredItems.map((item, idx) => {
                      const scatterTilt = polaroidMode
                        ? idx % 4 === 0
                          ? '-rotate-2'
                          : idx % 4 === 1
                          ? 'rotate-2 translate-y-2'
                          : idx % 4 === 2
                          ? '-rotate-1 -translate-y-1'
                          : 'rotate-1'
                        : '';
                      const isCrumpling = crumplingId === item.id;
                      const itemTypo = ITEM_TYPE_TYPOGRAPHY[item.type];

                      return (
                        <article
                          key={item.id}
                          onClick={() => openItem(item)}
                          className={`group relative cursor-pointer ${
                            polaroidMode
                              ? 'bg-[#FAF5E8] text-[#1A120B] p-3.5 pb-6 border-2 border-[#2A2018] hard-shadow-lg'
                              : 'manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16]'
                          } ${scatterTilt} ${
                            isCrumpling ? 'animate-crumple' : ''
                          } hover:-translate-y-1.5 hover:rotate-1 transition-all duration-200 flex flex-col`}
                        >
                          <button
                            type="button"
                            onClick={(e) => toggleBinderPin(e, item)}
                            title={
                              item.pinned
                                ? 'Kẹp Đỏ: Ghim Ưu Tiên (Nhấn để đổi)'
                                : 'Kẹp Đồng: Thường (Nhấn để ghim ưu tiên)'
                            }
                            className={`absolute -top-2.5 left-4 px-2 py-0.5 border border-[#1A120B] text-[9px] font-stamp uppercase text-[#F5EAD2] z-10 flex items-center gap-1 shadow-sm ${
                              item.pinned ? 'bg-[#9E1B16]' : 'bg-[#7A5E35]'
                            }`}
                          >
                            <Paperclip className="w-2.5 h-2.5" />
                            {item.pinned ? 'ƯU TIÊN' : 'LƯU'}
                          </button>

                          <div
                            className={`px-4 pt-3 pb-2 border-b border-[#6E5332]/40 flex items-center justify-between ${itemTypo.metaClass}`}
                          >
                            <span>CAT. Nº LP-{String(idx + 1).padStart(3, '0')}</span>
                            <span className="flex items-center gap-1.5">
                              <EvidenceThumbnailIcon type={item.type} />
                              <span>{TYPE_LABEL[item.type]}</span>
                            </span>
                          </div>

                          {item.coverImage ? (
                            <div
                              className={`${
                                polaroidMode
                                  ? 'h-52 my-2 border-2 border-[#2A2018]'
                                  : 'h-44 border-b border-[#6E5332]/40'
                              } bg-[#1C1612] overflow-hidden`}
                            >
                              <img
                                src={item.coverImage}
                                alt={item.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                              />
                            </div>
                          ) : null}

                          <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`${itemTypo.metaClass} opacity-75 truncate`}>
                                  {item.smartFolder} · {item.fileSizeLabel}
                                </span>
                                {item.sourceUrl ? (
                                  <a
                                    href={item.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#9E1B16] hover:bg-[#C81E1E] text-[#F5EAD2] font-stamp text-[10px] uppercase tracking-wider shrink-0"
                                    title={`Mở trực tiếp: ${item.sourceUrl}`}
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    Mở Web
                                  </a>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-[#2A2018]/10 dark:bg-[#9E1B16]/25 border border-[#6E5332]/60 font-cipher text-[9px] uppercase shrink-0">
                                    {itemTypo.badgeFontName}
                                  </span>
                                )}
                              </div>

                              <h3
                                className={`${
                                  polaroidMode
                                    ? 'font-polaroid text-lg font-bold'
                                    : itemTypo.titleClass
                                } leading-snug line-clamp-2 group-hover:text-[#9E1B16] dark:group-hover:text-[#FF6B5B] transition-colors`}
                              >
                                {item.title}
                              </h3>

                              {item.sourceUrl && (
                                <div className="font-mono-tabular text-[11px] text-[#9E1B16] dark:text-[#FF6B5B] truncate">
                                  🔗 {item.sourceUrl}
                                </div>
                              )}

                              <p
                                className={`${itemTypo.bodyClass} line-clamp-3 leading-snug opacity-90`}
                              >
                                {item.excerpt || item.content}
                              </p>
                            </div>

                            {/* Interactive Custom Tags & Quick Inline Tag Addition on Every Card */}
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="pt-3 border-t border-[#6E5332]/40 space-y-2 cursor-default"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex flex-wrap gap-1 min-w-0">
                                  {(item.tags || []).map((tag) => {
                                    const isFiltered = selectedTags.some(
                                      (s) => s.toLowerCase() === tag.toLowerCase()
                                    );
                                    return (
                                      <span
                                        key={tag}
                                        onClick={() => toggleTagFilter(tag)}
                                        title={`Nhấn để lọc theo tag #${tag}`}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[10px] font-stamp uppercase tracking-wider cursor-pointer transition-colors ${
                                          isFiltered
                                            ? 'bg-[#9E1B16] text-[#F5EAD2] border-[#2A2018]'
                                            : 'bg-[#DFC79C] dark:bg-[#3D0D0D] border-[#6E5332] text-[#261B12] dark:text-[#FFD6CE] hover:border-[#9E1B16]'
                                        }`}
                                      >
                                        #{tag}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateItemById(item.id, {
                                              tags: item.tags.filter((t) => t !== tag),
                                            });
                                          }}
                                          title={`Gỡ tag "${tag}"`}
                                          className="hover:text-[#9E1B16] dark:hover:text-[#FF6B5B]"
                                        >
                                          <X className="w-2.5 h-2.5" />
                                        </button>
                                      </span>
                                    );
                                  })}

                                  {item.tags.length < 10 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setInlineTagItemId(
                                          inlineTagItemId === item.id ? null : item.id
                                        );
                                        setInlineTagValue('');
                                      }}
                                      className="px-2 py-0.5 text-[10px] font-typewriter border border-dashed border-[#6E5332] bg-[#FAF3E3] dark:bg-[#1E0505] hover:border-[#9E1B16]"
                                    >
                                      + Tag
                                    </button>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) =>
                                    handleCrumpleDelete(e, item.id, item.title)
                                  }
                                  title="Vò nát & bỏ vào thùng rác thiếc"
                                  className="p-1.5 border border-[#6E5332] bg-[#EBDAB9] dark:bg-[#240606] hover:bg-[#9E1B16] hover:text-white transition-colors shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {inlineTagItemId === item.id && (
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    const cleaned = inlineTagValue
                                      .replace(/^#+/, '')
                                      .trim()
                                      .slice(0, 64);
                                    if (
                                      cleaned &&
                                      !item.tags.some(
                                        (t) => t.toLowerCase() === cleaned.toLowerCase()
                                      ) &&
                                      item.tags.length < 10
                                    ) {
                                      updateItemById(item.id, {
                                        tags: [...item.tags, cleaned],
                                      });
                                    }
                                    setInlineTagValue('');
                                    setInlineTagItemId(null);
                                  }}
                                  className="flex gap-1"
                                >
                                  <input
                                    type="text"
                                    autoFocus
                                    value={inlineTagValue}
                                    onChange={(e) => setInlineTagValue(e.target.value)}
                                    placeholder="Nhập tag mới..."
                                    className="flex-1 px-2 py-1 text-xs font-typewriter border border-[#6E5332] bg-[#FAF3E3] dark:bg-[#1E0505] focus:outline-none focus:border-[#9E1B16]"
                                  />
                                  <button
                                    type="submit"
                                    className="px-2.5 py-1 bg-[#9E1B16] text-[#F5EAD2] font-stamp text-[10px] uppercase"
                                  >
                                    Thêm
                                  </button>
                                </form>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        <footer className="px-4 py-1.5 bg-[#1B120B] dark:bg-[#140202] border-t border-[#463526] dark:border-[#6E120E] text-center font-typewriter text-[10px] tracking-[0.22em] text-[#C9B38C] dark:text-[#FF8C7A] uppercase shrink-0">
          PROPERTY OF SCOTLAND YARD · BUREAU OF ARCHIVES · ACCOUNT: {currentUser.email}
        </footer>
      </div>

      {/* MODALS */}
      <QuickClipperModal
        isOpen={clipperOpen}
        onClose={() => setClipperOpen(false)}
        activeWorkspace={activeWorkspace === 'all' ? 'personal' : activeWorkspace}
        existingVaultTags={existingVaultTags}
        initialTab={clipperInitialTab}
        onAddItem={(newItem) => {
          handleAddNewItem(newItem);
          openItem(newItem);
        }}
        onGainExp={handleGainExp}
      />

      <SemanticSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        items={items}
        onJumpToItem={(it, opts) => openItem(it, opts)}
      />

      <SelfDestructShareModal
        item={shareTargetItem}
        onClose={() => setShareTargetItem(null)}
      />

      <VietnameseTypographyModal
        isOpen={typoModalOpen}
        onClose={() => setTypoModalOpen(false)}
      />

      {activeItem && activeItem.type === 'pdf' && (
        <PdfSplitMergeModal
          isOpen={splitMergeOpen}
          onClose={() => setSplitMergeOpen(false)}
          activePdf={activeItem}
          allPdfs={allPdfs}
          onSaveNewPdf={(title, base64, pageCount) => {
            const now = new Date().toISOString();
            const created: VaultItem = {
              id: `pdf-${crypto.randomUUID().slice(0, 8)}`,
              workspaceId: activeItem.workspaceId,
              title,
              type: 'pdf',
              smartFolder: activeItem.smartFolder,
              tags: [...activeItem.tags.slice(0, 2), 'Split/Merge'],
              excerpt: `Tạo từ công cụ Cắt/Gộp hồ sơ (${pageCount} trang).`,
              content: `Hồ sơ PDF ${title} gồm ${pageCount} trang.`,
              pdfDataBase64: base64,
              pageCount,
              lastReadPage: 1,
              readProgressPct: 0,
              fileSizeLabel: `${Math.max(
                50,
                Math.round((base64.length * 0.75) / 1024)
              )} KB`,
              offlineCached: true,
              linkedIds: [activeItem.id],
              annotations: [],
              versions: [],
              createdAt: now,
              updatedAt: now,
            };
            handleAddNewItem(created);
            openItem(created, { page: 1 });
            handleGainExp(20, 'Cắt / Gộp hồ sơ PDF');
          }}
        />
      )}
    </div>
  );
}
