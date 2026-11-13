import React, { useState } from 'react';
import { Layers, Scissors } from 'lucide-react';
import type { VaultItem } from '@/src/types/vault';
import { base64ToUint8, mergePdfBase64List, splitPdfByRange } from '@/src/utils/pdfFactory';
import {
  InkCheckbox,
  PaperclipCloseBtn,
  RubberStampButton,
} from '@/src/components/bureau/BureauDecorations';

interface PdfSplitMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePdf: VaultItem;
  allPdfs: VaultItem[];
  onSaveNewPdf: (title: string, base64: string, pageCount: number) => void;
}

export default function PdfSplitMergeModal({
  isOpen,
  onClose,
  activePdf,
  allPdfs,
  onSaveNewPdf,
}: PdfSplitMergeModalProps) {
  const [tab, setTab] = useState<'split' | 'merge'>('split');
  const [fromPage, setFromPage] = useState<number>(1);
  const [toPage, setToPage] = useState<number>(Math.max(1, activePdf.pageCount ?? 2));
  const [selectedIds, setSelectedIds] = useState<string[]>([activePdf.id]);
  const [outputTitle, setOutputTitle] = useState<string>(`${activePdf.title} (Tách trang)`);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const triggerDownload = (b64: string, fileName: string) => {
    const bytes = base64ToUint8(b64);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace(/[^a-zA-Z0-9_-]+/g, '_')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExecute = async (downloadToo: boolean) => {
    setError(null);
    setProcessing(true);
    try {
      if (tab === 'split') {
        if (!activePdf.pdfDataBase64) throw new Error('Tệp PDF chưa sẵn sàng để tách.');
        const res = await splitPdfByRange(activePdf.pdfDataBase64, fromPage, toPage);
        onSaveNewPdf(outputTitle || `${activePdf.title} (Tách)`, res.base64, res.pageCount);
        if (downloadToo) triggerDownload(res.base64, outputTitle || 'split_document');
      } else {
        const list = allPdfs
          .filter((p) => selectedIds.includes(p.id) && p.pdfDataBase64)
          .map((p) => p.pdfDataBase64!);
        if (list.length < 2) throw new Error('Vui lòng chọn ít nhất 2 tệp PDF để gộp.');
        const res = await mergePdfBase64List(list);
        const title = outputTitle.includes('Tách') ? 'Hồ Sơ Gộp Tổng Hợp' : outputTitle;
        onSaveNewPdf(title, res.base64, res.pageCount);
        if (downloadToo) triggerDownload(res.base64, title);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi xử lý PDF.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#120C08]/80 flex items-center justify-center p-4">
      <div className="smoke-overlay fixed inset-0" />

      <div className="relative w-full max-w-lg manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] hard-shadow-lg overflow-visible">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#9E1B16] border-2 border-[#F5EAD2] shadow-[2px_3px_0px_rgba(14,9,5,0.65)] z-20" />

        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#2A2018] dark:border-[#9E1B16] bg-[#DFC79C] dark:bg-[#3A0C0C]">
          <h3 className="font-typewriter font-bold text-base uppercase">
            Tách & Gộp Hồ Sơ PDF (Split & Merge)
          </h3>
          <PaperclipCloseBtn onClose={onClose} />
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                setTab('split');
                setOutputTitle(`${activePdf.title} (Trang ${fromPage}-${toPage})`);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 border text-xs font-typewriter uppercase transition-colors ${
                tab === 'split'
                  ? 'bg-[#9E1B16] text-[#F5EAD2] border-[#2A2018]'
                  : 'bg-[#F5EAD2] dark:bg-[#1E0505] border-[#6E5332] text-[#3A2E23] dark:text-[#FF9E8E]'
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              Cắt trang PDF
            </button>
            <button
              onClick={() => {
                setTab('merge');
                setOutputTitle('Hồ Sơ PDF Gộp Tổng Hợp');
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 border text-xs font-typewriter uppercase transition-colors ${
                tab === 'merge'
                  ? 'bg-[#9E1B16] text-[#F5EAD2] border-[#2A2018]'
                  : 'bg-[#F5EAD2] dark:bg-[#1E0505] border-[#6E5332] text-[#3A2E23] dark:text-[#FF9E8E]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Gộp nhiều PDF
            </button>
          </div>

          {tab === 'split' ? (
            <div className="space-y-3">
              <p className="text-xs text-[#574A3D] dark:text-[#FF9E8E]">
                Hồ sơ nguồn: <strong>{activePdf.title}</strong> ({activePdf.pageCount ?? 1} trang)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-typewriter uppercase mb-1">Từ trang</label>
                  <input
                    type="number"
                    min={1}
                    max={activePdf.pageCount ?? 999}
                    value={fromPage}
                    onChange={(e) => setFromPage(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-typewriter uppercase mb-1">Đến trang</label>
                  <input
                    type="number"
                    min={fromPage}
                    max={activePdf.pageCount ?? 999}
                    value={toPage}
                    onChange={(e) => setToPage(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] font-mono-tabular"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              <p className="text-xs text-[#574A3D] dark:text-[#FF9E8E]">
                Chọn các hồ sơ PDF cần gộp thành một tập duy nhất:
              </p>
              {allPdfs.map((pdf) => (
                <div
                  key={pdf.id}
                  onClick={() => toggleSelect(pdf.id)}
                  className="flex items-center justify-between px-3 py-2 border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <InkCheckbox
                      checked={selectedIds.includes(pdf.id)}
                      onChange={() => toggleSelect(pdf.id)}
                    />
                    <span className="text-xs font-medium truncate">{pdf.title}</span>
                  </div>
                  <span className="font-mono-tabular text-[11px] text-[#574A3D] dark:text-[#FF9E8E] shrink-0 ml-2">
                    {pdf.pageCount ?? '?'} trang
                  </span>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-xs font-typewriter uppercase mb-1">Tên hồ sơ đầu ra</label>
            <input
              type="text"
              value={outputTitle}
              onChange={(e) => setOutputTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505]"
            />
          </div>

          {error && <p className="text-xs text-[#9E1B16] dark:text-[#FF6B5B]">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-[#DFC79C] dark:bg-[#3A0C0C] border-t-2 border-[#2A2018] dark:border-[#9E1B16]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-typewriter uppercase text-[#3A2E23] dark:text-[#FFD6CE] hover:underline"
          >
            Hủy
          </button>
          <button
            disabled={processing}
            onClick={() => handleExecute(false)}
            className="px-4 py-2 text-xs font-typewriter uppercase border border-[#2A2018] bg-[#F5EAD2] dark:bg-[#1E0505] hover:bg-[#DFC79C]"
          >
            Lưu vào Kho
          </button>
          <RubberStampButton
            disabled={processing}
            onClick={() => handleExecute(true)}
            stampWord="PROCESSED"
          >
            {processing ? 'Đang xử lý...' : 'Lưu & Tải PDF'}
          </RubberStampButton>
        </div>
      </div>
    </div>
  );
}
