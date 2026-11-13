import React, { useState } from 'react';
import {
  FileUp,
  Globe,
  Link2,
  Puzzle,
  Sparkles,
  StickyNote,
  Video,
} from 'lucide-react';
import type { VaultItem, VaultItemType, WorkspaceId } from '@/src/types/vault';
import { uint8ToBase64 } from '@/src/utils/pdfFactory';
import {
  InkCheckbox,
  PaperclipCloseBtn,
  RevolverSpinner,
  RubberStampButton,
} from '@/src/components/bureau/BureauDecorations';

interface QuickClipperModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeWorkspace: WorkspaceId;
  onAddItem: (item: VaultItem) => void;
  onGainExp: (amount: number, reason: string) => void;
}

export default function QuickClipperModal({
  isOpen,
  onClose,
  activeWorkspace,
  onAddItem,
  onGainExp,
}: QuickClipperModalProps) {
  const [tab, setTab] = useState<'file' | 'web' | 'note' | 'extension'>('file');
  const [webUrl, setWebUrl] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaTitle, setMediaTitle] = useState('');
  const [autoTag, setAutoTag] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const runAutoTagIfEnabled = async (title: string, content: string, type: string) => {
    if (!autoTag) return { tags: [type], smartFolder: 'Tài liệu PDF' };
    try {
      const res = await fetch('/api/ai/autotag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, type }),
      });
      if (!res.ok) throw new Error();
      return await res.json();
    } catch {
      return { tags: [type, 'Mới nhập kho'], smartFolder: 'Ghi chú Cá nhân' };
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const now = new Date().toISOString();
      let type: VaultItemType = 'note';
      let pdfDataBase64: string | undefined;
      let pageCount: number | undefined;
      let mediaObjectUrl: string | undefined;
      let coverImage: string | undefined;
      let content = `Tệp chứng cứ nạp kho: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

      if (ext === 'pdf' || file.type === 'application/pdf') {
        type = 'pdf';
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        pdfDataBase64 = uint8ToBase64(bytes);

        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
        pageCount = doc.numPages;

        const firstPage = await doc.getPage(1);
        const tc = await firstPage.getTextContent();
        const firstText = tc.items.map((it) => ('str' in it ? it.str : '')).join(' ').trim();
        if (firstText) content = firstText.slice(0, 4000);
      } else if (file.type.startsWith('video/')) {
        type = 'video';
        mediaObjectUrl = URL.createObjectURL(file);
      } else if (file.type.startsWith('audio/')) {
        type = 'audio';
        mediaObjectUrl = URL.createObjectURL(file);
      } else if (file.type.startsWith('image/')) {
        type = 'image';
        coverImage = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv'].includes(ext)) {
        type = 'office_doc';
        content = await file.text();
      } else if (['obj', 'glb', 'gltf'].includes(ext)) {
        type = 'model_3d';
      } else {
        type = 'note';
        content = await file.text();
      }

      const aiMeta = await runAutoTagIfEnabled(file.name, content, type);
      const sizeLabel =
        file.size >= 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.max(1, Math.round(file.size / 1024))} KB`;

      onAddItem({
        id: `${type}-${crypto.randomUUID().slice(0, 8)}`,
        workspaceId: activeWorkspace,
        title: file.name.replace(/\.[^/.]+$/, ''),
        type,
        smartFolder: aiMeta.smartFolder || 'Tài liệu PDF',
        tags: Array.isArray(aiMeta.tags) ? aiMeta.tags : [type.toUpperCase()],
        excerpt: aiMeta.oneLineSummary || content.slice(0, 140),
        content,
        pdfDataBase64,
        pageCount,
        lastReadPage: type === 'pdf' ? 1 : undefined,
        readProgressPct: 0,
        mediaUrl: mediaObjectUrl,
        coverImage,
        fileSizeLabel: sizeLabel,
        offlineCached: true,
        linkedIds: [],
        annotations: [],
        versions: [],
        createdAt: now,
        updatedAt: now,
      });
      onGainExp(20, 'Nạp hồ sơ chứng cứ mới');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đọc tệp đã chọn.');
    } finally {
      setLoading(false);
    }
  };

  const handleClipWebUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webUrl.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/clip-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể lưu trang web.');

      const aiMeta = await runAutoTagIfEnabled(data.title, data.cleanContent, 'web_archive');
      const now = new Date().toISOString();

      onAddItem({
        id: `web-${crypto.randomUUID().slice(0, 8)}`,
        workspaceId: activeWorkspace,
        title: data.title,
        type: 'web_archive',
        smartFolder: aiMeta.smartFolder || 'Nghiên cứu AI',
        tags: Array.isArray(aiMeta.tags) ? aiMeta.tags : ['Web Archive', 'Zen Mode'],
        excerpt: aiMeta.oneLineSummary || data.cleanContent.slice(0, 140),
        content: data.cleanContent,
        sourceUrl: data.url,
        snapshotHtml: data.snapshotHtml,
        fileSizeLabel: `${Math.max(12, Math.round((data.snapshotHtml?.length || 4000) / 1024))} KB`,
        offlineCached: true,
        linkedIds: [],
        versions: [],
        createdAt: now,
        updatedAt: now,
      });
      onGainExp(20, 'Chụp bản lưu Web Archive ngoại tuyến');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi lưu Web Archive.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuickNoteOrVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const now = new Date().toISOString();
      if (mediaUrl.trim()) {
        const title = mediaTitle.trim() || 'Băng Video / CCTV mới';
        const aiMeta = await runAutoTagIfEnabled(title, mediaUrl, 'video');
        onAddItem({
          id: `video-${crypto.randomUUID().slice(0, 8)}`,
          workspaceId: activeWorkspace,
          title,
          type: 'video',
          smartFolder: aiMeta.smartFolder || 'Tư liệu Media',
          tags: Array.isArray(aiMeta.tags) ? aiMeta.tags : ['Video', 'CCTV'],
          excerpt: aiMeta.oneLineSummary || `Băng ghi từ ${mediaUrl}`,
          content: `Video URL: ${mediaUrl}`,
          sourceUrl: mediaUrl.trim(),
          mediaUrl: mediaUrl.trim(),
          fileSizeLabel: 'Stream',
          timestampNotes: [],
          subtitles: [],
          linkedIds: [],
          versions: [],
          createdAt: now,
          updatedAt: now,
        });
      } else {
        if (!noteTitle.trim() || !noteContent.trim()) {
          throw new Error('Vui lòng nhập tiêu đề và nội dung ghi chú.');
        }
        const aiMeta = await runAutoTagIfEnabled(noteTitle, noteContent, 'note');
        onAddItem({
          id: `note-${crypto.randomUUID().slice(0, 8)}`,
          workspaceId: activeWorkspace,
          title: noteTitle.trim(),
          type: 'note',
          smartFolder: aiMeta.smartFolder || 'Ghi chú Cá nhân',
          tags: Array.isArray(aiMeta.tags) ? aiMeta.tags : ['Sổ tay'],
          excerpt: aiMeta.oneLineSummary || noteContent.slice(0, 140),
          content: noteContent.trim(),
          fileSizeLabel: `${Math.max(1, Math.round(noteContent.length / 1024))} KB`,
          offlineCached: true,
          linkedIds: [],
          versions: [
            {
              id: crypto.randomUUID(),
              versionNumber: 1,
              summary: 'Khởi tạo biên bản ghi chú mới',
              contentSnapshot: noteContent.trim(),
              savedAt: now,
              author: 'Thanh tra',
            },
          ],
          createdAt: now,
          updatedAt: now,
        });
      }
      onGainExp(15, 'Lưu biên bản điều tra mới');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi lưu.');
    } finally {
      setLoading(false);
    }
  };

  const bookmarkletCode = `javascript:(function(){const sel=window.getSelection().toString();const url=encodeURIComponent(location.href);const t=encodeURIComponent(document.title);window.open('${window.location.origin}/?clipUrl='+url+'&clipTitle='+t+'&clipText='+encodeURIComponent(sel),'_blank');})();`;

  return (
    <div className="fixed inset-0 z-50 bg-[#120C08]/80 flex items-center justify-center p-4">
      {/* #52: Cigarette Smoke Drift Layer */}
      <div className="smoke-overlay fixed inset-0" />

      {/* #22: Torn Sticky-Note Modal pinned by Red Thumbtack */}
      <div className="relative w-full max-w-2xl manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] hard-shadow-lg overflow-visible">
        {/* Red 3D Thumbtack Pin */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#9E1B16] border-2 border-[#F5EAD2] shadow-[2px_3px_0px_rgba(14,9,5,0.65)] z-20" />

        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#2A2018] dark:border-[#9E1B16] bg-[#DFC79C] dark:bg-[#3A0C0C]">
          <h3 className="font-typewriter font-bold text-sm sm:text-base uppercase tracking-wider">
            NẠP CHỨNG CỨ & TÀI LIỆU MỚI (INBOX)
          </h3>
          {/* #16: Paperclip Close */}
          <PaperclipCloseBtn onClose={onClose} />
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {[
              { id: 'file', icon: FileUp, label: 'Tải Tệp Lên' },
              { id: 'web', icon: Globe, label: 'Web Archive' },
              { id: 'note', icon: StickyNote, label: 'Biên bản / CCTV' },
              { id: 'extension', icon: Puzzle, label: 'Extension 1-Click' },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as typeof tab)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 border text-xs font-typewriter uppercase whitespace-nowrap transition-colors ${
                    tab === t.id
                      ? 'bg-[#9E1B16] text-[#F5EAD2] border-[#2A2018]'
                      : 'bg-[#F5EAD2] dark:bg-[#1E0505] border-[#6E5332] text-[#3A2E23] dark:text-[#FF9E8E]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#F5EAD2] dark:bg-[#1E0505] border border-[#6E5332]">
            <span className="flex items-center gap-2 text-xs font-medium">
              <Sparkles className="w-4 h-4 text-[#9E1B16] dark:text-[#FF6B5B]" />
              AI Tự Động Gắn Thẻ & Phân Ngăn Hồ Sơ Thông Minh
            </span>
            <InkCheckbox checked={autoTag} onChange={() => setAutoTag((v) => !v)} />
          </div>

          {/* #36: Wooden INBOX Desk Tray Upload Zone */}
          {tab === 'file' && (
            <label className="relative flex flex-col items-center justify-center gap-3 p-8 bg-[#5C3D24] dark:bg-[#2E0A0A] border-4 border-[#3A2413] dark:border-[#8C201B] text-center cursor-pointer hard-shadow">
              <span className="px-3 py-0.5 bg-gradient-to-b from-[#DFBD73] to-[#9E7531] border border-[#2A2018] text-[#1A120B] font-typewriter text-[11px] uppercase tracking-widest">
                INBOX · KHAY TIẾP NHẬN HỒ SƠ
              </span>

              <div className="w-full p-6 manila-paper border-2 border-dashed border-[#6E5332] hover:border-[#9E1B16] transition-colors flex flex-col items-center gap-2">
                {loading ? (
                  <RevolverSpinner label="Đang niêm phong & phân tích tệp..." />
                ) : (
                  <>
                    <FileUp className="w-8 h-8 text-[#9E1B16] dark:text-[#FF6B5B]" />
                    <p className="font-typewriter text-sm font-bold">
                      Thả tệp PDF, Video CCTV, Ghi âm, Ảnh, Office hoặc 3D (.OBJ) vào khay
                    </p>
                    <p className="font-handwriting text-lg text-[#574A3D] dark:text-[#FF9E8E]">
                      Tự động hỗ trợ Lật sách 3D, gắn Timestamp, AI OCR và lưu ngoại tuyến
                    </p>
                  </>
                )}
              </div>

              <input
                type="file"
                disabled={loading}
                onChange={handleFileUpload}
                accept=".pdf,.mp4,.webm,.mp3,.wav,.png,.jpg,.jpeg,.webp,.md,.txt,.csv,.docx,.xlsx,.obj"
                className="hidden"
              />
            </label>
          )}

          {tab === 'web' && (
            <form onSubmit={handleClipWebUrl} className="space-y-3">
              <label className="block text-xs font-medium text-[#574A3D] dark:text-[#FF9E8E]">
                Nhập URL bài báo / tài liệu muốn chụp bản lưu trữ ngoại tuyến (HTML + Zen Mode)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  required
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  placeholder="https://en.wikipedia.org/wiki/Forensic_science"
                  className="flex-1 px-3.5 py-2.5 text-sm border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505]"
                />
                <RubberStampButton type="submit" disabled={loading} stampWord="ARCHIVED">
                  {loading ? 'Đang chụp...' : 'Lưu Web Archive'}
                </RubberStampButton>
              </div>
            </form>
          )}

          {tab === 'note' && (
            <form onSubmit={handleSaveQuickNoteOrVideo} className="space-y-4">
              <div className="p-3.5 border border-[#6E5332] bg-[#F5EAD2]/80 dark:bg-[#1E0505] space-y-2.5">
                <div className="text-xs font-typewriter font-semibold flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-[#9E1B16]" />
                  Lưu nhanh Link Video Giám Sát / YouTube / MP4
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={mediaTitle}
                    onChange={(e) => setMediaTitle(e.target.value)}
                    placeholder="Tiêu đề băng video..."
                    className="px-3 py-2 text-xs border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#240606]"
                  />
                  <input
                    type="url"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="px-3 py-2 text-xs border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#240606]"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Tiêu đề biên bản / ghi chú điều tra..."
                  className="w-full px-3 py-2 text-sm border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505]"
                />
                <textarea
                  rows={4}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Nội dung biên bản, lời khai hoặc đoạn mã..."
                  className="w-full px-3 py-2 font-handwriting text-lg border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505]"
                />
              </div>

              <div className="flex justify-end">
                <RubberStampButton type="submit" disabled={loading} stampWord="FILED">
                  {loading ? 'Đang lưu...' : 'Niêm phong vào Kho'}
                </RubberStampButton>
              </div>
            </form>
          )}

          {tab === 'extension' && (
            <div className="space-y-3 text-xs">
              <p>
                Kéo hoặc sao chép Bookmarklet dưới đây lên thanh dấu trang Chrome/Edge để lưu trang web hoặc đoạn bôi đen vào Kho Hồ Sơ chỉ bằng 1 lần nhấn:
              </p>
              <pre className="p-3 bg-[#14100C] text-[#EBDAB9] font-mono text-[11px] overflow-x-auto">
                {bookmarkletCode}
              </pre>
              <div className="flex justify-end">
                <RubberStampButton
                  onClick={() => navigator.clipboard?.writeText(bookmarkletCode)}
                  stampWord="COPIED"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" />
                    Sao chép Bookmarklet
                  </span>
                </RubberStampButton>
              </div>
            </div>
          )}

          {error && <p className="text-xs font-typewriter text-[#9E1B16] dark:text-[#FF6B5B]">{error}</p>}
        </div>
      </div>
    </div>
  );
}
