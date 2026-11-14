import React, { useEffect, useState } from 'react';
import {
  BookOpenCheck,
  Code2,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  History,
  ImageIcon,
  MessageSquare,
  RotateCcw,
  Save,
  ScanText,
  Send,
  Share2,
  Sparkles,
  Tag,
} from 'lucide-react';
import type { CollaborativeComment, ItemVersion, VaultItem } from '@/src/types/vault';
import Model3DCanvas from '@/src/components/viewer/Model3DCanvas';
import { RevolverSpinner, RubberStampButton } from '@/src/components/bureau/BureauDecorations';
import {
  ClipboardImagePasteBox,
  CustomTagEditor,
} from '@/src/components/bureau/CustomTagManager';
import { playTypewriterDing } from '@/src/utils/bureauAudio';
import { ITEM_TYPE_TYPOGRAPHY } from '@/src/utils/bureauTypography';

interface UniversalItemViewerProps {
  item: VaultItem;
  comments: CollaborativeComment[];
  existingVaultTags?: string[];
  onUpdateItem: (patch: Partial<VaultItem>) => void;
  onAddComment: (text: string) => void;
  onOpenShareModal: () => void;
  onGainExp?: (amount: number, reason: string) => void;
}

// Render text with [[redacted]] or ~~strikethrough~~ turned into black censor bars (#9)
function renderTextWithRedactions(text: string) {
  const parts = text.split(/(~~[^~]+~~)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('~~') && part.endsWith('~~')) {
      return (
        <span key={idx} className="redacted-bar" title="Di chuột để đọc thông tin đã kiểm duyệt">
          {part.slice(2, -2)}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export default function UniversalItemViewer({
  item,
  comments,
  existingVaultTags = [],
  onUpdateItem,
  onAddComment,
  onOpenShareModal,
  onGainExp,
}: UniversalItemViewerProps) {
  const [zenMode, setZenMode] = useState(item.type === 'web_archive');
  const [zenFontSize, setZenFontSize] = useState<'base' | 'lg' | 'xl'>('lg');
  const [zenPaper, setZenPaper] = useState<'default' | 'sepia'>('sepia');

  const [draftContent, setDraftContent] = useState(item.content);
  const [draftSourceUrl, setDraftSourceUrl] = useState(item.sourceUrl || '');
  const [editingWebDetails, setEditingWebDetails] = useState(false);
  const [previewHandwriting, setPreviewHandwriting] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraftContent(item.content);
    setDraftSourceUrl(item.sourceUrl || '');
  }, [item.id, item.content, item.sourceUrl]);

  const itemTypo = ITEM_TYPE_TYPOGRAPHY[item.type];

  const handleSaveNoteVersion = () => {
    const nextVersionNum = (item.versions?.length || 0) + 1;
    const snapshot: ItemVersion = {
      id: crypto.randomUUID(),
      versionNumber: nextVersionNum,
      summary: `Lưu bản ghi chép v${nextVersionNum}`,
      contentSnapshot: draftContent,
      savedAt: new Date().toISOString(),
      author: 'Thanh tra',
    };
    onUpdateItem({
      content: draftContent,
      excerpt: draftContent.replace(/[#*`>\-~]/g, '').trim().slice(0, 140),
      versions: [snapshot, ...(item.versions || [])],
      updatedAt: new Date().toISOString(),
    });
    playTypewriterDing();
    setAiMessage(`Đã lưu phiên bản v${nextVersionNum} vào Kho Time-Machine 30 ngày.`);
    onGainExp?.(10, 'Cập nhật sổ tay điều tra');
  };

  const handleRestoreVersion = (v: ItemVersion) => {
    setDraftContent(v.contentSnapshot);
    onUpdateItem({
      content: v.contentSnapshot,
      updatedAt: new Date().toISOString(),
    });
    playTypewriterDing();
    setAiMessage(`Đã khôi phục hồ sơ về phiên bản v${v.versionNumber}.`);
  };

  const handleAiSummarize = async () => {
    setAiLoading(true);
    setAiMessage(null);
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          type: item.type,
          content: draftContent || item.content || item.excerpt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi tóm tắt');
      onUpdateItem({ aiSummary: data.summary });
      playTypewriterDing();
      onGainExp?.(15, 'Tóm tắt hồ sơ bằng AI');
    } catch (err) {
      setAiMessage(err instanceof Error ? err.message : 'Lỗi kết nối AI');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiAutoTag = async () => {
    setAiLoading(true);
    setAiMessage(null);
    try {
      const res = await fetch('/api/ai/autotag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          type: item.type,
          content: draftContent || item.content || item.excerpt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi Auto-Tag');
      onUpdateItem({
        tags: Array.isArray(data.tags) ? data.tags : item.tags,
        smartFolder: data.smartFolder || item.smartFolder,
      });
      playTypewriterDing();
      setAiMessage(`AI đã phân loại & chuyển vào ngăn "${data.smartFolder}".`);
    } catch (err) {
      setAiMessage(err instanceof Error ? err.message : 'Lỗi Auto-Tag AI');
    } finally {
      setAiLoading(false);
    }
  };

  const handleImageOcr = async () => {
    if (!item.coverImage) return;
    setAiLoading(true);
    setAiMessage(null);
    try {
      let base64 = item.coverImage;
      if (!base64.startsWith('data:')) {
        const resp = await fetch(item.coverImage);
        const blob = await resp.blob();
        base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
      const res = await fetch('/api/ai/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi OCR ảnh');
      onUpdateItem({ ocrText: data.text });
      playTypewriterDing();
      onGainExp?.(15, 'Trích xuất văn bản ảnh chứng cứ bằng AI OCR');
    } catch (err) {
      setAiMessage(err instanceof Error ? err.message : 'Lỗi OCR ảnh');
    } finally {
      setAiLoading(false);
    }
  };

  const insertBlockSnippet = (snippet: string) => {
    setDraftContent((prev) => `${prev}\n${snippet}`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* MAIN EVIDENCE VIEWPORT */}
      <div className="lg:col-span-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 bg-[#2A2018] text-[#F5EAD2] font-cipher text-[10px] uppercase tracking-wider">
              FONT CHUYÊN BIỆT: {itemTypo.badgeFontName}
            </span>

            {item.type === 'web_archive' && (
              <div className="flex items-center gap-1 p-1 bg-[#DFC79C] dark:bg-[#1E0505] border border-[#6E5332]">
                <button
                  onClick={() => setZenMode(true)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-typewriter ${
                    zenMode ? 'bg-[#9E1B16] text-[#F5EAD2]' : 'text-[#3A2E23] dark:text-[#FF9E8E]'
                  }`}
                >
                  <BookOpenCheck className="w-3.5 h-3.5" />
                  Zen Reading
                </button>
                <button
                  onClick={() => setZenMode(false)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-typewriter ${
                    !zenMode ? 'bg-[#9E1B16] text-[#F5EAD2]' : 'text-[#3A2E23] dark:text-[#FF9E8E]'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  HTML Snapshot
                </button>
              </div>
            )}

            {item.type === 'note' && (
              <RubberStampButton onClick={handleSaveNoteVersion} stampWord="SAVED">
                <span className="inline-flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  Lưu phiên bản
                </span>
              </RubberStampButton>
            )}

            <button
              disabled={aiLoading}
              onClick={handleAiSummarize}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#2A2018] bg-[#F5EAD2] dark:bg-[#1E0505] hover:bg-[#DFC79C] text-xs font-typewriter"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#9E1B16] dark:text-[#FF6B5B]" />
              Tóm tắt AI
            </button>

            <button
              disabled={aiLoading}
              onClick={handleAiAutoTag}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#2A2018] bg-[#F5EAD2] dark:bg-[#1E0505] hover:bg-[#DFC79C] text-xs font-typewriter"
            >
              <Tag className="w-3.5 h-3.5 text-[#9E1B16] dark:text-[#FF6B5B]" />
              Auto-Tag AI
            </button>

            {item.type === 'image' && (
              <RubberStampButton disabled={aiLoading} onClick={handleImageOcr} stampWord="SCANNED">
                <span className="inline-flex items-center gap-1.5">
                  <ScanText className="w-3.5 h-3.5" />
                  {aiLoading ? 'Đang quét...' : 'AI OCR Ảnh'}
                </span>
              </RubberStampButton>
            )}
          </div>

          <button
            onClick={onOpenShareModal}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#2A2018] bg-[#F5EAD2] dark:bg-[#1E0505] hover:bg-[#DFC79C] text-xs font-typewriter uppercase"
          >
            <Share2 className="w-3.5 h-3.5 text-[#9E1B16]" />
            Link Tự Hủy
          </button>
        </div>

        {aiLoading && (
          <div className="p-4 manila-paper border-2 border-[#2A2018]">
            <RevolverSpinner label="Cục Tình Báo AI đang xử lý dữ liệu..." />
          </div>
        )}

        {aiMessage && (
          <div className="px-4 py-2.5 bg-[#F3DF98] border border-dashed border-[#8E762A] font-handwriting text-lg text-[#1A120B]">
            📌 {aiMessage}
          </div>
        )}

        {/* WEB ARCHIVE / FREQUENT WEBSITE BOOKMARK — Newsreader VN + Playfair Display VN */}
        {item.type === 'web_archive' && (
          <div
            className={`torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] p-6 sm:p-8 transition-colors ${
              zenMode && zenPaper === 'sepia'
                ? 'manila-paper'
                : 'bg-[#F8F3E8] dark:bg-[#1E0505] text-[#1A120B] dark:text-[#FFD6CE]'
            }`}
          >
            {/* Prominent Direct Website Visit Banner */}
            <div className="mb-5 p-3.5 bg-[#DFC79C] dark:bg-[#3A0C0C] border-2 border-[#2A2018] flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-stamp text-[10px] uppercase text-[#9E1B16] dark:text-[#FF6B5B]">
                  ĐỊA CHỈ TRANG WEB ĐÃ LƯU TRONG SỔ
                </div>
                <div className="font-mono-tabular text-xs font-bold truncate">
                  {item.sourceUrl || 'Chưa gắn đường dẫn URL'}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingWebDetails((v) => !v)}
                  className="px-3 py-1.5 bg-[#F5EAD2] dark:bg-[#1E0505] border border-[#2A2018] font-typewriter text-xs hover:bg-[#C9B38C]"
                >
                  {editingWebDetails ? 'Đóng chỉnh sửa' : 'Sửa Mô Tả & Dán Ảnh'}
                </button>
                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#9E1B16] hover:bg-[#C81E1E] text-[#F5EAD2] border-2 border-[#2A2018] font-stamp text-xs uppercase tracking-wider hard-shadow"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Mở Trang Web Ngay
                  </a>
                )}
              </div>
            </div>

            {editingWebDetails && (
              <div className="mb-6 p-4 bg-[#FAF3E3] dark:bg-[#240606] border-2 border-[#6E5332] space-y-3">
                <div className="font-stamp text-xs uppercase text-[#9E1B16] dark:text-[#FF6B5B]">
                  CẬP NHẬT THÔNG TIN TRANG WEB & DÁN ẢNH MINH HỌA (CTRL+V)
                </div>
                <div>
                  <label className="block font-typewriter text-xs font-bold mb-1">
                    Đường dẫn URL Trang Web
                  </label>
                  <input
                    type="text"
                    value={draftSourceUrl}
                    onChange={(e) => setDraftSourceUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-1.5 text-xs font-mono-tabular border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505]"
                  />
                </div>
                <div>
                  <label className="block font-typewriter text-xs font-bold mb-1">
                    Mô tả & Ghi chú về trang web
                  </label>
                  <textarea
                    rows={4}
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    placeholder="Nhập mô tả chi tiết về trang web..."
                    className="w-full px-3 py-2 font-handwriting text-lg border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505]"
                  />
                </div>
                <ClipboardImagePasteBox
                  imageDataUrl={item.coverImage}
                  onChangeImage={(nextImg) => onUpdateItem({ coverImage: nextImg || '' })}
                />
                <div className="flex justify-end">
                  <RubberStampButton
                    onClick={() => {
                      const cleanUrl =
                        draftSourceUrl.trim() && !/^https?:\/\//i.test(draftSourceUrl.trim())
                          ? `https://${draftSourceUrl.trim()}`
                          : draftSourceUrl.trim();
                      onUpdateItem({
                        sourceUrl: cleanUrl,
                        content: draftContent,
                        excerpt: draftContent.slice(0, 180),
                      });
                      setEditingWebDetails(false);
                      playTypewriterDing();
                      setAiMessage('Đã cập nhật thông tin & mô tả trang web.');
                    }}
                    stampWord="UPDATED"
                  >
                    Lưu Thay Đổi Trang Web
                  </RubberStampButton>
                </div>
              </div>
            )}

            {zenMode ? (
              <article className="max-w-2xl mx-auto space-y-5">
                <div className="flex items-center justify-between pb-3">
                  <div className="font-mono-tabular text-[11px] uppercase text-[#574A3D] dark:text-[#FF9E8E]">
                    Bản Mô Tả & Lưu Trữ Trang Web · {item.sourceUrl || 'Offline Snapshot'}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setZenPaper((p) => (p === 'default' ? 'sepia' : 'default'))}
                      className="px-2 py-1 text-xs border border-[#6E5332] font-typewriter"
                    >
                      {zenPaper === 'sepia' ? 'Giấy sáng' : 'Giấy manila'}
                    </button>
                    <button
                      onClick={() =>
                        setZenFontSize((s) => (s === 'base' ? 'lg' : s === 'lg' ? 'xl' : 'base'))
                      }
                      className="px-2 py-1 text-xs border border-[#6E5332] font-serif-editorial font-bold"
                    >
                      Aa
                    </button>
                  </div>
                </div>
                <div className="masking-tape-divider" />

                {item.coverImage && (
                  <img
                    src={item.coverImage}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full max-h-80 object-contain bg-[#1C1612] border-2 border-[#2A2018]"
                  />
                )}

                <h2 className="font-dossier text-2xl sm:text-3xl font-extrabold tracking-tight leading-snug">
                  {item.title}
                </h2>

                <div
                  className={`font-serif-editorial leading-relaxed whitespace-pre-line ${
                    zenFontSize === 'xl'
                      ? 'text-xl'
                      : zenFontSize === 'lg'
                      ? 'text-lg'
                      : 'text-base'
                  }`}
                >
                  {renderTextWithRedactions(item.content)}
                </div>
              </article>
            ) : (
              <div className="space-y-3">
                <div className="font-mono-tabular text-xs flex items-center justify-between">
                  <span>MÃ NGUỒN LƯU TRỮ NGOẠI TUYẾN</span>
                  <span>{item.sourceUrl}</span>
                </div>
                <pre className="p-4 bg-[#14100C] text-[#EBDAB9] text-xs font-cipher overflow-x-auto max-h-96">
                  {item.snapshotHtml || item.content}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* NOTE (#7 Patrick Hand VN Handwriting ink + #9 Redaction preview toggle) */}
        {item.type === 'note' && (
          <div className="manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-1.5 px-4 py-2 bg-[#DFC79C] dark:bg-[#3A0C0C] border-b-2 border-[#2A2018]">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => insertBlockSnippet('## Đầu mục điều tra mới')}
                  className="px-2 py-1 text-xs font-typewriter hover:bg-[#C9B38C] dark:hover:bg-[#521414]"
                >
                  H2
                </button>
                <button
                  onClick={() => insertBlockSnippet('- [ ] Đầu mối cần xác minh')}
                  className="px-2 py-1 text-xs font-typewriter hover:bg-[#C9B38C] dark:hover:bg-[#521414]"
                >
                  Checklist
                </button>
                <button
                  onClick={() => insertBlockSnippet('~~Thông tin mật cần bôi đen~~')}
                  className="px-2 py-1 text-xs font-typewriter bg-[#14100C] text-[#F5EAD2]"
                >
                  Bôi Đen Mật
                </button>
                <button
                  onClick={() => insertBlockSnippet('```typescript\n// Mã truy vết chứng cứ\n```')}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-typewriter hover:bg-[#C9B38C] dark:hover:bg-[#521414]"
                >
                  <Code2 className="w-3.5 h-3.5" /> Code
                </button>
              </div>
              <button
                onClick={() => setPreviewHandwriting((p) => !p)}
                className="px-2.5 py-1 text-xs font-typewriter border border-[#2A2018] bg-[#F5EAD2] dark:bg-[#1E0505]"
              >
                {previewHandwriting ? 'Chỉnh sửa chữ viết tay' : 'Xem hiệu ứng Kiểm duyệt'}
              </button>
            </div>

            {previewHandwriting ? (
              <div className="p-6 font-handwriting text-xl leading-relaxed whitespace-pre-line min-h-[340px] text-[#1A2B4C] dark:text-[#FFD6CE]">
                {renderTextWithRedactions(draftContent)}
              </div>
            ) : (
              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                rows={15}
                className="w-full p-5 bg-transparent font-handwriting text-xl leading-relaxed text-[#141E30] dark:text-[#FFD6CE] focus:outline-none resize-y"
                placeholder="Ghi chép bằng mực viết tay hiện trường (Patrick Hand VN), lời khai hoặc dùng ~~nội dung~~ để bôi đen mật..."
              />
            )}
          </div>
        )}

        {/* OFFICE SHEET — IBM Plex Mono VN */}
        {item.type === 'office_doc' && (
          <div className="manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-mono-tabular text-base font-bold uppercase">
                <FileSpreadsheet className="w-4 h-4 text-[#9E1B16]" />
                Sổ Cái Thống Kê Vật Chứng & Tài Liệu Văn Phòng
              </div>
              <span className="font-mono-tabular text-[10px] text-[#574A3D] dark:text-[#FF9E8E]">
                IBM Plex Mono VN
              </span>
            </div>
            <div className="masking-tape-divider" />
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono-tabular">
                <thead>
                  <tr className="border-b-2 border-[#2A2018] dark:border-[#9E1B16] uppercase">
                    {(item.content.split('\n')[0] || '').split('|').map((col, idx) => (
                      <th key={idx} className="py-2.5 px-3 font-semibold">
                        {col.trim()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {item.content
                    .split('\n')
                    .slice(1)
                    .filter((row) => row.trim())
                    .map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="border-b border-[#6E5332]/50 hover:bg-[#DFC79C]/60 dark:hover:bg-[#3A0C0C]"
                      >
                        {row.split('|').map((cell, cIdx) => (
                          <td key={cIdx} className="py-2.5 px-3">
                            {cell.trim()}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* IMAGE EXHIBIT — Mali VN Polaroid Marker */}
        {item.type === 'image' && (
          <div className="manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] p-4 space-y-3">
            {item.coverImage ? (
              <div className="bg-[#FAF3E2] p-3 pb-7 border-2 border-[#2A2018] hard-shadow max-w-xl mx-auto">
                <img
                  src={item.coverImage}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full max-h-[460px] object-contain mx-auto sepia-[0.15]"
                />
                <div className="mt-2 font-polaroid text-lg font-bold text-center text-[#1A120B]">
                  Vật chứng ảnh: {item.title}
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center bg-[#DFC79C] text-[#574A3D]">
                <ImageIcon className="w-8 h-8 mb-2" />
                <span className="text-xs font-typewriter">Không có dữ liệu ảnh chứng cứ</span>
              </div>
            )}
            {item.ocrText && (
              <div className="p-4 bg-[#F5EAD2] dark:bg-[#1E0505] border-2 border-[#2A2018] text-xs whitespace-pre-line leading-relaxed font-mono-tabular">
                <div className="font-typewriter font-bold mb-1.5 text-[#9E1B16] dark:text-[#FF6B5B] uppercase">
                  [KẾT QUẢ AI OCR TRÍCH XUẤT TỪ ẢNH CHỨNG CỨ]
                </div>
                {item.ocrText}
              </div>
            )}
          </div>
        )}

        {/* 3D FORENSIC MODEL — JetBrains Mono VN */}
        {item.type === 'model_3d' && <Model3DCanvas title={item.title} />}

        {/* AI Summary Dossier Box — Cormorant Garamond VN */}
        {item.aiSummary && (
          <div className="p-5 manila-paper torn-paper-card border-2 border-[#9E1B16] space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-legal-dossier text-base font-bold flex items-center gap-2 text-[#9E1B16] dark:text-[#FF6B5B]">
                <Sparkles className="w-4 h-4" />
                Bản Tóm Tắt Phân Tích AI (Cormorant Garamond VN)
              </h4>
              <span className="stamp-crimson text-[10px]">AI BRIEF</span>
            </div>
            <div className="red-string-divider my-1" />
            <div className="font-legal-dossier text-base whitespace-pre-line leading-relaxed">
              {item.aiSummary}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT METADATA & STRING-TIED EVIDENCE POUCH ACCORDIONS (#47) */}
      <div className="lg:col-span-4 space-y-4">
        {/* #47: String-Tied Evidence Pouch Accordion for Version History */}
        {item.versions.length > 0 && (
          <details
            open
            className="group p-4 bg-[#D4B483] dark:bg-[#3A0C0C] border-2 border-[#2A2018] dark:border-[#9E1B16] hard-shadow"
          >
            <summary className="cursor-pointer list-none flex items-center justify-between font-typewriter text-sm font-bold">
              <span className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#9E1B16] dark:text-[#FF6B5B]" />
                Túi Hồ Sơ Time-Machine ({item.versions.length})
              </span>
              {/* Red Button & Twine Clasp */}
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono-tabular">
                <span className="w-3.5 h-3.5 rounded-full bg-[#9E1B16] border border-[#2A2018]" />
                GỠ DÂY BUỘC
              </span>
            </summary>

            <div className="red-string-divider my-3" />

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {item.versions.map((v) => (
                <div
                  key={v.id}
                  className="p-2.5 border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between font-mono-tabular font-semibold">
                    <span>PHIÊN BẢN v{v.versionNumber}</span>
                    <span className="text-[11px] text-[#574A3D] dark:text-[#FF9E8E]">
                      {new Date(v.savedAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <p className="font-handwriting text-base text-[#574A3D] dark:text-[#FFD6CE]">
                    {v.summary}
                  </p>
                  <button
                    onClick={() => handleRestoreVersion(v)}
                    className="inline-flex items-center gap-1 text-[#9E1B16] dark:text-[#FF6B5B] font-typewriter hover:underline"
                  >
                    <RotateCcw className="w-3 h-3" /> Khôi phục bản này
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* #47: String-Tied Pouch for Sealed Metadata, Free-form Custom Tags & Copy-Paste Image */}
        <details
          open
          className="p-4 bg-[#D4B483] dark:bg-[#3A0C0C] border-2 border-[#2A2018] dark:border-[#9E1B16] hard-shadow"
        >
          <summary className="cursor-pointer list-none flex items-center justify-between font-typewriter text-sm font-bold">
            <span>Gắn Tag Tự Do & Ảnh Minh Họa</span>
            <span className="w-3.5 h-3.5 rounded-full bg-[#9E1B16] border border-[#2A2018]" />
          </summary>

          <div className="masking-tape-divider my-3" />

          <div className="space-y-3">
            <div className="font-mono-tabular text-xs">
              NGĂN HỒ SƠ: <strong>{item.smartFolder}</strong>
            </div>

            <div className="space-y-1">
              <div className="font-typewriter text-xs font-bold uppercase text-[#9E1B16] dark:text-[#FF6B5B]">
                Thẻ Tag Phân Loại (Thêm / Xóa tự do):
              </div>
              <CustomTagEditor
                tags={item.tags}
                onChangeTags={(nextTags) => onUpdateItem({ tags: nextTags })}
                existingVaultTags={existingVaultTags}
              />
            </div>

            {item.type !== 'web_archive' && (
              <ClipboardImagePasteBox
                label="Ảnh Bìa / Ảnh Minh Họa (Ctrl+V để Paste ảnh)"
                imageDataUrl={item.coverImage}
                onChangeImage={(nextImg) => onUpdateItem({ coverImage: nextImg || '' })}
              />
            )}

            <div className="font-mono-tabular text-xs pt-1">
              BẢN LƯU OFFLINE:{' '}
              <button
                onClick={() => onUpdateItem({ offlineCached: !item.offlineCached })}
                className="font-semibold text-[#9E1B16] dark:text-[#FF6B5B] hover:underline"
              >
                {item.offlineCached ? '[ĐÃ LƯU MÁY TRẠM]' : '[CHƯA TẢI — NHẤN ĐỂ LƯU]'}
              </button>
            </div>
          </div>
        </details>

        {/* Team Comments in Handwriting */}
        <div className="p-4 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] space-y-3">
          <h4 className="font-typewriter text-sm font-bold flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#9E1B16]" />
            Bút Phê Nhóm Điều Tra ({comments.length})
          </h4>
          <div className="masking-tape-divider" />
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="font-handwriting text-lg text-[#574A3D] dark:text-[#FF9E8E]">
                Chưa có bút phê cộng tác cho hồ sơ này.
              </p>
            ) : (
              comments.map((cm) => (
                <div
                  key={cm.id}
                  className="p-2.5 bg-[#F5EAD2] dark:bg-[#1E0505] border border-[#6E5332] text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-mono-tabular text-[11px]">
                    <strong>{cm.author}</strong>
                    <span>
                      {new Date(cm.createdAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="font-handwriting text-lg text-[#141E30] dark:text-[#FFD6CE]">
                    {cm.text}
                  </p>
                </div>
              ))
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!commentText.trim()) return;
              onAddComment(commentText.trim());
              setCommentText('');
              playTypewriterDing();
            }}
            className="flex gap-2 pt-1"
          >
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Viết bút phê bằng mực xanh..."
              className="flex-1 px-3 py-1.5 font-handwriting text-lg border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] focus:outline-none focus:ring-2 focus:ring-[#9E1B16]"
            />
            <button
              type="submit"
              className="p-2 bg-[#9E1B16] text-[#F5EAD2] hover:bg-[#C81E1E]"
              title="Gửi bút phê"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
