import React, { useEffect, useState } from 'react';
import {
  BookmarkPlus,
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
import { extractImageFromClipboardEvent } from '@/src/utils/imagePasteHelper';
import {
  ClipboardImagePasteBox,
  CustomTagEditor,
} from '@/src/components/bureau/CustomTagManager';
import {
  InkCheckbox,
  PaperclipCloseBtn,
  RevolverSpinner,
  RubberStampButton,
} from '@/src/components/bureau/BureauDecorations';
import { playTypewriterDing } from '@/src/utils/bureauAudio';

interface QuickClipperModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeWorkspace: WorkspaceId;
  existingVaultTags?: string[];
  initialTab?: 'bookmark' | 'file' | 'web' | 'note' | 'extension';
  onAddItem: (item: VaultItem) => void;
  onGainExp: (amount: number, reason: string) => void;
}

export default function QuickClipperModal({
  isOpen,
  onClose,
  activeWorkspace,
  existingVaultTags = [],
  initialTab = 'bookmark',
  onAddItem,
  onGainExp,
}: QuickClipperModalProps) {
  const [tab, setTab] = useState<'bookmark' | 'file' | 'web' | 'note' | 'extension'>(initialTab);

  // Shared custom tags & pasted cover image across all creation tabs
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [pastedCoverImage, setPastedCoverImage] = useState<string | undefined>(undefined);
  const [selectedFolder, setSelectedFolder] = useState<string>('Trang Web Thường Tới');

  // Frequent Website Bookmark state
  const [siteUrl, setSiteUrl] = useState('');
  const [siteTitle, setSiteTitle] = useState('');
  const [siteDesc, setSiteDesc] = useState('');

  // Web Archive state
  const [webUrl, setWebUrl] = useState('');

  // Note / Video state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaTitle, setMediaTitle] = useState('');

  const [autoTag, setAutoTag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setError(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const mergeTags = (aiTags: string[] = [], fallbackTag?: string): string[] => {
    const combined = [...customTags];
    aiTags.forEach((t) => {
      const clean = t.trim();
      if (clean && !combined.some((c) => c.toLowerCase() === clean.toLowerCase())) {
        combined.push(clean);
      }
    });
    if (combined.length === 0 && fallbackTag) {
      combined.push(fallbackTag);
    }
    return combined.slice(0, 10);
  };

  const runAutoTagIfEnabled = async (title: string, content: string, type: string) => {
    if (!autoTag) return { tags: [], smartFolder: '' };
    try {
      const res = await fetch('/api/ai/autotag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, type }),
      });
      if (!res.ok) throw new Error();
      return await res.json();
    } catch {
      return { tags: [], smartFolder: '' };
    }
  };

  // Global paste listener on modal so pressing Ctrl+V anywhere pastes the image
  const handleModalPaste = async (e: React.ClipboardEvent) => {
    const imgDataUrl = await extractImageFromClipboardEvent(e);
    if (imgDataUrl) {
      e.preventDefault();
      setPastedCoverImage(imgDataUrl);
      playTypewriterDing();
    }
  };

  const resetFormState = () => {
    setSiteUrl('');
    setSiteTitle('');
    setSiteDesc('');
    setWebUrl('');
    setNoteTitle('');
    setNoteContent('');
    setMediaUrl('');
    setMediaTitle('');
    setCustomTags([]);
    setPastedCoverImage(undefined);
    setError(null);
  };

  // 1. Save Frequent Website (Bookmark with URL + Description + Copy-Pasted Image + Custom Tags)
  const handleSaveFrequentWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let normalizedUrl = siteUrl.trim();
    if (!normalizedUrl) {
      setError('Vui lòng nhập đường dẫn (URL) trang web bạn muốn lưu.');
      return;
    }
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    let hostname = normalizedUrl;
    try {
      hostname = new URL(normalizedUrl).hostname.replace(/^www\./, '');
    } catch {
      // keep raw
    }

    const finalTitle = siteTitle.trim() || hostname;
    const finalDesc =
      siteDesc.trim() || `Trang web thường xuyên lui tới: ${normalizedUrl}`;

    setLoading(true);
    try {
      const aiMeta = await runAutoTagIfEnabled(finalTitle, finalDesc, 'web_archive');
      const now = new Date().toISOString();
      const finalTags = mergeTags(
        Array.isArray(aiMeta.tags) ? aiMeta.tags : [],
        'Web Thường Tới'
      );

      onAddItem({
        id: `web-${crypto.randomUUID().slice(0, 8)}`,
        workspaceId: activeWorkspace,
        title: finalTitle,
        type: 'web_archive',
        smartFolder: selectedFolder || 'Trang Web Thường Tới',
        tags: finalTags,
        excerpt: finalDesc.slice(0, 180),
        content: finalDesc,
        sourceUrl: normalizedUrl,
        coverImage: pastedCoverImage,
        fileSizeLabel: hostname,
        offlineCached: true,
        linkedIds: [],
        versions: [
          {
            id: crypto.randomUUID(),
            versionNumber: 1,
            summary: 'Lưu trang web thường xuyên lui tới',
            contentSnapshot: finalDesc,
            savedAt: now,
            author: 'Thanh tra',
          },
        ],
        createdAt: now,
        updatedAt: now,
      });

      onGainExp(20, 'Lưu trang web thường tới vào Sổ Địa Chỉ');
      resetFormState();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi lưu trang web.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Upload Document / File (PDF, Video, Image, Office, 3D, Note) with Custom Tags & Optional Pasted Cover
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
      let coverImage: string | undefined = pastedCoverImage;
      let defaultFolder = 'Tài liệu PDF';
      let content = `Tệp chứng cứ nạp kho: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

      if (ext === 'pdf' || file.type === 'application/pdf') {
        type = 'pdf';
        defaultFolder = 'Tài liệu PDF';
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
        defaultFolder = 'Tư liệu Media';
        mediaObjectUrl = URL.createObjectURL(file);
      } else if (file.type.startsWith('audio/')) {
        type = 'audio';
        defaultFolder = 'Tư liệu Media';
        mediaObjectUrl = URL.createObjectURL(file);
      } else if (file.type.startsWith('image/')) {
        type = 'image';
        defaultFolder = 'Tư liệu Media';
        const { fileOrBlobToCompressedDataUrl } = await import('@/src/utils/imagePasteHelper');
        coverImage = await fileOrBlobToCompressedDataUrl(file);
      } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv'].includes(ext)) {
        type = 'office_doc';
        defaultFolder = 'Kiến trúc & Hệ thống';
        content = await file.text();
      } else if (['obj', 'glb', 'gltf'].includes(ext)) {
        type = 'model_3d';
        defaultFolder = 'Kiến trúc & Hệ thống';
      } else {
        type = 'note';
        defaultFolder = 'Ghi chú Cá nhân';
        content = await file.text();
      }

      const aiMeta = await runAutoTagIfEnabled(file.name, content, type);
      const sizeLabel =
        file.size >= 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.max(1, Math.round(file.size / 1024))} KB`;

      const finalTags = mergeTags(
        Array.isArray(aiMeta.tags) ? aiMeta.tags : [],
        type.toUpperCase()
      );

      onAddItem({
        id: `${type}-${crypto.randomUUID().slice(0, 8)}`,
        workspaceId: activeWorkspace,
        title: file.name.replace(/\.[^/.]+$/, ''),
        type,
        smartFolder: aiMeta.smartFolder || defaultFolder,
        tags: finalTags,
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
      resetFormState();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đọc tệp đã chọn.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Clip Full Article Web Archive
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
      const finalTags = mergeTags(
        Array.isArray(aiMeta.tags) ? aiMeta.tags : [],
        'Web Archive'
      );

      onAddItem({
        id: `web-${crypto.randomUUID().slice(0, 8)}`,
        workspaceId: activeWorkspace,
        title: data.title,
        type: 'web_archive',
        smartFolder: aiMeta.smartFolder || 'Trang Web Thường Tới',
        tags: finalTags,
        excerpt: aiMeta.oneLineSummary || data.cleanContent.slice(0, 140),
        content: data.cleanContent,
        sourceUrl: data.url,
        coverImage: pastedCoverImage,
        snapshotHtml: data.snapshotHtml,
        fileSizeLabel: `${Math.max(12, Math.round((data.snapshotHtml?.length || 4000) / 1024))} KB`,
        offlineCached: true,
        linkedIds: [],
        versions: [],
        createdAt: now,
        updatedAt: now,
      });
      onGainExp(20, 'Chụp bản lưu Web Archive ngoại tuyến');
      resetFormState();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi lưu Web Archive.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Save Note or Video Link
  const handleSaveQuickNoteOrVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const now = new Date().toISOString();
      if (mediaUrl.trim()) {
        const title = mediaTitle.trim() || 'Băng Video / CCTV mới';
        const aiMeta = await runAutoTagIfEnabled(title, mediaUrl, 'video');
        const finalTags = mergeTags(
          Array.isArray(aiMeta.tags) ? aiMeta.tags : [],
          'Video'
        );
        onAddItem({
          id: `video-${crypto.randomUUID().slice(0, 8)}`,
          workspaceId: activeWorkspace,
          title,
          type: 'video',
          smartFolder: aiMeta.smartFolder || 'Tư liệu Media',
          tags: finalTags,
          excerpt: aiMeta.oneLineSummary || noteContent.trim() || `Băng ghi từ ${mediaUrl}`,
          content: noteContent.trim() || `Video URL: ${mediaUrl}`,
          sourceUrl: mediaUrl.trim(),
          mediaUrl: mediaUrl.trim(),
          coverImage: pastedCoverImage,
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
        const finalTags = mergeTags(
          Array.isArray(aiMeta.tags) ? aiMeta.tags : [],
          'Sổ tay'
        );
        onAddItem({
          id: `note-${crypto.randomUUID().slice(0, 8)}`,
          workspaceId: activeWorkspace,
          title: noteTitle.trim(),
          type: 'note',
          smartFolder: aiMeta.smartFolder || 'Ghi chú Cá nhân',
          tags: finalTags,
          excerpt: aiMeta.oneLineSummary || noteContent.slice(0, 140),
          content: noteContent.trim(),
          coverImage: pastedCoverImage,
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
      resetFormState();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi lưu.');
    } finally {
      setLoading(false);
    }
  };

  const bookmarkletCode = `javascript:(function(){const sel=window.getSelection().toString();const url=encodeURIComponent(location.href);const t=encodeURIComponent(document.title);window.open('${window.location.origin}/?clipUrl='+url+'&clipTitle='+t+'&clipText='+encodeURIComponent(sel),'_blank');})();`;

  return (
    <div
      onPaste={handleModalPaste}
      className="fixed inset-0 z-50 bg-[#120C08]/80 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div className="smoke-overlay fixed inset-0" />

      <div className="relative w-full max-w-3xl manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] hard-shadow-lg overflow-visible my-auto max-h-[92vh] flex flex-col">
        {/* Red 3D Thumbtack Pin */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#9E1B16] border-2 border-[#F5EAD2] shadow-[2px_3px_0px_rgba(14,9,5,0.65)] z-20" />

        <div className="flex items-center justify-between px-5 py-3.5 border-b-2 border-[#2A2018] dark:border-[#9E1B16] bg-[#DFC79C] dark:bg-[#3A0C0C] shrink-0">
          <h3 className="font-typewriter font-bold text-sm sm:text-base uppercase tracking-wider">
            LƯU TRANG WEB THƯỜNG TỚI & NẠP TÀI LIỆU (INBOX)
          </h3>
          <PaperclipCloseBtn onClose={onClose} />
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Mode Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {[
              { id: 'bookmark', icon: BookmarkPlus, label: 'Lưu Trang Web' },
              { id: 'file', icon: FileUp, label: 'Tải Tài Liệu' },
              { id: 'note', icon: StickyNote, label: 'Biên Bản / Video' },
              { id: 'web', icon: Globe, label: 'Chụp Báo Web' },
              { id: 'extension', icon: Puzzle, label: 'Bookmarklet' },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id as typeof tab)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 border text-xs font-typewriter uppercase whitespace-nowrap transition-colors ${
                    tab === t.id
                      ? 'bg-[#9E1B16] text-[#F5EAD2] border-[#2A2018] font-bold'
                      : 'bg-[#F5EAD2] dark:bg-[#1E0505] border-[#6E5332] text-[#3A2E23] dark:text-[#FF9E8E]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Shared Custom Tagging & Copy-Paste Image Section for ALL Item Types */}
          {tab !== 'extension' && (
            <div className="p-3.5 bg-[#F5EAD2] dark:bg-[#1E0505] border-2 border-[#2A2018] dark:border-[#9E1B16] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-stamp text-xs uppercase text-[#9E1B16] dark:text-[#FF6B5B]">
                  GẮN TAG TỰ DO & CHÈN ẢNH MINH HỌA (ÁP DỤNG CHO MỌI TRANG WEB & TÀI LIỆU)
                </span>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#9E1B16]" />
                  <InkCheckbox
                    checked={autoTag}
                    onChange={() => setAutoTag((v) => !v)}
                    label="Gợi ý thêm Tag bằng AI"
                  />
                </div>
              </div>

              <CustomTagEditor
                tags={customTags}
                onChangeTags={setCustomTags}
                existingVaultTags={existingVaultTags}
              />

              <ClipboardImagePasteBox
                imageDataUrl={pastedCoverImage}
                onChangeImage={setPastedCoverImage}
              />
            </div>
          )}

          {/* TAB 1: SAVE FREQUENTLY VISITED WEBSITE (BOOKMARK DIRECTORY) */}
          {tab === 'bookmark' && (
            <form onSubmit={handleSaveFrequentWebsite} className="space-y-3.5">
              <div className="p-4 border-2 border-[#6E5332] bg-[#FAF3E3] dark:bg-[#240606] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-dossier font-bold text-sm text-[#9E1B16] dark:text-[#FF6B5B]">
                    SỔ ĐỊA CHỈ TRANG WEB THƯỜNG XUYÊN LUI TỚI (KHÔNG BAO GIỜ LẠC MẤT)
                  </div>
                  <select
                    value={selectedFolder}
                    onChange={(e) => setSelectedFolder(e.target.value)}
                    className="px-2.5 py-1 text-xs font-typewriter border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505]"
                  >
                    <option value="Trang Web Thường Tới">Ngăn: Trang Web Thường Tới</option>
                    <option value="Nghiên cứu AI">Ngăn: Nghiên cứu AI</option>
                    <option value="Kiến trúc & Hệ thống">Ngăn: Kiến trúc & Hệ thống</option>
                    <option value="Tư liệu Media">Ngăn: Tư liệu Media</option>
                    <option value="Ghi chú Cá nhân">Ngăn: Ghi chú Cá nhân</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-typewriter text-xs font-bold mb-1">
                      Đường dẫn Trang Web (URL) *
                    </label>
                    <input
                      type="text"
                      required
                      value={siteUrl}
                      onChange={(e) => setSiteUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 text-xs font-mono-tabular border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] focus:outline-none focus:border-[#9E1B16]"
                    />
                  </div>
                  <div>
                    <label className="block font-typewriter text-xs font-bold mb-1">
                      Tên gọi dễ nhớ của Trang Web
                    </label>
                    <input
                      type="text"
                      value={siteTitle}
                      onChange={(e) => setSiteTitle(e.target.value)}
                      placeholder="VD: Cổng Tra Cứu Dữ Liệu / Công cụ Thiết kế..."
                      className="w-full px-3 py-2 text-xs font-typewriter border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] focus:outline-none focus:border-[#9E1B16]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-typewriter text-xs font-bold mb-1">
                    Mô tả chi tiết về trang web (Công dụng, cách dùng, ghi chú lưu ý...)
                  </label>
                  <textarea
                    rows={3}
                    value={siteDesc}
                    onChange={(e) => setSiteDesc(e.target.value)}
                    placeholder="Ghi chú mô tả về trang web này để sau này tìm lại cực nhanh (có thể nhấn Ctrl+V để dán ảnh chụp màn hình trang web)..."
                    className="w-full px-3 py-2 font-handwriting text-lg border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] focus:outline-none focus:border-[#9E1B16]"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <RubberStampButton type="submit" disabled={loading} stampWord="ĐÃ LƯU WEB">
                    {loading ? 'Đang lưu...' : '+ Lưu Trang Web Vào Kho'}
                  </RubberStampButton>
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: UPLOAD DOCUMENT / FILE */}
          {tab === 'file' && (
            <label className="relative flex flex-col items-center justify-center gap-3 p-6 bg-[#5C3D24] dark:bg-[#2E0A0A] border-4 border-[#3A2413] dark:border-[#8C201B] text-center cursor-pointer hard-shadow">
              <span className="px-3 py-0.5 bg-gradient-to-b from-[#DFBD73] to-[#9E7531] border border-[#2A2018] text-[#1A120B] font-typewriter text-[11px] uppercase tracking-widest">
                INBOX · KHAY TIẾP NHẬN HỒ SƠ & TÀI LIỆU (ĐÃ GẮN {customTags.length} TAG)
              </span>

              <div className="w-full p-5 manila-paper border-2 border-dashed border-[#6E5332] hover:border-[#9E1B16] transition-colors flex flex-col items-center gap-2">
                {loading ? (
                  <RevolverSpinner label="Đang niêm phong & phân tích tệp..." />
                ) : (
                  <>
                    <FileUp className="w-8 h-8 text-[#9E1B16] dark:text-[#FF6B5B]" />
                    <p className="font-typewriter text-sm font-bold">
                      Nhấn để chọn tệp PDF, Word/Excel, Video, Ghi âm, Ảnh hoặc 3D (.OBJ)
                    </p>
                    <p className="font-handwriting text-lg text-[#574A3D] dark:text-[#FF9E8E]">
                      Các Tag tự do & Ảnh đại diện bạn vừa gắn phía trên sẽ được đính kèm trực tiếp vào tài liệu này
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

          {/* TAB 3: QUICK NOTE / VIDEO */}
          {tab === 'note' && (
            <form onSubmit={handleSaveQuickNoteOrVideo} className="space-y-3">
              <div className="p-3 border border-[#6E5332] bg-[#F5EAD2]/80 dark:bg-[#1E0505] space-y-2">
                <div className="text-xs font-typewriter font-semibold flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-[#9E1B16]" />
                  (Tùy chọn) Lưu Link Video Giám Sát / YouTube / MP4
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={mediaTitle}
                    onChange={(e) => setMediaTitle(e.target.value)}
                    placeholder="Tiêu đề băng video..."
                    className="px-3 py-1.5 text-xs border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#240606]"
                  />
                  <input
                    type="url"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="px-3 py-1.5 text-xs border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#240606]"
                  />
                </div>
              </div>

              <div className="space-y-2">
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
                  placeholder="Nội dung biên bản, lời khai hoặc mô tả..."
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

          {/* TAB 4: WEB ARCHIVE ARTICLE SNAPSHOT */}
          {tab === 'web' && (
            <form onSubmit={handleClipWebUrl} className="space-y-3">
              <label className="block text-xs font-medium text-[#574A3D] dark:text-[#FF9E8E]">
                Nhập URL bài báo muốn trích xuất toàn bộ chữ sang chế độ đọc Zen Mode ngoại tuyến:
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  required
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  placeholder="https://en.wikipedia.org/wiki/Forensic_science"
                  className="flex-1 px-3.5 py-2 text-sm border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505]"
                />
                <RubberStampButton type="submit" disabled={loading} stampWord="ARCHIVED">
                  {loading ? 'Đang chụp...' : 'Chụp Báo Offline'}
                </RubberStampButton>
              </div>
            </form>
          )}

          {/* TAB 5: EXTENSION BOOKMARKLET */}
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

          {error && (
            <p className="text-xs font-typewriter text-[#9E1B16] dark:text-[#FF6B5B]">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
