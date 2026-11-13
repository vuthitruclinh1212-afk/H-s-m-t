import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Link2, Network } from 'lucide-react';
import type { VaultItem } from '@/src/types/vault';
import { RubberStampButton } from '@/src/components/bureau/BureauDecorations';

interface KnowledgeGraphViewProps {
  items: VaultItem[];
  onOpenItem: (item: VaultItem) => void;
  onCreateLink: (sourceId: string, targetId: string) => void;
}

interface NodePos {
  id: string;
  x: number;
  y: number;
}

export default function KnowledgeGraphView({
  items,
  onOpenItem,
  onCreateLink,
}: KnowledgeGraphViewProps) {
  const [positions, setPositions] = useState<Record<string, NodePos>>({});
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [linkTargetId, setLinkTargetId] = useState<string>('');
  const draggingIdRef = useRef<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    setPositions((prev) => {
      const next: Record<string, NodePos> = { ...prev };
      const count = Math.max(1, items.length);
      items.forEach((item, idx) => {
        if (!next[item.id]) {
          const angle = (idx / count) * Math.PI * 2;
          const radius = 165 + (idx % 2) * 65;
          next[item.id] = {
            id: item.id,
            x: 420 + Math.cos(angle) * radius,
            y: 260 + Math.sin(angle) * radius,
          };
        }
      });
      return next;
    });
  }, [items]);

  const edges = useMemo(() => {
    const result: Array<{ from: string; to: string; kind: 'manual' | 'semantic' }> = [];
    const seen = new Set<string>();

    for (const item of items) {
      for (const targetId of item.linkedIds) {
        const key = [item.id, targetId].sort().join('::');
        if (!seen.has(key) && items.some((x) => x.id === targetId)) {
          seen.add(key);
          result.push({ from: item.id, to: targetId, kind: 'manual' });
        }
      }
    }

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const shared = a.tags.filter((t) => b.tags.includes(t));
        const key = [a.id, b.id].sort().join('::');
        if (shared.length > 0 && !seen.has(key)) {
          seen.add(key);
          result.push({ from: a.id, to: b.id, kind: 'semantic' });
        }
      }
    }
    return result;
  }, [items]);

  const selectedItem = items.find((it) => it.id === selectedId) ?? null;

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingIdRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = 840 / rect.width;
    const scaleY = 520 / rect.height;
    const x = Math.min(790, Math.max(50, (e.clientX - rect.left) * scaleX));
    const y = Math.min(475, Math.max(45, (e.clientY - rect.top) * scaleY));
    const id = draggingIdRef.current;
    setPositions((prev) => ({ ...prev, [id]: { id, x, y } }));
  };

  const stopDrag = () => {
    draggingIdRef.current = null;
    setDraggingId(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-8 manila-paper border-2 border-[#2A2018] dark:border-[#9E1B16] hard-shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[#2A2018] dark:border-[#9E1B16] bg-[#DFC79C] dark:bg-[#3A0C0C]">
          <div className="flex items-center gap-2 text-sm font-typewriter font-bold tracking-wide uppercase">
            <Network className="w-4 h-4 text-[#9E1B16] dark:text-[#FF6B5B]" />
            <span>Sơ Đồ Điều Tra Dây Đỏ (Knowledge Graph)</span>
          </div>
          <span className="font-mono-tabular text-xs text-[#574A3D] dark:text-[#FF9E8E]">
            {items.length} ĐẦU MỐI · {edges.length} DÂY NỐI
          </span>
        </div>

        <svg
          ref={svgRef}
          viewBox="0 0 840 520"
          onMouseMove={handleSvgMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
          className="w-full h-[500px] corkboard-surface select-none"
        >
          {edges.map((edge, idx) => {
            const p1 = positions[edge.from];
            const p2 = positions[edge.to];
            if (!p1 || !p2) return null;
            const highlighted =
              hoveredId === edge.from ||
              hoveredId === edge.to ||
              selectedId === edge.from ||
              selectedId === edge.to;

            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2 + 18;

            return (
              <path
                key={idx}
                d={`M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y}`}
                fill="none"
                stroke={
                  highlighted
                    ? '#C81E1E'
                    : edge.kind === 'manual'
                    ? '#9E1B16'
                    : 'rgba(38, 25, 16, 0.55)'
                }
                strokeWidth={highlighted ? 3 : edge.kind === 'manual' ? 2 : 1.1}
                strokeDasharray={edge.kind === 'semantic' ? '5 4' : undefined}
              />
            );
          })}

          {items.map((item, idx) => {
            const pos = positions[item.id];
            if (!pos) return null;
            const isSelected = selectedId === item.id;
            const isHovered = hoveredId === item.id;
            const isDragging = draggingId === item.id;

            return (
              <g
                key={item.id}
                transform={`translate(${pos.x}, ${pos.y}) ${isDragging ? 'rotate(3) scale(1.06)' : ''}`}
                onMouseDown={() => {
                  draggingIdRef.current = item.id;
                  setDraggingId(item.id);
                  setSelectedId(item.id);
                }}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="cursor-grab active:cursor-grabbing"
              >
                <rect
                  x={-58}
                  y={-18}
                  width={116}
                  height={46}
                  fill="#F5EAD2"
                  stroke={isSelected ? '#9E1B16' : '#2A2018'}
                  strokeWidth={isSelected ? 2.4 : 1.4}
                />
                <circle
                  cx={0}
                  cy={-16}
                  r={isSelected || isHovered ? 6 : 5}
                  fill="#9E1B16"
                  stroke="#F5EAD2"
                  strokeWidth={1.5}
                />
                <text
                  y={-1}
                  textAnchor="middle"
                  className="fill-[#574A3D] font-mono-tabular text-[8px] uppercase pointer-events-none"
                >
                  EXH-{String(idx + 1).padStart(2, '0')} · {item.type}
                </text>
                <text
                  y={14}
                  textAnchor="middle"
                  className="fill-[#1A120B] font-semibold text-[9.5px] pointer-events-none"
                >
                  {item.title.length > 18 ? `${item.title.slice(0, 18)}…` : item.title}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Inspector Dossier Card */}
      <div className="lg:col-span-4 space-y-4">
        {selectedItem ? (
          <div className="p-5 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] space-y-4">
            <div className="flex items-start justify-between gap-2 pb-2">
              <div className="space-y-1">
                <div className="font-mono-tabular text-[11px] uppercase tracking-wider text-[#574A3D] dark:text-[#FF9E8E]">
                  {selectedItem.type} · {selectedItem.smartFolder}
                </div>
                <h3 className="font-typewriter text-lg font-bold leading-snug">
                  {selectedItem.title}
                </h3>
              </div>
              <span className="stamp-crimson text-[10px] shrink-0">CHỨNG CỨ</span>
            </div>

            <div className="masking-tape-divider" />

            <p className="font-handwriting text-xl leading-snug">{selectedItem.excerpt}</p>
            <div className="font-mono-tabular text-[11px] text-[#574A3D] dark:text-[#FF9E8E]">
              PHÂN LOẠI: {selectedItem.tags.join(' · ')}
            </div>

            <div className="flex justify-center">
              <RubberStampButton onClick={() => onOpenItem(selectedItem)} stampWord="OPENED">
                <span className="inline-flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Mở Hồ Sơ Này
                </span>
              </RubberStampButton>
            </div>

            <div className="red-string-divider my-2" />

            <div className="space-y-2">
              <label className="block text-xs font-typewriter font-semibold flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-[#9E1B16] dark:text-[#FF6B5B]" />
                Căng Dây Đỏ tới Đầu Mối Khác
              </label>
              <div className="flex gap-2">
                <select
                  value={linkTargetId}
                  onChange={(e) => setLinkTargetId(e.target.value)}
                  className="flex-1 px-2.5 py-2 text-xs border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505]"
                >
                  <option value="">Chọn hồ sơ đích...</option>
                  {items
                    .filter((it) => it.id !== selectedItem.id)
                    .map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.title}
                      </option>
                    ))}
                </select>
                <button
                  disabled={!linkTargetId}
                  onClick={() => {
                    if (linkTargetId) {
                      onCreateLink(selectedItem.id, linkTargetId);
                      setLinkTargetId('');
                    }
                  }}
                  className="px-3 py-2 text-xs font-typewriter uppercase bg-[#9E1B16] text-[#F5EAD2] disabled:opacity-40"
                >
                  Nối Dây
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5 manila-paper torn-paper-card border-2 border-[#2A2018] font-handwriting text-xl text-[#574A3D]">
            Chọn một thẻ ghim trên bảng điều tra để xem chi tiết.
          </div>
        )}
      </div>
    </div>
  );
}
