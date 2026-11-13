import React, { useRef, useState } from 'react';
import {
  ArrowUpRight,
  Link2,
  MousePointer,
  Plus,
  StickyNote,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { CanvasConnection, CanvasNodePos, VaultItem } from '@/src/types/vault';

interface InfiniteCanvasViewProps {
  items: VaultItem[];
  positions: Record<string, CanvasNodePos>;
  connections: CanvasConnection[];
  onUpdatePositions: (next: Record<string, CanvasNodePos>) => void;
  onAddConnection: (fromId: string, toId: string) => void;
  onOpenItem: (item: VaultItem) => void;
}

interface FloatingNote {
  id: string;
  x: number;
  y: number;
  text: string;
}

const CARD_WIDTH = 256; // w-64 = 256px
const NOTE_WIDTH = 224; // w-56 = 224px

export default function InfiniteCanvasView({
  items,
  positions,
  connections,
  onUpdatePositions,
  onAddConnection,
  onOpenItem,
}: InfiniteCanvasViewProps) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.95);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [notes, setNotes] = useState<FloatingNote[]>([]);

  const draggingCardRef = useRef<{
    id: string;
    kind: 'item' | 'note';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const panningRef = useRef<{
    startX: number;
    startY: number;
    origPanX: number;
    origPanY: number;
  } | null>(null);

  const visibleItems = items.filter((it) => positions[it.id]);
  const unplacedItems = items.filter((it) => !positions[it.id]);

  // Exact pin coordinates at the top-center of each card or sticky note
  const getPinPosition = (id: string): { x: number; y: number } | null => {
    const itemPos = positions[id];
    if (itemPos) {
      return {
        x: itemPos.x + CARD_WIDTH / 2,
        y: itemPos.y,
      };
    }
    const note = notes.find((n) => n.id === id);
    if (note) {
      return {
        x: note.x + NOTE_WIDTH / 2,
        y: note.y,
      };
    }
    return null;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingCardRef.current) {
      const d = draggingCardRef.current;
      const dx = (e.clientX - d.startX) / zoom;
      const dy = (e.clientY - d.startY) / zoom;
      if (d.kind === 'item') {
        onUpdatePositions({
          ...positions,
          [d.id]: {
            ...positions[d.id],
            x: Math.round(d.origX + dx),
            y: Math.round(d.origY + dy),
          },
        });
      } else {
        setNotes((prev) =>
          prev.map((n) =>
            n.id === d.id
              ? { ...n, x: Math.round(d.origX + dx), y: Math.round(d.origY + dy) }
              : n
          )
        );
      }
      return;
    }

    if (panningRef.current) {
      const p = panningRef.current;
      setPan({
        x: p.origPanX + (e.clientX - p.startX),
        y: p.origPanY + (e.clientY - p.startY),
      });
    }
  };

  const handleMouseUp = () => {
    draggingCardRef.current = null;
    panningRef.current = null;
    setActiveDragId(null);
  };

  const handleAddBoardCard = (itemId: string) => {
    if (!itemId) return;
    const count = Object.keys(positions).length;
    onUpdatePositions({
      ...positions,
      [itemId]: {
        x: Math.round(120 + (count % 3) * 290 - pan.x / zoom),
        y: Math.round(90 + Math.floor(count / 3) * 240 - pan.y / zoom),
      },
    });
  };

  const handleUnpinCard = (itemId: string) => {
    const next = { ...positions };
    delete next[itemId];
    onUpdatePositions(next);
  };

  return (
    <div className="flex flex-col h-[640px] manila-paper border-2 border-[#2A2018] dark:border-[#9E1B16] hard-shadow-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b-2 border-[#2A2018] dark:border-[#9E1B16] bg-[#DFC79C] dark:bg-[#3A0C0C] z-10">
        <div className="flex items-center gap-2">
          <span className="font-typewriter text-sm font-bold uppercase tracking-wide">
            Bảng Ghim Chứng Cứ Vô Cực
          </span>
          <span className="font-mono-tabular text-[11px] text-[#574A3D] dark:text-[#FF9E8E] hidden sm:inline">
            · Đinh ghim gắn sát mép trên thẻ ghi chú, nối dây đỏ trực tiếp vào đầu ghim
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {unplacedItems.length > 0 && (
            <select
              value=""
              onChange={(e) => handleAddBoardCard(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] font-typewriter"
            >
              <option value="">+ Ghim hồ sơ lên Bảng ({unplacedItems.length})...</option>
              {unplacedItems.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.title}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() =>
              setNotes((prev) => [
                ...prev,
                {
                  id: `note-${crypto.randomUUID().slice(0, 8)}`,
                  x: Math.round(240 + prev.length * 30 - pan.x / zoom),
                  y: Math.round(160 + prev.length * 25 - pan.y / zoom),
                  text: 'Manh mối mới cần xác minh...',
                },
              ])
            }
            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#F3DF98] text-[#1A120B] border border-[#8E762A] text-xs font-typewriter"
          >
            <StickyNote className="w-3.5 h-3.5" />
            Ghim Giấy Nhớ
          </button>

          <button
            onClick={() => setConnectSourceId((c) => (c ? null : visibleItems[0]?.id ?? null))}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-typewriter uppercase border ${
              connectSourceId
                ? 'bg-[#9E1B16] border-[#2A2018] text-white'
                : 'bg-[#F5EAD2] dark:bg-[#1E0505] border-[#6E5332]'
            }`}
          >
            {connectSourceId ? (
              <Link2 className="w-3.5 h-3.5" />
            ) : (
              <MousePointer className="w-3.5 h-3.5" />
            )}
            {connectSourceId ? 'Chọn thẻ đích...' : 'Nối Dây Đỏ'}
          </button>

          <div className="flex items-center gap-1 bg-[#F5EAD2] dark:bg-[#1E0505] border border-[#6E5332] px-1.5 py-1">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
              className="p-1"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono-tabular text-xs w-10 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))}
              className="p-1"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Corkboard Infinite Stage */}
      <div
        onMouseDown={(e) => {
          if (
            e.target === e.currentTarget ||
            (e.target as HTMLElement).dataset.canvasBg === 'true'
          ) {
            panningRef.current = {
              startX: e.clientX,
              startY: e.clientY,
              origPanX: pan.x,
              origPanY: pan.y,
            };
          }
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="relative flex-1 overflow-hidden corkboard-surface cursor-grab active:cursor-grabbing select-none"
        data-canvas-bg="true"
      >
        {visibleItems.length === 0 && notes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <div className="p-5 manila-paper border-2 border-[#2A2018] hard-shadow max-w-md space-y-2">
              <div className="font-typewriter text-sm font-bold uppercase text-[#9E1B16]">
                Bảng Ghim Đang Trống
              </div>
              <p className="font-handwriting text-lg text-[#3A2E23] dark:text-[#FFD6CE]">
                Chọn &ldquo;+ Ghim hồ sơ lên Bảng&rdquo; hoặc bấm &ldquo;Ghim Giấy Nhớ&rdquo; trên thanh công cụ để ghim chứng cứ và nối dây đỏ.
              </p>
            </div>
          </div>
        )}

        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
          className="absolute inset-0"
          data-canvas-bg="true"
        >
          {/* Pinned Evidence Cards */}
          {visibleItems.map((item, idx) => {
            const pos = positions[item.id];
            const isConnectingSource = connectSourceId === item.id;
            const isDragging = activeDragId === item.id;
            return (
              <div
                key={item.id}
                style={{
                  position: 'absolute',
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  width: `${CARD_WIDTH}px`,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  if (connectSourceId) {
                    if (connectSourceId !== item.id) {
                      onAddConnection(connectSourceId, item.id);
                    }
                    setConnectSourceId(null);
                    return;
                  }
                  setActiveDragId(item.id);
                  draggingCardRef.current = {
                    id: item.id,
                    kind: 'item',
                    startX: e.clientX,
                    startY: e.clientY,
                    origX: pos.x,
                    origY: pos.y,
                  };
                }}
                className={`manila-paper border-2 pt-4 px-3.5 pb-3.5 cursor-move hard-shadow-lg transition-transform ${
                  isDragging ? 'rotate-1 scale-[1.02] z-30' : 'z-10'
                } ${
                  isConnectingSource
                    ? 'border-[#9E1B16] ring-2 ring-[#9E1B16]/50'
                    : 'border-[#2A2018] dark:border-[#9E1B16]'
                }`}
              >
                {/* 3D Pushpin attached directly to the top center edge of the card (y = pos.y, x = pos.x + 128) */}
                <div
                  className="pointer-events-none absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gradient-to-br from-[#D62828] to-[#7D1111] border-2 border-[#F5EAD2] shadow-[0_3px_5px_rgba(0,0,0,0.65)] flex items-center justify-center z-30"
                  title="Đinh ghim hồ sơ"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FFE4DE]/80" />
                </div>

                {item.coverImage && (
                  <img
                    src={item.coverImage}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-24 object-cover border border-[#2A2018] mb-2.5 pointer-events-none sepia-[0.2]"
                  />
                )}
                <div className="flex items-center justify-between font-mono-tabular text-[10px] uppercase text-[#574A3D] dark:text-[#FF9E8E] mb-1">
                  <span>
                    CAT. Nº AV-{idx + 1} · {item.type.toUpperCase()}
                  </span>
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => handleUnpinCard(item.id)}
                    title="Gỡ khỏi bảng ghim"
                    className="text-[#574A3D] hover:text-[#9E1B16]"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <h5 className="font-typewriter text-xs font-bold line-clamp-2 mb-1.5">
                  {item.title}
                </h5>
                <p className="font-handwriting text-base line-clamp-2 mb-2.5">{item.excerpt}</p>
                <div className="flex items-center justify-between pt-2 border-t border-[#6E5332]/40">
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => setConnectSourceId(item.id)}
                    className="font-typewriter text-[10px] uppercase hover:text-[#9E1B16] flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Nối dây
                  </button>
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => onOpenItem(item)}
                    className="font-typewriter text-[10px] uppercase font-semibold text-[#9E1B16] dark:text-[#FF6B5B] flex items-center gap-0.5 hover:underline"
                  >
                    Mở hồ sơ <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Pinned Handwritten Sticky Notes */}
          {notes.map((note) => {
            const isDragging = activeDragId === note.id;
            return (
              <div
                key={note.id}
                style={{
                  position: 'absolute',
                  left: `${note.x}px`,
                  top: `${note.y}px`,
                  width: `${NOTE_WIDTH}px`,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setActiveDragId(note.id);
                  draggingCardRef.current = {
                    id: note.id,
                    kind: 'note',
                    startX: e.clientX,
                    startY: e.clientY,
                    origX: note.x,
                    origY: note.y,
                  };
                }}
                className={`pt-4 px-3 pb-3 bg-[#F3DF98] text-[#1A120B] border-2 border-[#8E762A] hard-shadow cursor-move transition-transform ${
                  isDragging ? '-rotate-1 scale-[1.02] z-30' : 'rotate-1 z-10'
                }`}
              >
                {/* 3D Pushpin attached directly to the top center edge of the sticky note */}
                <div className="pointer-events-none absolute -top-2.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-gradient-to-br from-[#D62828] to-[#7D1111] border-2 border-[#F5EAD2] shadow-[0_2px_4px_rgba(0,0,0,0.6)] z-30" />

                <div className="flex justify-end mb-1">
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => setNotes((prev) => prev.filter((n) => n.id !== note.id))}
                    className="text-[#6E5332] hover:text-[#9E1B16]"
                    title="Gỡ giấy nhớ"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <textarea
                  value={note.text}
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) =>
                    setNotes((prev) =>
                      prev.map((n) => (n.id === note.id ? { ...n, text: e.target.value } : n))
                    )
                  }
                  rows={3}
                  className="w-full bg-transparent font-handwriting text-lg leading-snug focus:outline-none resize-none"
                />
              </div>
            );
          })}

          {/* Red Investigation Yarn Connectors (Rendered on top at exact pushpin coordinates) */}
          <svg className="absolute inset-0 w-[4000px] h-[4000px] pointer-events-none overflow-visible z-20">
            {connections.map((conn) => {
              const p1 = getPinPosition(conn.fromId);
              const p2 = getPinPosition(conn.toId);
              if (!p1 || !p2) return null;
              const x1 = p1.x;
              const y1 = p1.y;
              const x2 = p2.x;
              const y2 = p2.y;
              const midX = (x1 + x2) / 2;
              const midY = Math.max(y1, y2) + 38;
              return (
                <g key={conn.id}>
                  {/* Subtle yarn drop shadow */}
                  <path
                    d={`M ${x1} ${y1 + 2} Q ${midX} ${midY + 4} ${x2} ${y2 + 2}`}
                    fill="none"
                    stroke="rgba(0,0,0,0.35)"
                    strokeWidth={3}
                  />
                  {/* Red yarn tied directly from pushpin to pushpin */}
                  <path
                    d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
                    fill="none"
                    stroke="#9E1B16"
                    strokeWidth={2.8}
                    strokeLinecap="round"
                  />
                  <circle cx={x1} cy={y1} r={5} fill="#9E1B16" stroke="#F5EAD2" strokeWidth={1.8} />
                  <circle cx={x2} cy={y2} r={5} fill="#9E1B16" stroke="#F5EAD2" strokeWidth={1.8} />
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
