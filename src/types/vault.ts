export type VaultItemType =
  | 'pdf'
  | 'office_doc'
  | 'web_archive'
  | 'video'
  | 'audio'
  | 'note'
  | 'image'
  | 'model_3d';

export type WorkspaceId = 'personal' | 'design-lab' | 'engineering';

export type NavSection =
  | 'dashboard'
  | 'library'
  | 'clipper'
  | 'graph'
  | 'canvas'
  | 'e2ee'
  | 'habits';

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface PdfAnnotation {
  id: string;
  page: number;
  kind: 'highlight' | 'underline' | 'draw' | 'sticky' | 'text' | 'redact';
  color: string;
  points?: NormalizedPoint[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  content?: string;
  author?: string;
  createdAt: string;
}

export interface TimestampNote {
  id: string;
  timestampSec: number;
  text: string;
  createdAt: string;
}

export interface SubtitleCue {
  startSec: number;
  endSec: number;
  text: string;
}

export interface ItemVersion {
  id: string;
  versionNumber: number;
  summary: string;
  contentSnapshot: string;
  savedAt: string;
  author: string;
}

export interface CanvasNodePos {
  x: number;
  y: number;
  width?: number;
}

export interface VaultItem {
  id: string;
  workspaceId: WorkspaceId;
  title: string;
  type: VaultItemType;
  smartFolder: string;
  tags: string[];
  excerpt: string;
  content: string;
  sourceUrl?: string;
  snapshotHtml?: string;
  coverImage?: string;
  fileSizeLabel: string;
  pageCount?: number;
  lastReadPage?: number;
  readProgressPct?: number;
  durationSec?: number;
  mediaUrl?: string;
  pdfDataBase64?: string; // Stored client-side / IndexedDB for real PDF.js + pdf-lib editing & flipbook
  annotations?: PdfAnnotation[];
  timestampNotes?: TimestampNote[];
  subtitles?: SubtitleCue[];
  aiSummary?: string;
  ocrText?: string;
  linkedIds: string[];
  versions: ItemVersion[];
  isEncrypted?: boolean;
  encryptedPayload?: {
    iv: string;
    salt: string;
    ciphertext: string;
  };
  offlineCached?: boolean;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasConnection {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
}

export interface DashboardWidget {
  id: 'continue-reading' | 'watch-queue' | 'daily-quote' | 'habit-summary';
  title: string;
  visible: boolean;
}

export interface HabitProfile {
  expPoints: number;
  level: number;
  streakDays: number;
  readingMinutesToday: number;
  dailyGoalMinutes: number;
  badges: Array<{ id: string; name: string; description: string; earned: boolean }>;
}

export interface CollaborativeComment {
  id: string;
  itemId: string;
  author: string;
  text: string;
  createdAt: string;
}
