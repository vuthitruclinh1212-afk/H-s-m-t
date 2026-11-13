import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
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
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { NormalizedPoint, PdfAnnotation } from '@/src/types/vault';
import { playPaperFlipSound } from '@/src/utils/paperSound';
import { base64ToUint8, exportAnnotatedPdf } from '@/src/utils/pdfFactory';
import {
  PaperclipCloseBtn,
  RedactedSkeleton,
  RevolverSpinner,
} from '@/src/components/bureau/BureauDecorations';

type ReaderMode = 'flipbook' | 'scroll';
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
  const [spreadIndex, setSpreadIndex] = useState<number>(0);
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev' | null>(null);
  const [pageImages, setPageImages] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [readerMode, setReaderMode] = useState<ReaderMode>('flipbook');
  const [toolMode, setToolMode] = useState<ToolMode>('pan');
  const [zoom, setZoom] = useState<number>(1.25);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  const [activeStroke, setActiveStroke] = useState<NormalizedPoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const [pendingPopover, setPendingPopover] = useState<{
    kind: 'sticky' | 'text';
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
        setSpreadIndex(startPage <= 1 ? 0 : Math.floor(startPage / 2));

        const rendered: Record<number, string> = {};
        const maxPreRender = Math.min(doc.numPages, 24);
        for (let i = 1; i <= maxPreRender; i++) {
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1.65 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          rendered[i] = canvas.toDataURL('image/webp', 0.92);
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
    if (readerMode !== 'scroll' || !pdfDoc || !vectorCanvasRef.current) return;
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

  const maxSpread = Math.floor(numPages / 2);
  const leftPageNum = spreadIndex === 0 ? null : spreadIndex * 2;
  const rightPageNum =
    spreadIndex === 0
      ? numPages >= 1
        ? 1
        : null
      : spreadIndex * 2 + 1 <= numPages
      ? spreadIndex * 2 + 1
      : null;

  const triggerFlip = (dir: 'next' | 'prev') => {
    if (readerMode === 'flipbook') {
      if (dir === 'next' && spreadIndex < maxSpread) {
        setFlipDirection('next');
        if (soundEnabled) playPaperFlipSound();
        setTimeout(() => {
          const nextSpread = spreadIndex + 1;
          setSpreadIndex(nextSpread);
          const targetPage = nextSpread * 2;
          setCurrentPage(targetPage);
          onPageProgress?.(targetPage, numPages);
          onGainExp?.(5, 'Lật đọc trang tài liệu');
          setFlipDirection(null);
        }, 260);
      } else if (dir === 'prev' && spreadIndex > 0) {
        setFlipDirection('prev');
        if (soundEnabled) playPaperFlipSound();
        setTimeout(() => {
          const prevSpread = spreadIndex - 1;
          setSpreadIndex(prevSpread);
          const targetPage = prevSpread === 0 ? 1 : prevSpread * 2;
          setCurrentPage(targetPage);
          onPageProgress?.(targetPage, numPages);
          setFlipDirection(null);
        }, 260);
      }
    } else {
      if (dir === 'next' && currentPage < numPages) {
        const nextP = currentPage + 1;
        setCurrentPage(nextP);
        onPageProgress?.(nextP, numPages);
        onGainExp?.(5, 'Đọc tiếp trang tài liệu');
        if (soundEnabled) playPaperFlipSound();
      } else if (dir === 'prev' && currentPage > 1) {
        const prevP = currentPage - 1;
        setCurrentPage(prevP);
        onPageProgress?.(prevP, numPages);
        if (soundEnabled) playPaperFlipSound();
      }
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
        body: JSON.stringify({ imageBase64: imgData, mimeType: 'image/webp', pageNumber: currentPage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi OCR');
      setAiDrawerContent(data.text || 'Không tìm thấy văn bản trên trang này.');
      onGainExp?.(15, 'Trích xuất OCR bằng AI');
    } catch (err) {
      setAiDrawerContent(err instanceof Error ? err.message : 'Không thể kết nối dịch vụ AI OCR.');
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
          content: chunks.join('\n\n') || `Tài liệu PDF ${title} gồm ${pdfDoc.numPages} trang.`,
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
      const blob = new Blob([modifiedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
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

  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (pendingPopover) return;
    if (toolMode === 'pan') {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
      return;
    }

    const pt = getNormalizedCoords(e);
    if (toolMode === 'sticky' || toolMode === 'text') {
      setPendingPopover({ kind: toolMode, x: pt.x, y: pt.y });
      setPopoverValue('');
      return;
    }

    if (toolMode === 'redact') {
      onUpdateAnnotations([
        ...annotations,
        {
          id: crypto.randomUUID(),
          page: currentPage,
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
    if (toolMode === 'pan' && isPanningRef.current) {
      setPanOffset({ x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y });
      return;
    }
    if (isDrawing) {
      setActiveStroke((prev) => [...prev, getNormalizedCoords(e)]);
    }
  };

  const handleOverlayMouseUp = () => {
    isPanningRef.current = false;
    if (isDrawing && activeStroke.length > 1) {
      const colorMap: Record<string, string> = {
        highlight: 'rgba(250, 204, 21, 0.5)',
        underline: '#9E1B16',
        draw: '#1A120B',
      };
      const kind = toolMode === 'highlight' ? 'highlight' : toolMode === 'underline' ? 'underline' : 'draw';
      onUpdateAnnotations([
        ...annotations,
        {
          id: crypto.randomUUID(),
          page: currentPage,
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
        page: currentPage,
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

  const currentPageAnnotations = annotations.filter((a) => a.page === currentPage);

  const renderFlipPageCard = (pageNumber: number | null, side: 'left' | 'right') => {
    if (!pageNumber) {
      return (
        <div className="w-[340px] sm:w-[400px] h-[480px] sm:h-[560px] bg-[#DFC79C]/40 dark:bg-[#240606]/50 border border-dashed border-[#6E5332] flex flex-col items-center justify-center font-typewriter text-[#574A3D] dark:text-[#FF9E8E] text-xs">
          <span>Bìa hồ sơ / Trang trống</span>
        </div>
      );
    }

    const img = pageImages[pageNumber];
    const pageAnns = annotations.filter((a) => a.page === pageNumber);

    return (
      <div
        onClick={() => triggerFlip(side === 'right' ? 'next' : 'prev')}
        title={side === 'right' ? 'Nhấn để lật sang trang sau' : 'Nhấn để lật về trang trước'}
        className={`relative w-[340px] sm:w-[400px] h-[480px] sm:h-[560px] bg-[#F7F1E3] overflow-hidden cursor-pointer select-none border border-[#2A2018] transition-transform duration-300 ${
          side === 'left'
            ? 'shadow-[-8px_12px_20px_rgba(14,9,5,0.4)]'
            : 'shadow-[8px_12px_20px_rgba(14,9,5,0.45)]'
        }`}
      >
        {img ? (
          <img
            src={img}
            alt={`Trang ${pageNumber}`}
            className="w-full h-full object-contain pointer-events-none"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-typewriter text-[#574A3D]">
            Đang kết xuất trang {pageNumber}...
          </div>
        )}

        {/* Spine shading */}
        <div
          className={`pointer-events-none absolute inset-y-0 w-7 ${
            side === 'left'
              ? 'right-0 bg-gradient-to-l from-[#1A120B]/20 to-transparent'
              : 'left-0 bg-gradient-to-r from-[#1A120B]/20 to-transparent'
          }`}
        />

        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
          {pageAnns
            .filter((a) => (a.kind === 'draw' || a.kind === 'highlight' || a.kind === 'underline') && a.points)
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
        </svg>

        {pageAnns
          .filter((a) => a.kind === 'sticky' || a.kind === 'text' || a.kind === 'redact')
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
                />
              );
            }
            return (
              <div
                key={item.id}
                style={{ left: `${(item.x ?? 0.5) * 100}%`, top: `${(item.y ?? 0.5) * 100}%` }}
                className={
                  item.kind === 'sticky'
                    ? 'absolute -translate-x-1/2 -translate-y-1/2 bg-[#F3DF98] text-[#1A120B] font-handwriting text-sm px-2 py-1 border border-[#8E762A] hard-shadow max-w-[140px]'
                    : 'absolute -translate-y-1/2 text-[#9E1B16] font-handwriting font-bold text-base bg-[#F7F1E3]/90 px-1'
                }
              >
                {item.content}
              </div>
            );
          })}

        {/* #12: Stamped Page Number at Bottom Corner */}
        <span className="font-typewriter absolute bottom-2 right-3 text-[11px] text-[#2A2018]/70 border border-[#2A2018]/40 px-1.5 py-0.5 bg-[#EBDAB9]/75 -rotate-2">
          No. {String(pageNumber).padStart(4, '0')}
        </span>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full min-h-[620px] w-full manila-paper border-2 border-[#2A2018] dark:border-[#9E1B16] overflow-hidden hard-shadow-lg"
    >
      {/* READER TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#DFC79C] dark:bg-[#3A0C0C] border-b-2 border-[#2A2018] dark:border-[#9E1B16]">
        <div className="flex items-center gap-1 p-1 bg-[#C9B38C] dark:bg-[#1E0505] border border-[#6E5332]">
          <button
            onClick={() => setReaderMode('flipbook')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-typewriter uppercase whitespace-nowrap shrink-0 transition-colors ${
              readerMode === 'flipbook'
                ? 'bg-[#9E1B16] text-[#F5EAD2]'
                : 'text-[#3A2E23] dark:text-[#FF9E8E]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Lật hồ sơ 3D
          </button>
          <button
            onClick={() => setReaderMode('scroll')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-typewriter uppercase whitespace-nowrap shrink-0 transition-colors ${
              readerMode === 'scroll'
                ? 'bg-[#9E1B16] text-[#F5EAD2]'
                : 'text-[#3A2E23] dark:text-[#FF9E8E]'
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" />
            Zoom & Chỉnh sửa
          </button>
        </div>

        {/* Page Nav & #33 Brass Zoom Slider */}
        <div className="flex items-center gap-1.5 bg-[#F5EAD2] dark:bg-[#1E0505] border border-[#6E5332] px-2 py-1">
          <button
            onClick={() => triggerFlip('prev')}
            className="p-1.5 hover:bg-[#DFC79C] dark:hover:bg-[#3A0C0C] transition-colors"
            title="Trang trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-typewriter text-xs px-2 whitespace-nowrap">
            No. {currentPage}/{numPages || '--'}
          </span>
          <button
            onClick={() => triggerFlip('next')}
            className="p-1.5 hover:bg-[#DFC79C] dark:hover:bg-[#3A0C0C] transition-colors"
            title="Trang sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {readerMode === 'scroll' && (
            <>
              <div className="w-px h-4 bg-[#6E5332]/50 mx-1" />
              <button
                onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(2)))}
                className="p-1 hover:bg-[#DFC79C] dark:hover:bg-[#3A0C0C]"
                title="Thu nhỏ"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <input
                type="range"
                min={0.6}
                max={2.8}
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
                onClick={() => setZoom((z) => Math.min(2.8, +(z + 0.2).toFixed(2)))}
                className="p-1 hover:bg-[#DFC79C] dark:hover:bg-[#3A0C0C]"
                title="Phóng to không vỡ nét"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Annotation & Live Edit Tools */}
        <div className="flex items-center gap-1 bg-[#F5EAD2] dark:bg-[#1E0505] border border-[#6E5332] px-1.5 py-1">
          {(
            [
              { id: 'pan', icon: MousePointer, label: 'Kéo khung nhìn (Pan)' },
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
                onClick={() => {
                  setToolMode(tool.id);
                  if (tool.id !== 'pan' && readerMode === 'flipbook') {
                    setReaderMode('scroll');
                  }
                }}
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
            onClick={() => onUpdateAnnotations(annotations.filter((a) => a.page !== currentPage))}
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
              {isSpeaking ? <Square className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
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
            onClick={() => setSoundEnabled((s) => !s)}
            className="p-1.5 border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] hover:bg-[#DFC79C] dark:hover:bg-[#3A0C0C]"
            title={soundEnabled ? 'Tắt âm thanh lật giấy' : 'Bật âm thanh lật giấy'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[#9E1B16] dark:text-[#FF6B5B]" />
            ) : (
              <VolumeX className="w-4 h-4 text-[#6E5332]" />
            )}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] hover:bg-[#DFC79C] dark:hover:bg-[#3A0C0C]"
            title="Toàn màn hình"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* #44: Torn Masking-Tape Status Notice */}
      {statusNotice && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#F3DF98] border-b border-dashed border-[#8E762A] text-xs font-handwriting text-lg text-[#1A120B]">
          <span>📌 {statusNotice}</span>
          <button onClick={() => setStatusNotice(null)} className="p-0.5 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* VIEWPORT */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden corkboard-surface p-4">
        {isLoading && (
          <div className="p-6 manila-paper torn-paper-card border-2 border-[#2A2018]">
            <RevolverSpinner label="Đang dựng trang hồ sơ Vector & 3D Flipbook..." />
          </div>
        )}

        {errorMsg && (
          <div className="px-4 py-3 manila-paper border-2 border-[#9E1B16] text-[#9E1B16] font-typewriter text-sm">
            {errorMsg}
          </div>
        )}

        {!isLoading && !errorMsg && readerMode === 'flipbook' && numPages > 0 && (
          <div className="flipbook-stage flex flex-col items-center gap-4">
            <div
              className={`relative flex items-center justify-center transition-transform duration-300 ${
                flipDirection === 'next'
                  ? '-rotate-y-3 scale-[0.99]'
                  : flipDirection === 'prev'
                  ? 'rotate-y-3 scale-[0.99]'
                  : ''
              }`}
            >
              {renderFlipPageCard(leftPageNum, 'left')}
              {renderFlipPageCard(rightPageNum, 'right')}
            </div>
            <p className="px-3 py-1 bg-[#F3DF98] border border-dashed border-[#8E762A] text-xs font-typewriter text-[#1A120B] -rotate-1">
              Nhấp trang trái/phải để lật hồ sơ 3D · Âm thanh giấy: {soundEnabled ? 'BẬT' : 'TẮT'}
            </p>
          </div>
        )}

        {!isLoading && !errorMsg && readerMode === 'scroll' && (
          <div
            className="w-full h-full overflow-auto flex items-center justify-center p-6"
            style={{ cursor: toolMode === 'pan' ? 'grab' : 'crosshair' }}
          >
            <div
              className="relative bg-[#F7F1E3] hard-shadow-lg border-2 border-[#2A2018]"
              style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px)` }}
              onMouseDown={handleOverlayMouseDown}
              onMouseMove={handleOverlayMouseMove}
              onMouseUp={handleOverlayMouseUp}
            >
              <canvas ref={vectorCanvasRef} className="block" />

              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full pointer-events-none"
              >
                {currentPageAnnotations
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

                {isDrawing && activeStroke.length > 1 && (
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

              {currentPageAnnotations
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
              <span className="font-typewriter absolute bottom-2 right-3 text-[11px] text-[#2A2018]/75 border border-[#2A2018]/45 px-1.5 py-0.5 bg-[#EBDAB9]/80 -rotate-2 pointer-events-none">
                No. {String(currentPage).padStart(4, '0')}
              </span>

              {pendingPopover && (
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
            </div>
          </div>
        )}

        {/* AI DRAWER (OCR & SUMMARY) */}
        {aiDrawerOpen && (
          <aside className="absolute right-0 top-0 bottom-0 w-80 sm:w-96 manila-paper border-l-2 border-[#2A2018] dark:border-[#9E1B16] p-4 flex flex-col z-40 hard-shadow-lg">
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
