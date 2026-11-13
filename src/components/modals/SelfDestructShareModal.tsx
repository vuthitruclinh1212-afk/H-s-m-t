import React, { useState } from 'react';
import { Copy, ExternalLink, Flame, Link2 } from 'lucide-react';
import type { VaultItem } from '@/src/types/vault';
import { PaperclipCloseBtn, RubberStampButton } from '@/src/components/bureau/BureauDecorations';
import { playStampThud, playTypewriterDing } from '@/src/utils/bureauAudio';

interface SelfDestructShareModalProps {
  item: VaultItem | null;
  onClose: () => void;
}

export default function SelfDestructShareModal({ item, onClose }: SelfDestructShareModalProps) {
  const [maxDownloads, setMaxDownloads] = useState(1);
  const [ttlHours, setTtlHours] = useState(24);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [envelopeSealed, setEnvelopeSealed] = useState(false);

  if (!item) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTestResult(null);
    setEnvelopeSealed(false);
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          title: item.title,
          type: item.type,
          contentPreview: item.content || item.excerpt,
          maxDownloads,
          ttlHours,
        }),
      });
      const data = await res.json();
      setCreatedToken(data.token);
      setEnvelopeSealed(true);
      playStampThud();
    } finally {
      setLoading(false);
    }
  };

  const handleTestAccess = async () => {
    if (!createdToken) return;
    const res = await fetch(`/api/share/${createdToken}`);
    const data = await res.json();
    if (!res.ok) {
      playStampThud();
      setTestResult(`ĐÃ TIÊU HỦY: ${data.error}`);
    } else {
      playTypewriterDing();
      setTestResult(
        `Truy cập hợp lệ "${data.title}". Lượt xem còn lại trước khi tự hủy: ${data.remainingViews}.`
      );
    }
  };

  const shareUrl = createdToken ? `${window.location.origin}/api/share/${createdToken}` : '';

  return (
    <div className="fixed inset-0 z-50 bg-[#120C08]/80 flex items-center justify-center p-4">
      <div className="smoke-overlay fixed inset-0" />

      <div className="relative w-full max-w-md manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] hard-shadow-lg overflow-visible">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#9E1B16] border-2 border-[#F5EAD2] shadow-[2px_3px_0px_rgba(14,9,5,0.65)] z-20" />

        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#2A2018] dark:border-[#9E1B16] bg-[#DFC79C] dark:bg-[#3A0C0C]">
          <h3 className="font-typewriter font-bold text-sm flex items-center gap-2 uppercase">
            <Flame className="w-4 h-4 text-[#9E1B16]" />
            CẤP LIÊN KẾT MẬT TỰ HỦY
          </h3>
          <PaperclipCloseBtn onClose={onClose} />
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-[#574A3D] dark:text-[#FF9E8E]">
            Hồ sơ xuất mật: <strong>{item.title}</strong>
          </p>

          <form onSubmit={handleGenerate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-typewriter text-[10px] uppercase mb-1">
                  Giới hạn lượt mở
                </label>
                <select
                  value={maxDownloads}
                  onChange={(e) => setMaxDownloads(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505]"
                >
                  <option value={1}>1 lần xem (Burn after read)</option>
                  <option value={3}>3 lần xem / tải</option>
                  <option value={5}>5 lần xem / tải</option>
                </select>
              </div>
              <div>
                <label className="block font-typewriter text-[10px] uppercase mb-1">
                  Thời hạn tự hủy
                </label>
                <select
                  value={ttlHours}
                  onChange={(e) => setTtlHours(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505]"
                >
                  <option value={1}>Sau 1 giờ</option>
                  <option value={24}>Sau 24 giờ</option>
                  <option value={72}>Sau 3 ngày</option>
                </select>
              </div>
            </div>
            <div className="flex justify-center pt-1">
              <RubberStampButton type="submit" disabled={loading} stampWord="DISPATCHED">
                <span className="inline-flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />
                  {loading ? 'Đang niêm phong...' : 'Cho Vào Phong Bì & Niêm Sáp'}
                </span>
              </RubberStampButton>
            </div>
          </form>

          {/* #41: Kraft Envelope & Crimson Wax Seal Animation */}
          {createdToken && (
            <div className="relative p-4 bg-[#C49E65] dark:bg-[#3A0C0C] border-2 border-[#2A2018] hard-shadow space-y-3 transition-all">
              <div className="flex items-center justify-between">
                <span className="font-typewriter text-[11px] uppercase text-[#1A120B] dark:text-[#FFD6CE]">
                  PHONG BÌ NIÊM PHONG KRAFT
                </span>
                {/* Crimson Wax Seal */}
                <div
                  className={`w-9 h-9 rounded-full bg-[#9E1B16] border-2 border-[#5C100C] text-[#F5EAD2] font-typewriter text-[8px] flex items-center justify-center shadow-md transition-transform duration-300 ${
                    envelopeSealed ? 'scale-100' : 'scale-50'
                  }`}
                >
                  WAX
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-[#F5EAD2] dark:bg-[#1A0404] border border-[#6E5332]"
                />
                <button
                  onClick={() => navigator.clipboard?.writeText(shareUrl)}
                  className="p-1.5 bg-[#EBDAB9] dark:bg-[#240606] border border-[#6E5332] hover:opacity-80"
                  title="Sao chép link"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                onClick={handleTestAccess}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-[#2A2018] bg-[#F5EAD2] dark:bg-[#1E0505] text-xs font-typewriter uppercase hover:bg-[#DFC79C]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Mở niêm phong kiểm thử (đếm ngược tự hủy)
              </button>
              {testResult && (
                <p className="font-handwriting text-lg text-[#9E1B16] dark:text-[#FF8C7A] leading-snug">
                  {testResult}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
