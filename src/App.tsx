import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Camera,
  Folder,
  HardDriveDownload,
  LayoutGrid,
  Lock,
  Menu,
  Network,
  Paperclip,
  PenTool,
  Plus,
  Search,
  Share2,
  Shield,
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
  SAMPLE_PDF_SPECS,
} from '@/src/data/seedVault';
import { generateSamplePdfBase64 } from '@/src/utils/pdfFactory';
import {
  loadVaultSnapshotFromIndexedDB,
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
  BaggageTag,
  BureauPocketWatch,
  DeskBackgroundDecor,
  EmptyAshtrayState,
  EvidenceThumbnailIcon,
  MetalToggleSwitch,
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

const WORKSPACES: Array<{ id: WorkspaceId; label: string }> = [
  { id: 'personal', label: 'Kho Thám Tử Cá Nhân' },
  { id: 'design-lab', label: 'Phòng Hiện Trường (Nhóm)' },
  { id: 'engineering', label: 'Cục Tình Báo Tín Hiệu' },
];

const SMART_FOLDERS = [
  'Tất cả',
  'Kiến trúc & Hệ thống',
  'Nghiên cứu AI',
  'Tài liệu PDF',
  'Tư liệu Media',
  'Ghi chú Cá nhân',
];

const TYPE_LABEL: Record<VaultItemType, string> = {
  pdf: 'Hồ sơ PDF',
  office_doc: 'Sổ cái / Office',
  web_archive: 'Lưu trữ Báo / Web',
  video: 'Băng CCTV / Video',
  audio: 'Băng Ghi âm',
  note: 'Sổ tay Điều tra',
  image: 'Ảnh Vật chứng',
  model_3d: 'Mô hình Pháp y 3D',
};

const FOLDER_TABS: Array<{ id: NavSection; num: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', num: '01', label: 'Bảng Tin', icon: LayoutGrid },
  { id: 'library', num: '02', label: 'Kho Hồ Sơ', icon: Folder },
  { id: 'graph', num: '03', label: 'Dây Đỏ', icon: Network },
  { id: 'canvas', num: '04', label: 'Bảng Ghim', icon: PenTool },
  { id: 'e2ee', num: '05', label: 'Két Mật', icon: Shield },
  { id: 'habits', num: '06', label: 'Công Tác', icon: Award },
];

export default function App() {
  // #56: Closed "TOP SECRET" Dossier Gate on entry
  const [dossierGateOpen, setDossierGateOpen] = useState(false);

  // #28: Darkroom Red Safelight Mode
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navSection, setNavSection] = useState<NavSection>('dashboard');
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId | 'all'>('all');
  const [activeFolder, setActiveFolder] = useState<string>('Tất cả');
  const [typeFilter, setTypeFilter] = useState<'all' | VaultItemType>('all');

  // #42 Binder Clip Priority Filter & #34 Date Stamp Filter & #23 Polaroid Scattered Gallery Mode
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'pinned' | 'standard'>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [polaroidMode, setPolaroidMode] = useState<boolean>(false);
  const [crumplingId, setCrumplingId] = useState<string | null>(null);

  // #43 Camera Flash Transition & #50 Shake State
  const [cameraFlashing, setCameraFlashing] = useState(false);
  const [screenShaking, setScreenShaking] = useState(false);

  // #51 Unread Glowing Ember Notification State
  const [hasUnreadAlert, setHasUnreadAlert] = useState(true);

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [splitMergeOpen, setSplitMergeOpen] = useState(false);
  const [typoModalOpen, setTypoModalOpen] = useState(false);
  const [shareTargetItem, setShareTargetItem] = useState<VaultItem | null>(null);

  const [offlineSyncTime, setOfflineSyncTime] = useState<string | null>(null);
  const [toastInfo, setToastInfo] = useState<{ msg: string; kind: 'approved' | 'denied' } | null>(null);

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

  useEffect(() => {
    let mounted = true;
    async function bootstrap() {
      const saved = await loadVaultSnapshotFromIndexedDB();
      let baseItems = saved?.items?.length ? saved.items : INITIAL_VAULT_ITEMS;
      const savedIds = new Set(baseItems.map((b) => b.id));
      for (const seed of INITIAL_VAULT_ITEMS) {
        if (!savedIds.has(seed.id)) {
          baseItems = [...baseItems, seed];
        }
      }
      if (saved?.syncedAt && mounted) {
        setOfflineSyncTime(saved.syncedAt);
      }

      const hydrated = await Promise.all(
        baseItems.map(async (item) => {
          if (item.type === 'pdf' && !item.pdfDataBase64 && SAMPLE_PDF_SPECS[item.id]) {
            const b64 = await generateSamplePdfBase64(SAMPLE_PDF_SPECS[item.id]);
            return { ...item, pdfDataBase64: b64 };
          }
          return item;
        })
      );

      const params = new URLSearchParams(window.location.search);
      const clipUrl = params.get('clipUrl');
      const clipTitle = params.get('clipTitle');
      const clipText = params.get('clipText');
      if (clipUrl || clipText) {
        const now = new Date().toISOString();
        const clippedItem: VaultItem = {
          id: `clip-${crypto.randomUUID().slice(0, 8)}`,
          workspaceId: 'personal',
          title: clipTitle || 'Đoạn trích từ Trình duyệt',
          type: clipUrl && !clipText ? 'web_archive' : 'note',
          smartFolder: 'Ghi chú Cá nhân',
          tags: ['Web Clipper', 'Extension'],
          excerpt: (clipText || clipUrl || '').slice(0, 140),
          content: clipText || `Nguồn đã lưu: ${clipUrl}`,
          sourceUrl: clipUrl || undefined,
          fileSizeLabel: '14 KB',
          offlineCached: true,
          linkedIds: [],
          versions: [],
          createdAt: now,
          updatedAt: now,
        };
        hydrated.unshift(clippedItem);
        window.history.replaceState({}, '', '/');
      }

      if (mounted) {
        setItems(hydrated);
      }
    }
    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveVaultSnapshotToIndexedDB(items).then(() => {
        setOfflineSyncTime(new Date().toISOString());
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [items]);

  // #49 APPROVED Stamp + Ding | #50 DENIED Stamp + Thud + Screen Shake
  const showToast = useCallback((msg: string, kind: 'approved' | 'denied' = 'approved') => {
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
  }, []);

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

  const updateItemById = useCallback((id: string, patch: Partial<VaultItem>) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, ...patch, updatedAt: new Date().toISOString() } : it
      )
    );
  }, []);

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

  // #37 Tin Trash Bin Crumple & Shred Delete
  const handleCrumpleDelete = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    playPaperCrumple();
    setCrumplingId(id);
    setTimeout(() => {
      setItems((prev) => prev.filter((it) => it.id !== id));
      setCrumplingId(null);
      showToast(`Đã vò nát & hủy hồ sơ "${title}" vào thùng rác thiếc.`, 'denied');
    }, 430);
  };

  // #42 Binder Clip Priority Toggle
  const toggleBinderPin = (e: React.MouseEvent, item: VaultItem) => {
    e.stopPropagation();
    playDateClick();
    updateItemById(item.id, { pinned: !item.pinned });
  };

  const activeItem = useMemo(
    () => items.find((it) => it.id === activeItemId) ?? null,
    [items, activeItemId]
  );

  const filteredItems = useMemo(() => {
    return items
      .filter((it) => {
        if (activeWorkspace !== 'all' && it.workspaceId !== activeWorkspace) return false;
        if (activeFolder !== 'Tất cả' && it.smartFolder !== activeFolder) return false;
        if (typeFilter !== 'all' && it.type !== typeFilter) return false;
        if (priorityFilter === 'pinned' && !it.pinned) return false;
        if (priorityFilter === 'standard' && it.pinned) return false;
        if (dateFilter && !it.updatedAt.startsWith(dateFilter) && !it.createdAt.startsWith(dateFilter)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  }, [items, activeWorkspace, activeFolder, typeFilter, priorityFilter, dateFilter]);

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

  // #56 Show Closed Top Secret Folder Cover until opened
  if (!dossierGateOpen) {
    return <TopSecretLoginGate onUnlock={() => setDossierGateOpen(true)} />;
  }

  return (
    <div
      className={`min-h-screen flex oak-desk-bg text-[#1B1510] dark:text-[#FFD6CE] relative ${
        screenShaking ? 'animate-stamp-shake' : ''
      }`}
    >
      {/* #4, #57, #58, #60, #27, #3 Background Desk Stains, Map, Marginalia, God Rays, Vignette & Grain */}
      <DeskBackgroundDecor />

      {/* #43 Camera Shutter Flash Overlay */}
      {cameraFlashing && (
        <div className="pointer-events-none fixed inset-0 z-[70] bg-[#FFF8E1] animate-camera-flash" />
      )}

      {/* MOBILE BACKDROP */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-[#120C08]/75 lg:hidden"
        />
      )}

      {/* #11 SIDEBAR METAL SPRING CLIPBOARD CLAMPING LINED MANILA PAPER */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[274px] p-2.5 lg:static lg:translate-x-0 transition-transform duration-200 flex flex-col shrink-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="relative flex-1 flex flex-col bg-[#5C3D24] dark:bg-[#2E0909] border-2 border-[#1A120B] p-2 pt-7 hard-shadow-lg">
          {/* Brushed Steel Spring Clipboard Clasp at Top */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-32 h-8 bg-gradient-to-b from-[#B9B2A8] via-[#8E877D] to-[#5E5850] border-2 border-[#1A120B] shadow-md flex items-center justify-center z-20">
            <div className="w-4 h-4 rounded-full border-2 border-[#1A120B] bg-[#2B1D13]" />
            <span className="ml-2 font-typewriter text-[9px] text-[#14100C] tracking-widest">
              BUREAU-CLIP
            </span>
          </div>

          {/* Paper Stack Clamped Under Clipboard */}
          <div className="flex-1 flex flex-col manila-paper border border-[#6E5332] overflow-hidden">
            {/* Bureau Header */}
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

            {/* #32 Rolodex-Style Workspace Selector */}
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
                  <option value="all">Toàn Cục Lưu Trữ ({items.length})</option>
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
                  const isSelected = activeFolder === folder && navSection === 'library' && !activeItem;
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
                        <Folder className="w-3.5 h-3.5 shrink-0 opacity-75" />
                        <span className="truncate">{folder}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Footer Police Shield Badge (#54) + Ember Alert (#51) + Offline PWA */}
            <div className="p-3 border-t-2 border-[#2A2018] dark:border-[#9E1B16] space-y-2.5 bg-[#DFC79C]/85 dark:bg-[#240606]">
              <button
                onClick={() => {
                  saveVaultSnapshotToIndexedDB(items).then(() => {
                    setOfflineSyncTime(new Date().toISOString());
                    showToast('Đã đồng bộ hồ sơ về bộ nhớ ngoại tuyến PWA (IndexedDB).', 'approved');
                  });
                }}
                className="w-full flex items-center justify-between px-3 py-2 bg-[#F5EAD2] dark:bg-[#1E0505] border border-[#6E5332] text-[11px] hover:bg-[#EBDAB9]"
              >
                <span className="flex items-center gap-1.5 font-typewriter">
                  <HardDriveDownload className="w-3.5 h-3.5 text-[#9E1B16]" />
                  Lưu Offline PWA
                </span>
                <span className="font-mono-tabular text-[10px]">
                  {offlineSyncTime
                    ? new Date(offlineSyncTime).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Sẵn sàng'}
                </span>
              </button>

              {/* #54 Police Shield Badge Avatar + #51 Glowing Ember Unread Indicator */}
              <div
                onClick={() => setHasUnreadAlert(false)}
                title="Thanh tra Minh Nguyễn · Nhấp để xác nhận thông báo ca trực"
                className="flex items-center gap-2.5 px-1 cursor-pointer"
              >
                <div className="relative w-10 h-11 shrink-0 flex items-center justify-center">
                  {/* Shield Border SVG */}
                  <svg viewBox="0 0 40 44" className="absolute inset-0 w-full h-full">
                    <path
                      d="M20 2 L36 8 V21 C36 31 28 38 20 42 C12 38 4 31 4 21 V8 Z"
                      fill="#C69C4B"
                      stroke="#1A120B"
                      strokeWidth="2.2"
                    />
                  </svg>
                  <img
                    src="/src/assets/images/vault_user_avatar_1794554761205.jpg"
                    alt="Thanh tra Minh Nguyễn"
                    referrerPolicy="no-referrer"
                    className="relative w-6 h-6 rounded-full object-cover border border-[#1A120B] sepia-[0.2]"
                  />
                  {/* #51 Glowing Cigarette Ember Unread Dot */}
                  {hasUnreadAlert && (
                    <span
                      className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#FF4500] border border-[#1A120B] shadow-[0_0_8px_#FF4500] animate-pulse"
                      title="Có manh mối mới chưa đọc"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-typewriter text-xs font-bold truncate">
                    TT. Minh Nguyễn
                  </div>
                  <div className="font-mono-tabular text-[10px] text-[#574A3D] dark:text-[#FF9E8E]">
                    Huy hiệu #4407 · Cấp {habits.level}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN ARCHIVE WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* TOP HEADER WITH #10 STAGGERED FOLDER TABS & #53 RED-STRING BREADCRUMBS */}
        <header className="px-4 sm:px-6 pt-2.5 pb-2 bg-[#2B1D13]/85 dark:bg-[#1A0404]/90 border-b-2 border-[#14100C] dark:border-[#9E1B16] flex flex-col gap-2 shrink-0">
          {/* Row 1: Staggered Manila Folder Tabs (#10) + Right Controls */}
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
              {/* #17 Brass Magnifying Glass Search Button */}
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 border-2 border-[#9E7531] bg-[#EBDAB9] dark:bg-[#2B0909] text-xs font-typewriter hover:border-[#9E1B16] whitespace-nowrap"
              >
                <Search className="w-3.5 h-3.5 text-[#9E1B16]" />
                <span className="hidden sm:inline">Soi Kính Lúp</span>
                <span className="font-mono-tabular text-[10px] opacity-70 hidden md:inline">⌘K</span>
              </button>

              {/* Vietnamese Bespoke Typography Specimen Modal Button */}
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

              {/* #59 Live Brass Pocket Watch */}
              <BureauPocketWatch />

              {/* #26 Metal Toggle Switch for #28 Darkroom Red Safelight Mode */}
              <MetalToggleSwitch
                checked={darkMode}
                onToggle={() => {
                  playDateClick();
                  setDarkMode((d) => !d);
                }}
                label="Phòng Rửa Ảnh"
              />

              {/* Re-lock Closed Folder Gate */}
              <button
                onClick={() => {
                  playStampThud();
                  setDossierGateOpen(false);
                }}
                title="Đóng bìa hồ sơ mật"
                className="p-1.5 border border-[#6E5332] bg-[#C9B38C] dark:bg-[#3A0C0C] hover:bg-[#DFC79C]"
              >
                <Lock className="w-4 h-4 text-[#1A120B] dark:text-[#FFD6CE]" />
              </button>

              <RubberStampButton onClick={() => setClipperOpen(true)} stampWord="INTAKE">
                <span className="inline-flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  Nạp Chứng Cứ
                </span>
              </RubberStampButton>
            </div>
          </div>

          {/* Row 2: #53 Red-String Breadcrumbs + Active Section/Item Bespoke Font Tag */}
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
                  <span className={`${ITEM_TYPE_TYPOGRAPHY[activeItem.type].titleClass} text-[#F5EAD2] truncate`}>
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

        {/* #49 APPROVED / #50 DENIED Rubber Stamp Toast */}
        {toastInfo && (
          <div className="fixed bottom-8 right-5 z-50 px-4 py-3 manila-paper torn-paper-card border-2 border-[#2A2018] hard-shadow-lg flex items-center gap-3 max-w-md">
            <span className={toastInfo.kind === 'approved' ? 'stamp-approved text-[10px]' : 'stamp-crimson text-[10px]'}>
              {toastInfo.kind === 'approved' ? 'APPROVED' : 'DENIED'}
            </span>
            <span className="font-typewriter text-xs">{toastInfo.msg}</span>
          </div>
        )}

        {/* CONTENT VIEWPORT */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            {activeItem ? (
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
                      <h1 className={`${ITEM_TYPE_TYPOGRAPHY[activeItem.type].titleClass} truncate`}>
                        {activeItem.title}
                      </h1>
                      <div className={`${ITEM_TYPE_TYPOGRAPHY[activeItem.type].metaClass} text-[#574A3D] dark:text-[#FF9E8E] flex flex-wrap items-center gap-2`}>
                        <span>{TYPE_LABEL[activeItem.type]}</span>
                        <span aria-hidden="true">·</span>
                        <span>Font: {ITEM_TYPE_TYPOGRAPHY[activeItem.type].badgeFontName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{activeItem.smartFolder}</span>
                        <span aria-hidden="true">·</span>
                        <span>{activeItem.fileSizeLabel}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="stamp-crimson text-[10px] hidden sm:inline-block">
                      HỒ SƠ ĐANG MỞ
                    </span>
                    <button
                      onClick={() => setShareTargetItem(activeItem)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F5EAD2] dark:bg-[#1E0505] border border-[#2A2018] text-xs font-typewriter uppercase hover:bg-[#DFC79C]"
                    >
                      <Share2 className="w-3.5 h-3.5 text-[#9E1B16]" />
                      Link Tự Hủy
                    </button>
                  </div>
                </div>

                {activeItem.type === 'pdf' ? (
                  <UniversalPdfReader
                    itemId={activeItem.id}
                    title={activeItem.title}
                    pdfBase64={activeItem.pdfDataBase64}
                    initialPage={jumpPage ?? activeItem.lastReadPage ?? 1}
                    annotations={activeItem.annotations ?? []}
                    onUpdateAnnotations={(anns) => updateItemById(activeItem.id, { annotations: anns })}
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
                    onUpdateItem={(patch) => updateItemById(activeItem.id, patch)}
                    onAddComment={(text) =>
                      setComments((prev) => [
                        ...prev,
                        {
                          id: crypto.randomUUID(),
                          itemId: activeItem.id,
                          author: 'Thanh tra Minh (Chủ trì)',
                          text,
                          createdAt: new Date().toISOString(),
                        },
                      ])
                    }
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
              />
            ) : navSection === 'graph' ? (
              <KnowledgeGraphView
                items={items}
                onOpenItem={(it) => openItem(it)}
                onCreateLink={(src, dst) => {
                  setItems((prev) =>
                    prev.map((it) =>
                      it.id === src && !it.linkedIds.includes(dst)
                        ? { ...it, linkedIds: [...it.linkedIds, dst] }
                        : it
                    )
                  );
                  handleGainExp(10, 'Căng dây đỏ liên kết đầu mối');
                }}
              />
            ) : navSection === 'canvas' ? (
              <InfiniteCanvasView
                items={items}
                positions={canvasPositions}
                connections={canvasConnections}
                onUpdatePositions={setCanvasPositions}
                onAddConnection={(fromId, toId) => {
                  setCanvasConnections((prev) => [
                    ...prev,
                    { id: crypto.randomUUID(), fromId, toId },
                  ]);
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
              /* EVIDENCE & DOSSIER CATALOG */
              <div className="space-y-5">
                <div className="p-5 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="font-mono-tabular text-[11px] uppercase tracking-widest text-[#574A3D] dark:text-[#FF9E8E]">
                        DANH MỤC LƯU TRỮ · CATALOG INDEX
                      </div>
                      <h1 className="font-typewriter text-2xl font-bold tracking-tight">
                        Kho Hồ Sơ & Vật Chứng Cục Lưu Trữ
                      </h1>
                    </div>

                    {/* #23 Polaroid Scattered Gallery Mode Toggle + #34 Rolling Date Stamp Filter */}
                    <div className="flex flex-wrap items-center gap-2">
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

                  <div className="masking-tape-divider" />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Type Filter */}
                    <div className="flex flex-wrap items-center gap-1">
                      {(
                        [
                          { id: 'all', label: 'Tất cả' },
                          { id: 'pdf', label: 'Hồ sơ PDF' },
                          { id: 'web_archive', label: 'Báo / Web' },
                          { id: 'video', label: 'CCTV / Video' },
                          { id: 'note', label: 'Sổ tay' },
                          { id: 'image', label: 'Ảnh Chứng cứ' },
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

                    {/* #42 Colored Binder Clips Priority Sorting */}
                    <div className="flex items-center gap-1.5">
                      <span className="font-typewriter text-[10px] uppercase">Kẹp Phân Loại:</span>
                      {(
                        [
                          { id: 'all', label: 'Tất cả', clipColor: 'bg-[#2A2018]' },
                          { id: 'pinned', label: 'Khẩn cấp', clipColor: 'bg-[#9E1B16]' },
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
                          <span className={`w-2.5 h-2.5 ${p.clipColor} border border-[#F5EAD2]`} />
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {filteredItems.length === 0 ? (
                  /* #24 Empty State (Ashtray, Empty Mug, Crumpled Paper) */
                  <EmptyAshtrayState onAction={() => setClipperOpen(true)} />
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
                          {/* #42 Clickable Colored Binder Clip Top Corner */}
                          <button
                            type="button"
                            onClick={(e) => toggleBinderPin(e, item)}
                            title={item.pinned ? 'Kẹp Đỏ: Khẩn cấp (Nhấn để đổi)' : 'Kẹp Đồng: Thường (Nhấn để gắn Khẩn cấp)'}
                            className={`absolute -top-2.5 left-4 px-2 py-0.5 border border-[#1A120B] text-[9px] font-stamp uppercase text-[#F5EAD2] z-10 flex items-center gap-1 shadow-sm ${
                              item.pinned ? 'bg-[#9E1B16]' : 'bg-[#7A5E35]'
                            }`}
                          >
                            <Paperclip className="w-2.5 h-2.5" />
                            {item.pinned ? 'KHẨN' : 'LƯU'}
                          </button>

                          {/* Specimen Header Strip using category-specific metaClass */}
                          <div className={`px-4 pt-3 pb-2 border-b border-[#6E5332]/40 flex items-center justify-between ${itemTypo.metaClass}`}>
                            <span>CAT. Nº LP-{String(idx + 1).padStart(3, '0')}</span>
                            <span className="flex items-center gap-1.5">
                              {/* #15 Custom Detective Evidence Illustrations */}
                              <EvidenceThumbnailIcon type={item.type} />
                              <span>{TYPE_LABEL[item.type]}</span>
                            </span>
                          </div>

                          {item.coverImage ? (
                            <div
                              className={`${
                                polaroidMode ? 'h-52 my-2 border-2 border-[#2A2018]' : 'h-44 border-b border-[#6E5332]/40'
                              } bg-[#1C1612] overflow-hidden`}
                            >
                              <img
                                src={item.coverImage}
                                alt={item.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover sepia-[0.22] group-hover:scale-[1.03] transition-transform duration-200"
                              />
                            </div>
                          ) : null}

                          <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`${itemTypo.metaClass} opacity-75 truncate`}>
                                  {item.smartFolder} · {item.fileSizeLabel}
                                </span>
                                <span className="px-1.5 py-0.5 bg-[#2A2018]/10 dark:bg-[#9E1B16]/25 border border-[#6E5332]/60 font-cipher text-[9px] uppercase shrink-0">
                                  {itemTypo.badgeFontName}
                                </span>
                              </div>

                              {/* Title using bespoke Vietnamese font per item category */}
                              <h3
                                className={`${
                                  polaroidMode ? 'font-polaroid text-lg font-bold' : itemTypo.titleClass
                                } leading-snug line-clamp-2 group-hover:text-[#9E1B16] dark:group-hover:text-[#FF6B5B] transition-colors`}
                              >
                                {item.title}
                              </h3>

                              {/* Excerpt using bespoke Vietnamese body font per item category */}
                              <p className={`${itemTypo.bodyClass} line-clamp-2 leading-snug opacity-90`}>
                                {item.excerpt}
                              </p>
                            </div>

                            <div className="pt-3 border-t border-[#6E5332]/40 flex items-center justify-between gap-2">
                              {/* #25 Baggage Tags */}
                              <div className="flex flex-wrap gap-1.5 min-w-0">
                                {item.tags.slice(0, 2).map((tag) => (
                                  <BaggageTag key={tag} text={tag} />
                                ))}
                              </div>

                              {/* #37 Tin Trash Bin Crumple Delete */}
                              <button
                                type="button"
                                onClick={(e) => handleCrumpleDelete(e, item.id, item.title)}
                                title="Vò nát & bỏ vào thùng rác thiếc"
                                className="p-1.5 border border-[#6E5332] bg-[#EBDAB9] dark:bg-[#240606] hover:bg-[#9E1B16] hover:text-white transition-colors shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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

        {/* #55 CLASSIFIED FOOTER DISCLAIMER */}
        <footer className="px-4 py-1.5 bg-[#1B120B] dark:bg-[#140202] border-t border-[#463526] dark:border-[#6E120E] text-center font-typewriter text-[10px] tracking-[0.22em] text-[#C9B38C] dark:text-[#FF8C7A] uppercase shrink-0">
          PROPERTY OF SCOTLAND YARD · BUREAU OF ARCHIVES · DO NOT DISTRIBUTE
        </footer>
      </div>

      {/* MODALS */}
      <QuickClipperModal
        isOpen={clipperOpen}
        onClose={() => setClipperOpen(false)}
        activeWorkspace={activeWorkspace === 'all' ? 'personal' : activeWorkspace}
        onAddItem={(newItem) => {
          setItems((prev) => [newItem, ...prev]);
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
              fileSizeLabel: `${Math.max(50, Math.round((base64.length * 0.75) / 1024))} KB`,
              offlineCached: true,
              linkedIds: [activeItem.id],
              annotations: [],
              versions: [],
              createdAt: now,
              updatedAt: now,
            };
            setItems((prev) => [created, ...prev]);
            openItem(created, { page: 1 });
            handleGainExp(20, 'Cắt / Gộp hồ sơ PDF');
          }}
        />
      )}
    </div>
  );
}
