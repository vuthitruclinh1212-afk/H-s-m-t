import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  FileText,
  Headphones,
  Highlighter,
  Maximize2,
  Minimize2,
  MousePointer,
  PenTool,
  ScanText,
  Scissors,
  ScrollText,
  Sparkles,
  Square,
  SquarePen,
  StickyNote,
  Type,
  Underline,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { NormalizedPoint, PdfAnnotation } from '@/src/types/vault';
import { base64ToUint8, exportAnnotatedPdf } from '@/src/utils/pdfFactory';
import {
  PaperclipCloseBtn,
  RedactedSkeleton,
  RevolverSpinner,
} from '@/src/components/bureau/BureauDecorations';

type ReaderMode = 'continuous' | 'single';
type ToolMode = 'pan' | 'highlight' | 'underline' | 'draw' | 'text' | 'sticky' | 'redact';

interface UniversalPdfReaderProps {
  itemId: string;
  title: string;
  pdfBase64?: string;
  initialPage?: number;
  annotations: PdfAnnotation[];
  onUpdateAnnotations: (annotations: PdfAnnotation[]) => void;
  onPageProgress?: (page: number, totalPages: number) => void;
  onOpenSplitMerge: () => void;
  onGainExp?: (amount: number, reason: string) => void;
}

export default function UniversalPdfReader({
  title,
  pdfBase64,
  initialPage = 1,
  annotations,
  onUpdateAnnotations,
  onPageProgress,
  onOpenSplitMerge,
  onGainExp,
}: UniversalPdfReaderProps) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [pageImages, setPageImages] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mặc định cho kéo xuống trong khung riêng ('continuous') hoặc chuyển trang bình thường ('single')
  const [readerMode, setReaderMode] = useState<ReaderMode>('continuous');
  const [toolMode, setToolMode] = useState<ToolMode>('pan');
  const [zoom, setZoom] = useState<number>(1.2);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  const [activeStroke, setActiveStroke] = useState<NormalizedPoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const [pendingPopover, setPendingPopover] = useState<{
    kind: 'sticky' | 'text';
    page: number;
    x: number;
    y: number;
  } | null>(null);
  const [popoverValue, setPopoverValue] = useState('');

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsLang, setTtsLang] = useState<'vi-VN' | 'en-US'>('vi-VN');
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiDrawerTitle, setAiDrawerTitle] = useState('');
  const [aiDrawerContent, setAiDrawerContent] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const vectorCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!pdfBase64) {
      setIsLoading(false);
      setErrorMsg('Chưa có dữ liệu nhị phân PDF cho mục này.');
      return;
    }

    let cancelled = false;
    async function loadPdf() {
      try {
        setIsLoading(true);
        setErrorMsg(null);
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const bytes = base64ToUint8(pdfBase64!);
        const loadingTask = pdfjs.getDocument({ data: bytes });
        const doc = await loadingTask.promise;
        if (cancelled) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        const startPage = Math.min(Math.max(1, initialPage), doc.numPages);
        setCurrentPage(startPage);

        const rendered: Record<number, string> = {};
        const maxPreRender = Math.min(doc.numPages, 40);
        for (let i = 1; i <= maxPreRender; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1.75 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          rendered[i] = canvas.toDataURL('image/webp', 0.93);
        }

        if (!cancelled) {
          setPageImages(rendered);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Không thể giải mã tệp PDF.');
          setIsLoading(false);
        }
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [pdfBase64, initialPage]);

  useEffect(() => {
    if (readerMode !== 'single' || !pdfDoc || !vectorCanvasRef.current) return;
    let cancelled = false;

    async function renderVectorPage() {
      if (!pdfDoc || !vectorCanvasRef.current) return;
      const page = await pdfDoc.getPage(currentPage);
      if (cancelled) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: zoom });
      const canvas = vectorCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    }

    renderVectorPage();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage, zoom, readerMode]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const goToPage = (target: number) => {
    if (numPages < 1) return;
    const clamped = Math.min(Math.max(1, target), numPages);
    setCurrentPage(clamped);
    onPageProgress?.(clamped, numPages);
    if (readerMode === 'continuous' && pageRefs.current[clamped]) {
      pageRefs.current[clamped]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const stepPage = (dir: 'next' | 'prev') => {
    if (dir === 'next' && currentPage < numPages) {
      const nextP = currentPage + 1;
      goToPage(nextP);
      onGainExp?.(5, 'Đọc tiếp trang tài liệu');
    } else if (dir === 'prev' && currentPage > 1) {
      const prevP = currentPage - 1;
      goToPage(prevP);
    }
  };

  const toggleTextToSpeech = useCallback(async () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setStatusNotice('Trình duyệt hiện tại không hỗ trợ Web Speech API.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!pdfDoc) return;
    const page = await pdfDoc.getPage(currentPage);
    const textContent = await page.getTextContent();
    const extracted = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim();

    if (!extracted) {
      setStatusNotice('Trang này chưa có lớp văn bản (dạng scan). Hãy bấm nút OCR trước!');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(extracted);
    utterance.lang = ttsLang;
    utterance.rate = 1.02;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, [isSpeaking, pdfDoc, currentPage, ttsLang]);

  const handleRunOCR = async () => {
    if (!pdfDoc) return;
    setAiDrawerOpen(true);
    setAiDrawerTitle(`AI OCR — Trang ${currentPage}`);
    setAiLoading(true);
    setAiDrawerContent('');

    try {
      let imgData = pageImages[currentPage];
      if (!imgData) {
        const page = await pdfDoc.getPage(currentPage);
        const vp = page.getViewport({ scale: 1.8 });
        const c = document.createElement('canvas');
        c.width = vp.width;
        c.height = vp.height;
        const ctx = c.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise;
          imgData = c.toDataURL('image/png');
        }
      }

      const res = await fetch('/api/ai/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imgData,
          mimeType: 'image/webp',
          pageNumber: currentPage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi OCR');
      setAiDrawerContent(data.text || 'Không tìm thấy văn bản trên trang này.');
      onGainExp?.(15, 'Trích xuất OCR bằng AI');
    } catch (err) {
      setAiDrawerContent(
        err instanceof Error ? err.message : 'Không thể kết nối dịch vụ AI OCR.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleRunSummarize = async () => {
    if (!pdfDoc) return;
    setAiDrawerOpen(true);
    setAiDrawerTitle('AI Tóm tắt tài liệu');
    setAiLoading(true);
    setAiDrawerContent('');

    try {
      const limitPages = Math.min(pdfDoc.numPages, 10);
      const chunks: string[] = [];
      for (let i = 1; i <= limitPages; i++) {
        const page = await pdfDoc.getPage(i);
        const tc = await page.getTextContent();
        const txt = tc.items.map((it) => ('str' in it ? it.str : '')).join(' ');
        if (txt.trim()) chunks.push(`[Trang ${i}] ${txt}`);
      }

      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          type: 'PDF',
          content:
            chunks.join('\n\n') || `Tài liệu PDF ${title} gồm ${pdfDoc.numPages} trang.`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi tóm tắt AI');
      setAiDrawerContent(data.summary);
      onGainExp?.(20, 'Tóm tắt tài liệu bằng AI');
    } catch (err) {
      setAiDrawerContent(err instanceof Error ? err.message : 'Không thể tạo tóm tắt AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleExportPdf = async () => {
    if (!pdfBase64) return;
    try {
      const modifiedBytes = await exportAnnotatedPdf(pdfBase64, annotations);
      const blob = new Blob([modifiedBytes.buffer as ArrayBuffer], {
        type: 'application/pdf',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9_-]+/g, '_')}_edited.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusNotice('Đã xuất tệp PDF kèm chỉnh sửa & ghi chú trực tiếp.');
    } catch (err) {
      setStatusNotice(err instanceof Error ? err.message : 'Lỗi khi xuất PDF.');
    }
  };

  const getNormalizedCoords = (e: React.MouseEvent<HTMLDivElement>): NormalizedPoint => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1),
    };
  };

  const handleOverlayMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    pageNumber: number
  ) => {
    setCurrentPage(pageNumber);
    if (pendingPopover) return;
    if (toolMode === 'pan') {
      if (readerMode === 'single') {
        isPanningRef.current = true;
        panStartRef.current = {
          x: e.clientX - panOffset.x,
          y: e.clientY - panOffset.y,
        };
      }
      return;
    }

    const pt = getNormalizedCoords(e);
    if (toolMode === 'sticky' || toolMode === 'text') {
      setPendingPopover({ kind: toolMode, page: pageNumber, x: pt.x, y: pt.y });
      setPopoverValue('');
      return;
    }

    if (toolMode === 'redact') {
      onUpdateAnnotations([
        ...annotations,
        {
          id: crypto.randomUUID(),
          page: pageNumber,
          kind: 'redact',
          color: '#14100C',
          x: pt.x,
          y: pt.y,
          width: 0.22,
          height: 0.038,
          createdAt: new Date().toISOString(),
        },
      ]);
      return;
    }

    setIsDrawing(true);
    setActiveStroke([pt]);
  };

  const handleOverlayMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (toolMode === 'pan' && readerMode === 'single' && isPanningRef.current) {
      setPanOffset({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
      return;
    }
    if (isDrawing) {
      setActiveStroke((prev) => [...prev, getNormalizedCoords(e)]);
    }
  };

  const handleOverlayMouseUp = (pageNumber: number) => {
    isPanningRef.current = false;
    if (isDrawing && activeStroke.length > 1) {
      const colorMap: Record<string, string> = {
        highlight: 'rgba(250, 204, 21, 0.5)',
        underline: '#9E1B16',
        draw: '#1A120B',
      };
      const kind =
        toolMode === 'highlight'
          ? 'highlight'
          : toolMode === 'underline'
          ? 'underline'
          : 'draw';
      onUpdateAnnotations([
        ...annotations,
        {
          id: crypto.randomUUID(),
          page: pageNumber,
          kind,
          color: colorMap[kind],
          points: activeStroke,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    setIsDrawing(false);
    setActiveStroke([]);
  };

  const confirmPopoverAnnotation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingPopover || !popoverValue.trim()) {
      setPendingPopover(null);
      return;
    }
    onUpdateAnnotations([
      ...annotations,
      {
        id: crypto.randomUUID(),
        page: pendingPopover.page,
        kind: pendingPopover.kind,
        color: pendingPopover.kind === 'sticky' ? '#F3DF98' : '#9E1B16',
        x: pendingPopover.x,
        y: pendingPopover.y,
        content: popoverValue.trim(),
        author: 'Bạn',
        createdAt: new Date().toISOString(),
      },
    ]);
    setPendingPopover(null);
    setPopoverValue('');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const renderPageAnnotationsOverlay = (pageNumber: number) => {
    const pageAnns = annotations.filter((a) => a.page === pageNumber);
    return (
      <>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          {pageAnns
            .filter(
              (a) =>
                (a.kind === 'draw' || a.kind === 'highlight' || a.kind === 'underline') &&
                a.points
            )
            .map((a) => (
              <polyline
                key={a.id}
                fill="none"
                stroke={a.color}
                strokeWidth={a.kind === 'highlight' ? 3.2 : 0.45}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={a.points!.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
              />
            ))}

          {isDrawing && currentPage === pageNumber && activeStroke.length > 1 && (
            <polyline
              fill="none"
              stroke={
                toolMode === 'highlight'
                  ? 'rgba(250, 204, 21, 0.5)'
                  : toolMode === 'underline'
                  ? '#9E1B16'
                  : '#1A120B'
              }
              strokeWidth={toolMode === 'highlight' ? 3.2 : 0.45}
              strokeLinecap="round"
              points={activeStroke.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
            />
          )}
        </svg>

        {pageAnns
          .filter((a) => a.kind === 'text' || a.kind === 'sticky' || a.kind === 'redact')
          .map((item) => {
            if (item.kind === 'redact') {
              return (
                <div
                  key={item.id}
                  style={{
                    left: `${(item.x ?? 0.3) * 100}%`,
                    top: `${(item.y ?? 0.3) * 100}%`,
                    width: `${(item.width ?? 0.22) * 100}%`,
                    height: `${(item.height ?? 0.04) * 100}%`,
                  }}
                  className="absolute bg-[#14100C]"
                  title="Vùng đã kiểm duyệt (Redacted)"
                />
              );
            }
            return (
              <div
                key={item.id}
                style={{
                  left: `${(item.x ?? 0.5) * 100}%`,
                  top: `${(item.y ?? 0.5) * 100}%`,
                }}
                className={
                  item.kind === 'sticky'
                    ? 'absolute -translate-x-1/2 -translate-y-1/2 bg-[#F3DF98] text-[#1A120B] font-handwriting text-base px-2.5 py-1.5 border border-[#8E762A] hard-shadow max-w-[200px]'
                    : 'absolute -translate-y-1/2 text-[#9E1B16] font-handwriting font-bold text-base bg-[#F7F1E3]/90 px-1.5 py-0.5 border border-dashed border-[#9E1B16]'
                }
              >
                {item.content}
              </div>
            );
          })}

        {/* #12: Stamped Page Number */}
        <span className="font-typewriter absolute bottom-2 right-3 text-[11px] text-[#2A2018]/80 border border-[#2A2018]/45 px-1.5 py-0.5 bg-[#EBDAB9]/85 -rotate-2 pointer-events-none">
          No. {String(pageNumber).padStart(4, '0')} / {String(numPages).padStart(4, '0')}
        </span>

        {pendingPopover && pendingPopover.page === pageNumber && (
          <form
            onSubmit={confirmPopoverAnnotation}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              left: `${Math.min(pendingPopover.x * 100, 70)}%`,
              top: `${Math.min(pendingPopover.y * 100, 78)}%`,
            }}
            className="absolute z-30 w-60 p-3 bg-[#F3DF98] border-2 border-[#2A2018] hard-shadow"
          >
            <label className="block text-[11px] font-typewriter text-[#1A120B] mb-1.5">
              {pendingPopover.kind === 'sticky' ? 'Nội dung Giấy Nhớ' : 'Chèn chữ viết tay'}
            </label>
            <input
              autoFocus
              type="text"
              value={popoverValue}
              onChange={(e) => setPopoverValue(e.target.value)}
              placeholder="Nhập nội dung..."
              className="w-full px-2.5 py-1.5 font-handwriting text-lg border border-[#6E5332] bg-[#FAF3DA] text-[#1A120B] focus:outline-none"
            />
            <div className="flex justify-end gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => setPendingPopover(null)}
                className="px-2 py-1 text-xs font-typewriter text-[#574A3D]"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-2.5 py-1 text-xs font-typewriter uppercase bg-[#9E1B16] text-white"
              >
                Lưu
              </button>
            </div>
          </form>
        )}
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col w-full manila-paper border-2 border-[#2A2018] dark:border-[#9E1B16] overflow-hidden hard-shadow-lg"
    >
      {/* READER TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#DFC79C] dark:bg-[#3A0C0C] border-b-2 border-[#2A2018] dark:border-[#9E1B16]">
        {/* Mode Switch: Cuộn dọc khung riêng vs Chuyển từng trang bình thường */}
        <div className="flex items-center gap-1 p-1 bg-[#C9B38C] dark:bg-[#1E0505] border border-[#6E5332]">
          <button
            onClick={() => setReaderMode('continuous')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-typewriter uppercase whitespace-nowrap shrink-0 transition-colors ${
              readerMode === 'continuous'
                ? 'bg-[#9E1B16] text-[#F5EAD2]'
                : 'text-[#3A2E23] dark:text-[#FF9E8E]'
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" />
            Cuộn Dọc (Khung Riêng)
          </button>
          <button
            onClick={() => {
              setReaderMode('single');
              setPanOffset({ x: 0, y: 0 });
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-typewriter uppercase whitespace-nowrap shrink-0 transition-colors ${
              readerMode === 'single'
                ? 'bg-[#9E1B16] text-[#F5EAD2]'
                : 'text-[#3A2E23] dark:text-[#FF9E8E]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Từng Trang (Next / Prev)
          </button>
        </div>

        {/* Page Nav & Brass Zoom Slider */}
        <div className="flex items-center gap-1.5 bg-[#F5EAD2] dark:bg-[#1E0505] border border-[#6E5332] px-2 py-1">
          <button
            onClick={() => stepPage('prev')}
            disabled={currentPage <= 1}
            className="p-1.5 hover:bg-[#DFC79C] dark:hover:bg-[#3A0C0C] disabled:opacity-40 transition-colors"
            title="Trang trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <select
            value={currentPage}
            onChange={(e) => goToPage(Number(e.target.value))}
            aria-label="Chọn trang"
            className="font-typewriter text-xs px-1.5 py-0.5 bg-transparent border border-[#6E5332]/50 focus:outline-none"
          >
            {Array.from({ length: Math.max(1, numPages) }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                Trang {i + 1}/{numPages || 1}
              </option>
            ))}
          </select>

          <button
            onClick={() => stepPage('next')}
            disabled={currentPage >= numPages}
            className="p-1.5 hover:bg-[#DFC79C] dark:hover:bg-[#3A0C0C] disabled:opacity-40 transition-colors"
            title="Trang tiếp theo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-[#6E5332]/50 mx-1" />
          <button
            onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
            className="p-1 hover:bg-[#DFC79C] dark:hover:bg-[#3A0C0C]"
            title="Thu nhỏ"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <input
            type="range"
            min={0.6}
            max={2.6}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="brass-slider w-20 hidden sm:block"
            aria-label="Thước đồng phóng to"
          />
          <span className="font-mono-tabular text-xs w-11 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2.6, +(z + 0.15).toFixed(2)))}
            className="p-1 hover:bg-[#DFC79C] dark:hover:bg-[#3A0C0C]"
            title="Phóng to không vỡ nét"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Annotation & Live Edit Tools */}
        <div className="flex items-center gap-1 bg-[#F5EAD2] dark:bg-[#1E0505] border border-[#6E5332] px-1.5 py-1">
          {(
            [
              { id: 'pan', icon: MousePointer, label: 'Cuộn / Kéo khung nhìn' },
              { id: 'highlight', icon: Highlighter, label: 'Bút dạ quang' },
              { id: 'underline', icon: Underline, label: 'Gạch chân đỏ' },
              { id: 'draw', icon: PenTool, label: 'Khoanh mực đen' },
              { id: 'text', icon: Type, label: 'Chèn chữ trực tiếp (Live Edit)' },
              { id: 'sticky', icon: StickyNote, label: 'Dán giấy nhớ điều tra' },
              { id: 'redact', icon: SquarePen, label: 'Bôi đen thông tin mật (Redaction)' },
            ] as const
          ).map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => setToolMode(tool.id)}
                title={tool.label}
                className={`p-1.5 transition-colors ${
                  toolMode === tool.id
                    ? 'bg-[#9E1B16] text-white'
                    : 'text-[#3A2E23] dark:text-[#FF9E8E] hover:bg-[#DFC79C] dark:hover:bg-[#3A0C0C]'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
          <button
            onClick={() =>
              onUpdateAnnotations(annotations.filter((a) => a.page !== currentPage))
            }
            title="Xóa toàn bộ chú thích trang hiện tại"
            className="p-1.5 text-[#9E1B16] dark:text-[#FF6B5B] hover:bg-[#DFC79C] dark:hover:bg-[#3A0C0C]"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* AI, Audio & PDF Actions */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-[#F5EAD2] dark:bg-[#1E0505] border border-[#6E5332] p-0.5">
            <button
              onClick={toggleTextToSpeech}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-typewriter uppercase whitespace-nowrap shrink-0 transition-colors ${
                isSpeaking
                  ? 'bg-[#9E1B16] text-white'
                  : 'text-[#1A120B] dark:text-[#FFD6CE] hover:bg-[#DFC79C] dark:hover:bg-[#3A0C0C]'
              }`}
              title="Đọc thành tiếng (Text-to-Speech)"
            >
              {isSpeaking ? (
                <Square className="w-3.5 h-3.5" />
              ) : (
                <Headphones className="w-3.5 h-3.5" />
              )}
              {isSpeaking ? 'Dừng đọc' : 'Đọc TTS'}
            </button>
            <select
              aria-label="Ngôn ngữ đọc TTS"
              value={ttsLang}
              onChange={(e) => setTtsLang(e.target.value as 'vi-VN' | 'en-US')}
              className="bg-transparent text-[11px] font-mono-tabular px-1.5 py-1 focus:outline-none"
            >
              <option value="vi-VN">VI</option>
              <option value="en-US">EN</option>
            </select>
          </div>

          <button
            onClick={handleRunOCR}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-typewriter uppercase border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] hover:bg-[#DFC79C] dark:hover:bg-[#3A0C0C] whitespace-nowrap shrink-0"
            title="AI OCR trích xuất văn bản"
          >
            <ScanText className="w-3.5 h-3.5 text-[#9E1B16] dark:text-[#FF6B5B]" />
            OCR
          </button>

          <button
            onClick={handleRunSummarize}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-typewriter uppercase bg-[#9E1B16] text-[#F5EAD2] hover:bg-[#C81E1E] whitespace-nowrap shrink-0 border border-[#2A2018]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Tóm tắt AI
          </button>

          <button
            onClick={onOpenSplitMerge}
            className="p-1.5 border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] hover:bg-[#DFC79C] dark:hover:bg-[#3A0C0C]"
            title="Cắt / Gộp PDF"
          >
            <Scissors className="w-4 h-4" />
          </button>

          <button
            onClick={handleExportPdf}
            className="p-1.5 border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] hover:bg-[#DFC79C] dark:hover:bg-[#3A0C0C]"
            title="Xuất PDF đã chỉnh sửa"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] hover:bg-[#DFC79C] dark:hover:bg-[#3A0C0C]"
            title="Toàn màn hình"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Torn Masking-Tape Status Notice */}
      {statusNotice && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#F3DF98] border-b border-dashed border-[#8E762A] text-xs font-handwriting text-lg text-[#1A120B]">
          <span>📌 {statusNotice}</span>
          <button onClick={() => setStatusNotice(null)} className="p-0.5 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* DEDICATED SCROLLABLE FRAME VIEWPORT */}
      <div className="relative h-[680px] flex overflow-hidden corkboard-surface">
        <div
          ref={scrollFrameRef}
          className="flex-1 h-full overflow-y-auto overflow-x-auto p-6 flex flex-col items-center gap-6"
          style={{ cursor: toolMode === 'pan' ? 'default' : 'crosshair' }}
        >
          {isLoading && (
            <div className="my-auto p-6 manila-paper torn-paper-card border-2 border-[#2A2018]">
              <RevolverSpinner label="Đang dựng trang hồ sơ PDF..." />
            </div>
          )}

          {errorMsg && (
            <div className="my-auto px-4 py-3 manila-paper border-2 border-[#9E1B16] text-[#9E1B16] font-typewriter text-sm">
              {errorMsg}
            </div>
          )}

          {/* MODE 1: CONTINUOUS VERTICAL SCROLL IN DEDICATED FRAME */}
          {!isLoading && !errorMsg && readerMode === 'continuous' && numPages > 0 && (
            <div className="flex flex-col items-center gap-6 pb-8">
              {Array.from({ length: numPages }).map((_, idx) => {
                const pageNum = idx + 1;
                const img = pageImages[pageNum];
                const scaledWidth = Math.round(580 * zoom);
                return (
                  <div
                    key={pageNum}
                    ref={(el) => {
                      pageRefs.current[pageNum] = el;
                    }}
                    style={{ width: `${scaledWidth}px` }}
                    onMouseDown={(e) => handleOverlayMouseDown(e, pageNum)}
                    onMouseMove={handleOverlayMouseMove}
                    onMouseUp={() => handleOverlayMouseUp(pageNum)}
                    className={`relative bg-[#F7F1E3] hard-shadow-lg border-2 transition-colors select-none ${
                      currentPage === pageNum ? 'border-[#9E1B16]' : 'border-[#2A2018]'
                    }`}
                  >
                    {img ? (
                      <img
                        src={img}
                        alt={`Trang ${pageNum}`}
                        className="w-full h-auto block pointer-events-none"
                        draggable={false}
                      />
                    ) : (
                      <div className="h-[720px] flex items-center justify-center font-typewriter text-xs text-[#574A3D]">
                        Đang tải trang {pageNum}...
                      </div>
                    )}
                    {renderPageAnnotationsOverlay(pageNum)}
                  </div>
                );
              })}
            </div>
          )}

          {/* MODE 2: NORMAL SINGLE PAGE VIEW WITH PREV / NEXT */}
          {!isLoading && !errorMsg && readerMode === 'single' && numPages > 0 && (
            <div className="my-auto flex flex-col items-center gap-4">
              <div
                className="relative bg-[#F7F1E3] hard-shadow-lg border-2 border-[#2A2018] select-none"
                style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px)` }}
                onMouseDown={(e) => handleOverlayMouseDown(e, currentPage)}
                onMouseMove={handleOverlayMouseMove}
                onMouseUp={() => handleOverlayMouseUp(currentPage)}
              >
                <canvas ref={vectorCanvasRef} className="block" />
                {renderPageAnnotationsOverlay(currentPage)}
              </div>

              <div className="flex items-center gap-3 px-4 py-1.5 manila-paper border-2 border-[#2A2018] hard-shadow">
                <button
                  onClick={() => stepPage('prev')}
                  disabled={currentPage <= 1}
                  className="px-3 py-1 bg-[#F5EAD2] dark:bg-[#1E0505] border border-[#6E5332] font-typewriter text-xs uppercase disabled:opacity-40 hover:bg-[#DFC79C]"
                >
                  ◄ Trang trước
                </button>
                <span className="font-typewriter text-xs font-bold">
                  Trang {currentPage} / {numPages}
                </span>
                <button
                  onClick={() => stepPage('next')}
                  disabled={currentPage >= numPages}
                  className="px-3 py-1 bg-[#9E1B16] text-[#F5EAD2] border border-[#2A2018] font-typewriter text-xs uppercase disabled:opacity-40 hover:bg-[#C81E1E]"
                >
                  Trang tiếp ►
                </button>
              </div>
            </div>
          )}
        </div>

        {/* AI DRAWER (OCR & SUMMARY) */}
        {aiDrawerOpen && (
          <aside className="w-80 sm:w-96 manila-paper border-l-2 border-[#2A2018] dark:border-[#9E1B16] p-4 flex flex-col z-40 hard-shadow-lg shrink-0">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#2A2018] dark:border-[#9E1B16]">
              <h4 className="font-typewriter font-bold text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#9E1B16] dark:text-[#FF6B5B]" />
                {aiDrawerTitle}
              </h4>
              <PaperclipCloseBtn onClose={() => setAiDrawerOpen(false)} />
            </div>
            <div className="flex-1 overflow-y-auto pt-3 text-sm whitespace-pre-line leading-relaxed">
              {aiLoading ? (
                <div className="space-y-3 py-4">
                  <RevolverSpinner label="Đang giải mã & trích xuất văn bản AI..." />
                  <RedactedSkeleton />
                </div>
              ) : (
                aiDrawerContent
              )}
            </div>
            {!aiLoading && aiDrawerContent && (
              <div className="pt-3 border-t border-[#6E5332] flex justify-end">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(aiDrawerContent);
                    setStatusNotice('Đã sao chép kết quả AI vào Clipboard.');
                  }}
                  className="px-3 py-1.5 text-xs font-typewriter uppercase border border-[#2A2018] bg-[#F5EAD2] dark:bg-[#1E0505] hover:bg-[#DFC79C]"
                >
                  Sao chép nội dung
                </button>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
