import React, { useState } from 'react';
import { ClipboardPaste, ImagePlus, Plus, Tag, Trash2, X } from 'lucide-react';
import {
  extractImageFromClipboardEvent,
  fileOrBlobToCompressedDataUrl,
} from '@/src/utils/imagePasteHelper';
import { playDateClick, playTypewriterDing } from '@/src/utils/bureauAudio';

interface CustomTagEditorProps {
  tags: string[];
  onChangeTags: (nextTags: string[]) => void;
  existingVaultTags?: string[];
  maxTags?: number;
  compact?: boolean;
  placeholder?: string;
}

export function CustomTagEditor({
  tags,
  onChangeTags,
  existingVaultTags = [],
  maxTags = 10,
  compact = false,
  placeholder = 'Nhập tag tự do (VD: Hay dùng, Công cụ AI, Ngân hàng...) rồi nhấn Enter',
}: CustomTagEditorProps) {
  const [inputVal, setInputVal] = useState('');

  const addTag = (raw: string) => {
    const cleaned = raw.replace(/^#+/, '').trim().slice(0, 64);
    if (!cleaned) return;
    if (tags.some((t) => t.toLowerCase() === cleaned.toLowerCase())) {
      setInputVal('');
      return;
    }
    if (tags.length >= maxTags) return;
    playDateClick();
    onChangeTags([...tags, cleaned]);
    setInputVal('');
  };

  const removeTag = (tagToRemove: string) => {
    playDateClick();
    onChangeTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputVal);
    } else if (e.key === 'Backspace' && !inputVal && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const suggestedTags = existingVaultTags
    .filter((t) => !tags.some((cur) => cur.toLowerCase() === t.toLowerCase()))
    .slice(0, 12);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#DFC79C] dark:bg-[#3D0D0D] border border-[#6E5332] dark:border-[#B8322C] text-[11px] font-stamp uppercase tracking-wider text-[#261B12] dark:text-[#FFD6CE] shadow-[1px_2px_0px_rgba(20,12,6,0.3)]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#9E1B16]" />
            #{tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              title={`Xóa tag "${tag}"`}
              className="ml-0.5 hover:text-[#9E1B16] dark:hover:text-[#FF6B5B]"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {tags.length === 0 && (
          <span className="font-typewriter text-[11px] text-[#574A3D] dark:text-[#FF9E8E] italic">
            Chưa gắn tag nào — Hãy tự thêm tag bên dưới để phân loại & lọc nhanh
          </span>
        )}
      </div>

      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Tag className="w-3.5 h-3.5 text-[#9E1B16] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`w-full pl-8 pr-3 ${
              compact ? 'py-1 text-xs' : 'py-1.5 text-xs'
            } border border-[#6E5332] bg-[#FAF3E3] dark:bg-[#1E0505] font-typewriter focus:outline-none focus:border-[#9E1B16]`}
          />
        </div>
        <button
          type="button"
          onClick={() => addTag(inputVal)}
          disabled={!inputVal.trim() || tags.length >= maxTags}
          className="px-3 py-1.5 bg-[#2A2018] dark:bg-[#9E1B16] text-[#F5EAD2] font-stamp text-xs uppercase tracking-wider hover:bg-[#9E1B16] disabled:opacity-40 inline-flex items-center gap-1 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Gắn Tag
        </button>
      </div>

      {!compact && suggestedTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          <span className="font-typewriter text-[10px] uppercase text-[#574A3D] dark:text-[#FF9E8E] mr-1">
            Tag đã có trong kho:
          </span>
          {suggestedTags.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => addTag(st)}
              className="px-2 py-0.5 text-[10px] font-typewriter border border-dashed border-[#6E5332] bg-[#F5EAD2]/70 dark:bg-[#240606] hover:border-[#9E1B16] hover:bg-[#DFC79C]"
            >
              + #{st}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ClipboardImagePasteBoxProps {
  imageDataUrl?: string;
  onChangeImage: (nextDataUrl: string | undefined) => void;
  label?: string;
}

export function ClipboardImagePasteBox({
  imageDataUrl,
  onChangeImage,
  label = 'Ảnh minh họa Trang Web / Tài liệu (Hỗ trợ Copy & Paste Ctrl+V trực tiếp)',
}: ClipboardImagePasteBoxProps) {
  const [pasting, setPasting] = useState(false);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  const handlePaste = async (e: React.ClipboardEvent) => {
    const extracted = await extractImageFromClipboardEvent(e);
    if (extracted) {
      e.preventDefault();
      setPasting(true);
      onChangeImage(extracted);
      playTypewriterDing();
      setPasteNotice('Đã dán hình ảnh từ Clipboard thành công!');
      setPasting(false);
      setTimeout(() => setPasteNotice(null), 2600);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPasting(true);
    try {
      const compressed = await fileOrBlobToCompressedDataUrl(file);
      onChangeImage(compressed);
      playTypewriterDing();
      setPasteNotice('Đã chèn ảnh minh họa!');
      setTimeout(() => setPasteNotice(null), 2600);
    } finally {
      setPasting(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="font-typewriter text-xs font-bold text-[#2A2018] dark:text-[#FFD6CE] flex items-center gap-1.5">
          <ClipboardPaste className="w-3.5 h-3.5 text-[#9E1B16]" />
          {label}
        </label>
        {imageDataUrl && (
          <button
            type="button"
            onClick={() => onChangeImage(undefined)}
            className="inline-flex items-center gap-1 text-[11px] font-typewriter text-[#9E1B16] hover:underline"
          >
            <Trash2 className="w-3 h-3" />
            Xóa ảnh
          </button>
        )}
      </div>

      <div
        tabIndex={0}
        onPaste={handlePaste}
        className="relative p-3 border-2 border-dashed border-[#6E5332] hover:border-[#9E1B16] focus:border-[#9E1B16] bg-[#FAF3E3] dark:bg-[#1E0505] transition-colors outline-none cursor-pointer"
        title="Nhấp vào khung này rồi nhấn Ctrl+V (hoặc Cmd+V) để dán hình ảnh vừa Copy"
      >
        {imageDataUrl ? (
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="w-full sm:w-44 h-28 bg-[#1C1612] border-2 border-[#2A2018] overflow-hidden shrink-0">
              <img
                src={imageDataUrl}
                alt="Ảnh đã dán"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 space-y-1.5 text-left">
              <div className="font-stamp text-xs text-[#166534] dark:text-[#86EFAC]">
                ✓ ĐÃ ĐÍNH KÈM ẢNH MINH HỌA
              </div>
              <p className="font-typewriter text-[11px] text-[#574A3D] dark:text-[#FF9E8E]">
                Bạn có thể nhấn <strong>Ctrl+V</strong> ngay tại đây để dán đè ảnh chụp màn hình mới, hoặc chọn tệp ảnh khác từ máy.
              </p>
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#EBDAB9] dark:bg-[#3A0C0C] border border-[#2A2018] font-typewriter text-[11px] cursor-pointer hover:bg-[#DFC79C]">
                <ImagePlus className="w-3.5 h-3.5 text-[#9E1B16]" />
                Đổi ảnh từ máy
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-2">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 bg-[#DFC79C] dark:bg-[#3A0C0C] border border-[#2A2018] flex items-center justify-center shrink-0">
                <ClipboardPaste className="w-5 h-5 text-[#9E1B16]" />
              </div>
              <div>
                <div className="font-typewriter text-xs font-bold">
                  Nhấp vào đây rồi bấm <span className="px-1.5 py-0.5 bg-[#2A2018] text-[#F5EAD2] font-mono-tabular">Ctrl + V</span> để Paste trực tiếp hình ảnh vừa Copy
                </div>
                <div className="font-handwriting text-base text-[#574A3D] dark:text-[#FF9E8E]">
                  (Chụp màn hình trang web bằng Win+Shift+S hoặc Copy ảnh bất kỳ rồi Paste thẳng vào đây)
                </div>
              </div>
            </div>

            <label className="px-3 py-1.5 bg-[#EBDAB9] dark:bg-[#3A0C0C] border border-[#2A2018] font-typewriter text-xs cursor-pointer hover:bg-[#DFC79C] shrink-0 inline-flex items-center gap-1.5">
              <ImagePlus className="w-3.5 h-3.5 text-[#9E1B16]" />
              {pasting ? 'Đang xử lý...' : 'Hoặc Chọn Ảnh'}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        )}

        {pasteNotice && (
          <div className="mt-2 px-2.5 py-1 bg-[#166534] text-white font-typewriter text-[11px]">
            {pasteNotice}
          </div>
        )}
      </div>
    </div>
  );
}
