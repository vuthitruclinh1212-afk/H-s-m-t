import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  BookOpen,
  ExternalLink,
  Globe,
  LayoutGrid,
  Play,
  Quote,
  SlidersHorizontal,
  Tag,
} from 'lucide-react';
import type { DashboardWidget, HabitProfile, VaultItem } from '@/src/types/vault';
import { DAILY_QUOTES } from '@/src/data/seedVault';
import { InkCheckbox } from '@/src/components/bureau/BureauDecorations';

interface CustomDashboardViewProps {
  items: VaultItem[];
  widgets: DashboardWidget[];
  habits: HabitProfile;
  onUpdateWidgets: (next: DashboardWidget[]) => void;
  onOpenItem: (item: VaultItem) => void;
  onOpenHabits: () => void;
  onOpenAddWebsite?: () => void;
}

export default function CustomDashboardView({
  items,
  widgets,
  habits,
  onUpdateWidgets,
  onOpenItem,
  onOpenHabits,
  onOpenAddWebsite,
}: CustomDashboardViewProps) {
  const [customizing, setCustomizing] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [selectedWebTag, setSelectedWebTag] = useState<string>('ALL');

  const moveWidget = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= widgets.length) return;
    const copy = [...widgets];
    const [removed] = copy.splice(idx, 1);
    copy.splice(target, 0, removed);
    onUpdateWidgets(copy);
  };

  const toggleWidget = (id: DashboardWidget['id']) => {
    onUpdateWidgets(widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)));
  };

  const frequentWebsites = useMemo(
    () =>
      items.filter(
        (it) =>
          it.type === 'web_archive' ||
          it.smartFolder === 'Trang Web Thường Tới' ||
          Boolean(it.sourceUrl && it.type !== 'video')
      ),
    [items]
  );

  const websiteTags = useMemo(() => {
    const set = new Set<string>();
    frequentWebsites.forEach((w) => {
      (w.tags || []).forEach((t) => {
        if (t.trim()) set.add(t.trim());
      });
    });
    return Array.from(set);
  }, [frequentWebsites]);

  const filteredFrequentWebsites = useMemo(() => {
    if (selectedWebTag === 'ALL') return frequentWebsites;
    return frequentWebsites.filter((w) =>
      (w.tags || []).some((t) => t.toLowerCase() === selectedWebTag.toLowerCase())
    );
  }, [frequentWebsites, selectedWebTag]);

  const readingItems = items.filter(
    (it) => (it.type === 'pdf' || it.type === 'web_archive') && (it.readProgressPct ?? 0) < 100
  );
  const mediaItems = items.filter((it) => it.type === 'video' || it.type === 'audio');
  const dailyQuote = DAILY_QUOTES[quoteIdx % DAILY_QUOTES.length];

  return (
    <div className="space-y-6">
      {/* Broadsheet Bureau Header */}
      <div className="p-5 sm:p-6 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16]">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 mb-4">
          <div className="space-y-1">
            <div className="font-typewriter text-[11px] uppercase tracking-widest text-[#574A3D] dark:text-[#FF9E8E]">
              CỤC LƯU TRỮ & ĐIỀU TRA HỒ SƠ MẬT · BIỂU MẪU AV-77A · FONT: PLAYFAIR DISPLAY VN
            </div>
            <h1 className="font-dossier text-2xl sm:text-3xl font-extrabold tracking-tight">
              BẢNG ĐIỀU HÀNH HỒ SƠ & SỔ ĐỊA CHỈ WEB
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenAddWebsite && (
              <button
                type="button"
                onClick={onOpenAddWebsite}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#9E1B16] hover:bg-[#C81E1E] text-[#F5EAD2] border-2 border-[#2A2018] text-xs font-stamp uppercase tracking-wider hard-shadow"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                + Lưu Trang Web Thường Tới
              </button>
            )}
            <button
              onClick={() => setCustomizing((c) => !c)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-stamp uppercase border transition-colors ${
                customizing
                  ? 'bg-[#9E1B16] border-[#2A2018] text-white'
                  : 'bg-[#F5EAD2] dark:bg-[#1E0505] border-[#6E5332] hover:bg-[#DFC79C]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {customizing ? 'Lưu bố cục' : 'Tùy chỉnh Widget'}
            </button>
          </div>
        </div>

        <div className="red-string-divider mb-4" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <div className="font-typewriter text-[10px] uppercase text-[#574A3D] dark:text-[#FF9E8E]">
              Tổng Mục Lưu Trữ
            </div>
            <div className="font-legal-dossier text-xl font-bold">{items.length} mục</div>
          </div>
          <div>
            <div className="font-typewriter text-[10px] uppercase text-[#574A3D] dark:text-[#FF9E8E]">
              Trang Web Thường Tới
            </div>
            <div className="font-dossier text-lg font-bold text-[#9E1B16] dark:text-[#FF6B5B]">
              {frequentWebsites.length} trang web
            </div>
          </div>
          <div>
            <div className="font-typewriter text-[10px] uppercase text-[#574A3D] dark:text-[#FF9E8E]">
              Băng CCTV / Âm
            </div>
            <div className="font-surveillance text-lg font-bold">{mediaItems.length} băng ghi</div>
          </div>
          <div>
            <div className="font-typewriter text-[10px] uppercase text-[#574A3D] dark:text-[#FF9E8E]">
              Cấp Bậc Điều Tra
            </div>
            <div className="font-cipher text-lg font-bold text-[#9E1B16] dark:text-[#FF6B5B]">
              Cấp {habits.level} · {habits.expPoints} EXP
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Frequent Websites Directory Widget on Dashboard */}
      <section className="p-5 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="font-dossier text-lg sm:text-xl font-bold flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#9E1B16] dark:text-[#FF6B5B]" />
              Sổ Địa Chỉ Trang Web Thường Xuyên Lui Tới ({frequentWebsites.length})
            </h2>
            <p className="font-typewriter text-xs text-[#574A3D] dark:text-[#FF9E8E]">
              Lưu trữ các trang web hay vào kèm ảnh chụp màn hình (Paste Ctrl+V), mô tả & lọc nhanh theo Tag
            </p>
          </div>

          {onOpenAddWebsite && (
            <button
              type="button"
              onClick={onOpenAddWebsite}
              className="px-3 py-1.5 bg-[#2A2018] dark:bg-[#9E1B16] text-[#F5EAD2] font-stamp text-xs uppercase tracking-wider hover:bg-[#9E1B16] inline-flex items-center gap-1.5"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              + Thêm Trang Web (Có Paste Ảnh Ctrl+V)
            </button>
          )}
        </div>

        {websiteTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="inline-flex items-center gap-1 font-stamp text-[10px] uppercase text-[#9E1B16] dark:text-[#FF6B5B] mr-1">
              <Tag className="w-3 h-3" />
              Lọc trang web theo Tag:
            </span>
            <button
              type="button"
              onClick={() => setSelectedWebTag('ALL')}
              className={`px-2 py-0.5 text-[10px] font-stamp uppercase border ${
                selectedWebTag === 'ALL'
                  ? 'bg-[#2A2018] text-[#F5EAD2] border-[#2A2018]'
                  : 'bg-[#F5EAD2] dark:bg-[#1E0505] border-[#6E5332]'
              }`}
            >
              Tất cả ({frequentWebsites.length})
            </button>
            {websiteTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedWebTag(t)}
                className={`px-2 py-0.5 text-[10px] font-stamp uppercase border ${
                  selectedWebTag.toLowerCase() === t.toLowerCase()
                    ? 'bg-[#9E1B16] text-[#F5EAD2] border-[#2A2018]'
                    : 'bg-[#DFC79C] dark:bg-[#3D0D0D] border-[#6E5332] hover:border-[#9E1B16]'
                }`}
              >
                #{t}
              </button>
            ))}
          </div>
        )}

        <div className="masking-tape-divider" />

        {filteredFrequentWebsites.length === 0 ? (
          <div className="p-6 bg-[#F5EAD2]/80 dark:bg-[#1E0505] border border-dashed border-[#6E5332] text-center space-y-2">
            <p className="font-handwriting text-xl text-[#574A3D] dark:text-[#FF9E8E]">
              "Bạn chưa lưu trang web thường tới nào. Hãy bấm nút '+ Thêm Trang Web' để lưu link, dán ảnh chụp màn hình bằng Ctrl+V và gắn Tag phân loại!"
            </p>
            {onOpenAddWebsite && (
              <button
                type="button"
                onClick={onOpenAddWebsite}
                className="px-4 py-1.5 bg-[#9E1B16] text-[#F5EAD2] font-stamp text-xs uppercase tracking-wider"
              >
                + Lưu Trang Web Đầu Tiên
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredFrequentWebsites.map((site) => (
              <div
                key={site.id}
                onClick={() => onOpenItem(site)}
                className="group cursor-pointer bg-[#FAF3E3] dark:bg-[#1E0505] border-2 border-[#2A2018] dark:border-[#9E1B16] hard-shadow hover:-translate-y-1 transition-transform flex flex-col overflow-hidden"
              >
                {site.coverImage && (
                  <div className="h-36 bg-[#1C1612] border-b border-[#6E5332] overflow-hidden">
                    <img
                      src={site.coverImage}
                      alt={site.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                )}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-dossier font-bold text-base leading-snug group-hover:text-[#9E1B16] dark:group-hover:text-[#FF6B5B]">
                        {site.title}
                      </h3>
                      {site.sourceUrl && (
                        <a
                          href={site.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#9E1B16] hover:bg-[#C81E1E] text-[#F5EAD2] font-stamp text-[10px] uppercase tracking-wider shrink-0"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Mở Web
                        </a>
                      )}
                    </div>
                    {site.sourceUrl && (
                      <div className="font-mono-tabular text-[11px] text-[#9E1B16] dark:text-[#FF6B5B] truncate">
                        {site.sourceUrl}
                      </div>
                    )}
                    <p className="font-handwriting text-base text-[#3A2E23] dark:text-[#FFD6CE] line-clamp-2">
                      {site.excerpt || site.content}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-2 border-t border-[#6E5332]/40">
                    {(site.tags || []).map((tag) => (
                      <span
                        key={tag}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedWebTag(tag);
                        }}
                        className="px-2 py-0.5 bg-[#DFC79C] dark:bg-[#3D0D0D] border border-[#6E5332] font-stamp text-[10px] uppercase"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Widget Order & Visibility Customizer */}
      {customizing && (
        <div className="p-4 manila-paper torn-paper-card border-2 border-[#2A2018] space-y-2.5">
          <div className="text-xs font-typewriter font-semibold flex items-center gap-1.5">
            <LayoutGrid className="w-3.5 h-3.5 text-[#9E1B16]" />
            Bật/tắt hoặc sắp xếp thứ tự các khối Widget:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {widgets.map((w, idx) => (
              <div
                key={w.id}
                className="flex items-center justify-between px-3 py-2 border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] text-xs"
              >
                <InkCheckbox
                  checked={w.visible}
                  onChange={() => toggleWidget(w.id)}
                  label={w.title}
                />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveWidget(idx, -1)}
                    disabled={idx === 0}
                    className="p-1 hover:bg-[#DFC79C] disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveWidget(idx, 1)}
                    disabled={idx === widgets.length - 1}
                    className="p-1 hover:bg-[#DFC79C] disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {widgets
          .filter((w) => w.visible)
          .map((widget) => {
            if (widget.id === 'continue-reading') {
              return (
                <section
                  key={widget.id}
                  className="p-5 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] space-y-4"
                >
                  <div className="flex items-center justify-between pb-2">
                    <h2 className="font-legal-dossier text-lg font-bold flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#9E1B16] dark:text-[#FF6B5B]" />
                      {widget.title}
                    </h2>
                    <span className="font-stamp text-[10px] text-[#574A3D] dark:text-[#FF9E8E]">
                      CORMORANT VN · {readingItems.length} HỒ SƠ
                    </span>
                  </div>
                  <div className="masking-tape-divider" />
                  <div className="space-y-2.5">
                    {readingItems.slice(0, 3).map((item) => {
                      const pct = item.readProgressPct ?? 0;
                      return (
                        <button
                          key={item.id}
                          onClick={() => onOpenItem(item)}
                          className="w-full text-left p-3 border border-[#6E5332] bg-[#F5EAD2]/90 dark:bg-[#1E0505] hover:border-[#9E1B16] transition-transform hover:-translate-y-0.5 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-legal-dossier text-base font-bold truncate">
                              {item.title}
                            </span>
                            <span className="font-cipher text-xs text-[#9E1B16] dark:text-[#FF6B5B] shrink-0">
                              {pct}%
                            </span>
                          </div>
                          <div className="relative h-2 bg-[#DFC79C] dark:bg-[#140404] border border-[#6E5332]/60 flex items-center">
                            <div
                              className="h-full bg-gradient-to-r from-[#6E120E] via-[#9E1B16] to-[#E25822]"
                              style={{ width: `${pct}%` }}
                            />
                            <span
                              className="w-2 h-2 rounded-full bg-[#FF6B5B] shadow-[0_0_6px_#FF4500] -ml-1"
                              title="Đầu tàn thuốc tiến độ"
                            />
                          </div>
                          <div className="font-serif-editorial italic text-xs text-[#574A3D] dark:text-[#FF9E8E]">
                            {item.type === 'pdf'
                              ? `Đang đọc dở Trang ${item.lastReadPage ?? 1} / ${item.pageCount ?? 1}`
                              : `Trang Web: ${item.sourceUrl || 'Chế độ Zen Mode'}`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            }

            if (widget.id === 'watch-queue') {
              return (
                <section
                  key={widget.id}
                  className="p-5 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] space-y-4"
                >
                  <div className="flex items-center justify-between pb-2">
                    <h2 className="font-surveillance text-base font-bold uppercase flex items-center gap-2">
                      <Play className="w-4 h-4 text-[#9E1B16] dark:text-[#FF6B5B]" />
                      {widget.title}
                    </h2>
                    <span className="font-stamp text-[10px] text-[#574A3D] dark:text-[#FF9E8E]">
                      CHAKRA PETCH VN · {mediaItems.length} BĂNG
                    </span>
                  </div>
                  <div className="masking-tape-divider" />
                  <div className="space-y-2.5">
                    {mediaItems.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => onOpenItem(m)}
                        className="w-full text-left p-3 border border-[#6E5332] bg-[#F5EAD2]/90 dark:bg-[#1E0505] hover:border-[#9E1B16] transition-transform hover:-translate-y-0.5 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-surveillance text-xs font-bold uppercase truncate">
                            {m.title}
                          </span>
                          <span className="font-cipher text-[11px] text-[#9E1B16] dark:text-[#FF6B5B] shrink-0">
                            {(m.timestampNotes || []).length} mốc giây
                          </span>
                        </div>
                        <p className="font-polaroid text-sm text-[#574A3D] dark:text-[#FF9E8E] line-clamp-1">
                          {m.excerpt}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              );
            }

            if (widget.id === 'daily-quote') {
              return (
                <section
                  key={widget.id}
                  className="p-5 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-center justify-between pb-2">
                    <h2 className="font-signature text-xl font-bold flex items-center gap-2">
                      <Quote className="w-4 h-4 text-[#9E1B16] dark:text-[#FF6B5B]" />
                      {widget.title}
                    </h2>
                    <button
                      onClick={() => setQuoteIdx((i) => i + 1)}
                      className="font-stamp text-[10px] uppercase text-[#9E1B16] dark:text-[#FF6B5B] hover:underline"
                    >
                      Đổi bút tích trích dẫn
                    </button>
                  </div>
                  <div className="masking-tape-divider" />
                  <blockquote className="font-signature text-2xl leading-relaxed text-[#2A1D12] dark:text-[#FFD6CE]">
                    "{dailyQuote.quote}"
                  </blockquote>
                  <div className="font-typewriter text-xs text-[#574A3D] dark:text-[#FF9E8E]">
                    — {dailyQuote.author}
                  </div>
                </section>
              );
            }

            return (
              <section
                key={widget.id}
                className="p-5 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] space-y-4"
              >
                <div className="flex items-center justify-between pb-2">
                  <h2 className="font-typewriter text-sm font-bold uppercase">{widget.title}</h2>
                  <button
                    onClick={onOpenHabits}
                    className="font-stamp text-[10px] uppercase text-[#9E1B16] dark:text-[#FF6B5B] hover:underline"
                  >
                    Mở Nhật ký trực
                  </button>
                </div>
                <div className="masking-tape-divider" />
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 border border-[#6E5332] bg-[#F5EAD2]/80 dark:bg-[#1E0505]">
                    <div className="font-cipher text-lg font-bold">{habits.expPoints}</div>
                    <div className="font-stamp text-[10px] uppercase text-[#574A3D] dark:text-[#FF9E8E]">
                      Điểm EXP
                    </div>
                  </div>
                  <div className="p-3 border border-[#6E5332] bg-[#F5EAD2]/80 dark:bg-[#1E0505]">
                    <div className="font-cipher text-lg font-bold">{habits.streakDays} ngày</div>
                    <div className="font-stamp text-[10px] uppercase text-[#574A3D] dark:text-[#FF9E8E]">
                      Chuỗi trực
                    </div>
                  </div>
                  <div className="p-3 border border-[#6E5332] bg-[#F5EAD2]/80 dark:bg-[#1E0505]">
                    <div className="font-cipher text-lg font-bold">
                      {habits.readingMinutesToday}p
                    </div>
                    <div className="font-stamp text-[10px] uppercase text-[#574A3D] dark:text-[#FF9E8E]">
                      Hôm nay
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
      </div>
    </div>
  );
}
