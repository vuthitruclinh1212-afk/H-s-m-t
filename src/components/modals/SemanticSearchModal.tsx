import React, { useState } from 'react';
import { ArrowRight, Search, Sparkles } from 'lucide-react';
import type { VaultItem } from '@/src/types/vault';
import {
  PaperclipCloseBtn,
  RedactedSkeleton,
  RevolverSpinner,
  RubberStampButton,
} from '@/src/components/bureau/BureauDecorations';

interface SemanticResult {
  itemId: string;
  relevanceScore: number;
  reason: string;
  matchedPage?: number;
  matchedTimestampSec?: number;
}

interface SemanticSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: VaultItem[];
  onJumpToItem: (item: VaultItem, opts?: { page?: number; timestampSec?: number }) => void;
}

export default function SemanticSearchModal({
  isOpen,
  onClose,
  items,
  onJumpToItem,
}: SemanticSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SemanticResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [focused, setFocused] = useState(false);

  if (!isOpen) return null;

  const runSearch = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const payloadItems = items.map((it) => ({
        id: it.id,
        title: it.title,
        type: it.type,
        tags: it.tags,
        excerpt: `${it.excerpt}\n${it.content.slice(0, 600)}`,
        chunks: [
          ...(it.timestampNotes || []).map((tn) => ({
            label: `Video ${tn.timestampSec}s`,
            text: tn.text,
            timestampSec: tn.timestampSec,
          })),
          ...(it.subtitles || []).map((s) => ({
            label: `Subtitle ${s.startSec}s`,
            text: s.text,
            timestampSec: s.startSec,
          })),
          ...(it.annotations || [])
            .filter((a) => a.content)
            .map((a) => ({
              label: `PDF Page ${a.page}`,
              text: a.content!,
              page: a.page,
            })),
        ],
      }));

      const res = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed, items: payloadItems }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi tìm kiếm ngữ nghĩa.');
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch (err) {
      const low = trimmed.toLowerCase();
      const localMatches: SemanticResult[] = items
        .filter(
          (it) =>
            it.title.toLowerCase().includes(low) ||
            it.content.toLowerCase().includes(low) ||
            it.tags.some((t) => t.toLowerCase().includes(low))
        )
        .map((it) => ({
          itemId: it.id,
          relevanceScore: 0.75,
          reason: 'Khớp chỉ mục hồ sơ cục bộ.',
        }));
      setResults(localMatches);
      setError(err instanceof Error ? err.message : null);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#120C08]/80 flex items-start justify-center pt-16 p-4">
      <div className="smoke-overlay fixed inset-0" />

      <div className="relative w-full max-w-2xl manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] hard-shadow-lg overflow-visible">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#9E1B16] border-2 border-[#F5EAD2] shadow-[2px_3px_0px_rgba(14,9,5,0.65)] z-20" />

        {/* #17: Brass Magnifying Glass Search Header with subtle text magnification */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(query);
          }}
          className="flex items-center gap-3 px-4 py-3.5 border-b-2 border-[#2A2018] dark:border-[#9E1B16] bg-[#DFC79C] dark:bg-[#3A0C0C]"
        >
          <div className="w-8 h-8 rounded-full border-2 border-[#9E7531] bg-[#F5EAD2] dark:bg-[#240606] flex items-center justify-center shrink-0 shadow-inner">
            <Search className="w-4 h-4 text-[#9E1B16] dark:text-[#FF6B5B]" />
          </div>
          <input
            autoFocus
            type="text"
            value={query}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Soi kính lúp truy vấn hồ sơ... (VD: cái video có mèo nhảy qua rào)"
            className={`flex-1 bg-transparent font-typewriter text-sm focus:outline-none placeholder:text-[#6E5332] transition-transform origin-left ${
              focused && query ? 'scale-[1.03]' : ''
            }`}
          />
          <RubberStampButton type="submit" disabled={searching} stampWord="FOUND">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {searching ? 'Đang tra...' : 'Tra cứu AI'}
            </span>
          </RubberStampButton>
          <PaperclipCloseBtn onClose={onClose} />
        </form>

        <div className="p-4 max-h-[65vh] overflow-y-auto space-y-3">
          {!hasSearched && (
            <div className="space-y-2">
              <div className="font-typewriter text-[11px] uppercase text-[#574A3D] dark:text-[#FF9E8E]">
                Mẫu truy vấn tình báo:
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  'cái video có mèo nhảy qua hàng rào',
                  'chìa khóa khắc chữ la mã IV và dấu vân tay',
                  'làm sao mã hóa hồ sơ tuyệt mật AES-256',
                ].map((sample) => (
                  <button
                    key={sample}
                    onClick={() => {
                      setQuery(sample);
                      runSearch(sample);
                    }}
                    className="px-3 py-1.5 border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] text-xs hover:border-[#9E1B16]"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          )}

          {searching && (
            <div className="space-y-3">
              <RevolverSpinner label="Đang rà soát toàn bộ chứng cứ theo ngữ nghĩa..." />
              <RedactedSkeleton />
            </div>
          )}

          {error && <p className="text-xs text-[#9E1B16] dark:text-[#FF6B5B]">{error}</p>}

          {hasSearched && !searching && results.length === 0 && (
            <p className="font-handwriting text-xl text-[#574A3D] dark:text-[#FF9E8E] py-8 text-center">
              Không tìm thấy hồ sơ nào khớp ngữ nghĩa cho "{query}".
            </p>
          )}

          {!searching &&
            results.map((r) => {
              const item = items.find((it) => it.id === r.itemId);
              if (!item) return null;
              return (
                <button
                  key={r.itemId}
                  onClick={() => {
                    onJumpToItem(item, {
                      page: r.matchedPage,
                      timestampSec: r.matchedTimestampSec,
                    });
                    onClose();
                  }}
                  className="w-full text-left p-3.5 border-2 border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] hover:border-[#9E1B16] hard-shadow transition-transform hover:-translate-y-0.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-typewriter font-bold text-sm">
                      {item.title}
                    </span>
                    <span className="stamp-crimson text-[10px] shrink-0">
                      {Math.round(r.relevanceScore * 100)}% KHỚP
                    </span>
                  </div>
                  <p className="font-handwriting text-lg text-[#574A3D] dark:text-[#FF9E8E]">
                    {r.reason}
                  </p>
                  <div className="flex items-center justify-between font-mono-tabular text-[11px] text-[#574A3D] dark:text-[#FF9E8E] pt-1">
                    <span>
                      {item.type.toUpperCase()}
                      {r.matchedPage ? ` · NHẢY TỚI TRANG ${r.matchedPage}` : ''}
                      {r.matchedTimestampSec !== undefined
                        ? ` · TUA TỚI GIÂY ${r.matchedTimestampSec}S`
                        : ''}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#9E1B16] dark:text-[#FF6B5B] font-semibold">
                      MỞ HỒ SƠ <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
