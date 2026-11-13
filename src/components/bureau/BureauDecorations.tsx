import React, { useEffect, useState } from 'react';
import { playDateClick, playStampThud } from '@/src/utils/bureauAudio';
import type { VaultItemType } from '@/src/types/vault';
import { ITEM_TYPE_TYPOGRAPHY, SECTION_TYPOGRAPHY } from '@/src/utils/bureauTypography';

// #4, #57, #58, #60: Desk Background Stains, 19th-Century Map, Marginalia & God Rays
export function DeskBackgroundDecor() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* #57: Faint 19th-century city map grid watermark */}
      <svg
        viewBox="0 0 800 600"
        className="absolute inset-0 w-full h-full opacity-[0.06] dark:opacity-[0.05]"
        preserveAspectRatio="xMidYMid slice"
      >
        <g stroke="#EBDAB9" strokeWidth="1" fill="none">
          <path d="M0 120 Q 240 180, 420 110 T 800 160" strokeWidth="4" />
          <path d="M120 0 L 180 600 M320 0 L 290 600 M520 0 L 560 600 M680 0 L 640 600" />
          <path d="M0 240 L 800 220 M0 380 L 800 410 M0 500 L 800 480" />
          <circle cx="420" cy="280" r="95" strokeDasharray="5 4" />
          <circle cx="420" cy="280" r="165" strokeDasharray="3 6" />
        </g>
      </svg>

      {/* #4: Coffee Ring Stain & Ink Splatter in Desk Corners */}
      <svg
        viewBox="0 0 180 180"
        className="absolute -bottom-6 right-16 w-44 h-44 opacity-20 dark:opacity-10"
      >
        <circle
          cx="90"
          cy="90"
          r="56"
          fill="none"
          stroke="#4A2B13"
          strokeWidth="6"
          strokeDasharray="140 12 45 8"
        />
        <circle cx="92" cy="92" r="51" fill="none" stroke="#361E0B" strokeWidth="2" />
      </svg>

      {/* #58: Handwritten Pencil Marginalia along outer desk margins (100% Vietnamese Patrick Hand & Mali) */}
      <div className="hidden xl:block absolute top-28 right-4 font-handwriting text-base text-[#D9C49E]/45 dark:text-[#FF8C7A]/30 -rotate-3 select-none">
        "Hỏi lại nhân chứng lúc 3 giờ sáng tại bến cảng..."
      </div>
      <div className="hidden xl:block absolute bottom-20 left-72 font-polaroid text-sm text-[#D9C49E]/40 dark:text-[#FF8C7A]/25 rotate-2 select-none">
        "Ai đã mở khóa phòng lưu trữ đêm 28/09?"
      </div>

      {/* #60: God Rays + Floating Dust Motes */}
      <div className="god-rays-beam absolute inset-0" />
      <div className="dust-mote absolute top-1/4 left-1/3 w-1 h-1 rounded-full bg-[#FFE9B8]/40" />
      <div
        className="dust-mote absolute top-1/2 left-2/3 w-1.5 h-1.5 rounded-full bg-[#FFE9B8]/30"
        style={{ animationDelay: '2.2s' }}
      />
      <div
        className="dust-mote absolute top-1/3 left-1/2 w-1 h-1 rounded-full bg-[#FFE9B8]/35"
        style={{ animationDelay: '4.1s' }}
      />

      {/* #27: Desk Lamp Vignette & #3: Film Grain */}
      <div className="desk-lamp-vignette absolute inset-0" />
      <div className="film-grain-overlay absolute inset-0" />
    </div>
  );
}

// #59: Real-Time Brass Pocket Watch
export function BureauPocketWatch() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const secs = now.getSeconds();
  const mins = now.getMinutes();
  const hrs = now.getHours() % 12;
  const secDeg = secs * 6;
  const minDeg = mins * 6 + secs * 0.1;
  const hrDeg = hrs * 30 + mins * 0.5;

  return (
    <div
      className="flex items-center gap-2 px-2 py-1 border border-[#7A5E35] bg-[#1F160E] text-[#EBDAB9] dark:border-[#8C201B] dark:bg-[#240606]"
      title="Đồng hồ quả quýt Cục Lưu Trữ"
    >
      <svg viewBox="0 0 40 40" className="w-6 h-6 shrink-0">
        <circle cx="20" cy="21" r="15" fill="#F5EAD2" stroke="#C69C4B" strokeWidth="3" />
        <rect x="17" y="2" width="6" height="4" rx="1" fill="#C69C4B" />
        <line
          x1="20"
          y1="21"
          x2={20 + 7 * Math.sin((hrDeg * Math.PI) / 180)}
          y2={21 - 7 * Math.cos((hrDeg * Math.PI) / 180)}
          stroke="#1B1510"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="20"
          y1="21"
          x2={20 + 10 * Math.sin((minDeg * Math.PI) / 180)}
          y2={21 - 10 * Math.cos((minDeg * Math.PI) / 180)}
          stroke="#1B1510"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <line
          x1="20"
          y1="21"
          x2={20 + 11 * Math.sin((secDeg * Math.PI) / 180)}
          y2={21 - 11 * Math.cos((secDeg * Math.PI) / 180)}
          stroke="#9E1B16"
          strokeWidth="1"
        />
        <circle cx="20" cy="21" r="1.5" fill="#9E1B16" />
      </svg>
      <span className="font-cipher text-[11px] tracking-wider hidden sm:inline">
        {now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    </div>
  );
}

// #18: Spinning Revolver Cylinder Loading Spinner
export function RevolverSpinner({ label = 'Đang xử lý hồ sơ...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 py-4">
      <svg viewBox="0 0 64 64" className="w-10 h-10 animate-spin text-[#9E1B16] dark:text-[#FF6B5B]">
        <circle cx="32" cy="32" r="26" fill="#2A2018" stroke="#C69C4B" strokeWidth="3" />
        {[0, 60, 120, 180, 240, 300].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <circle
              key={deg}
              cx={32 + Math.cos(rad) * 14}
              cy={32 + Math.sin(rad) * 14}
              r="5"
              fill={deg === 0 ? '#9E1B16' : '#EBDAB9'}
              stroke="#14100C"
              strokeWidth="1.2"
            />
          );
        })}
        <circle cx="32" cy="32" r="4" fill="#C69C4B" />
      </svg>
      <span className="font-typewriter text-xs tracking-wide">{label}</span>
    </div>
  );
}

// #45: Pulsing Redacted Skeleton Loading
export function RedactedSkeleton() {
  return (
    <div className="space-y-2.5 py-2 animate-pulse">
      <div className="h-3.5 w-3/4 bg-[#14100C]/85 dark:bg-[#FF6B5B]/30" />
      <div className="h-3.5 w-full bg-[#14100C]/75 dark:bg-[#FF6B5B]/25" />
      <div className="h-3.5 w-5/6 bg-[#14100C]/80 dark:bg-[#FF6B5B]/25" />
      <div className="h-3.5 w-2/3 bg-[#14100C]/70 dark:bg-[#FF6B5B]/20" />
    </div>
  );
}

// #31: Hand-Drawn Ink Checkbox
export function InkCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="inline-flex items-center gap-2 text-left group"
    >
      <span className="relative w-5 h-5 flex items-center justify-center border-2 border-[#2A2018] dark:border-[#FF8C7A] bg-[#F5EAD2] dark:bg-[#240606] -rotate-2">
        {checked && (
          <svg viewBox="0 0 20 20" className="w-4 h-4 text-[#9E1B16] dark:text-[#FF6B5B]">
            <path
              d="M3 4 L17 16 M16 3 L4 17"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </svg>
        )}
      </span>
      {label && <span className="font-handwriting text-base">{label}</span>}
    </button>
  );
}

// #25: Classic Baggage Tag with Twine String (Uses Oswald Vietnamese Stamp Font)
export function BaggageTag({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#DFC79C] dark:bg-[#3D0D0D] border border-[#6E5332] dark:border-[#B8322C] text-[10px] font-stamp uppercase tracking-wider text-[#261B12] dark:text-[#FFD6CE] shadow-[1px_2px_0px_rgba(20,12,6,0.35)]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#2B1D13] dark:bg-[#1A0404] border border-[#8E6C42]" />
      {text}
    </span>
  );
}

// #26: 20th-Century Metal Toggle Switch
export function MetalToggleSwitch({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      className="inline-flex items-center gap-2 px-2.5 py-1 border border-[#6E5332] bg-[#C9B38C] dark:bg-[#3A0C0C] text-[11px] font-surveillance font-semibold uppercase"
    >
      <span className="relative w-8 h-4 bg-[#2A2018] border border-[#8E6C42] flex items-center px-0.5">
        <span
          className={`w-3.5 h-3 bg-gradient-to-b from-[#E3C27A] to-[#8C6426] border border-[#14100C] transition-transform ${
            checked ? 'translate-x-3.5' : 'translate-x-0'
          }`}
        />
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// #16: Paperclip Close Button (slides out on click)
export function PaperclipCloseBtn({ onClose }: { onClose: () => void }) {
  const [sliding, setSliding] = useState(false);

  const handleClick = () => {
    setSliding(true);
    setTimeout(() => {
      onClose();
    }, 180);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Tháo kẹp ghim & Đóng"
      className={`p-1.5 transition-transform duration-200 hover:scale-110 ${
        sliding ? 'translate-x-4 -translate-y-4 rotate-12 opacity-0' : ''
      }`}
    >
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#3A2E23] dark:text-[#FFD6CE]" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
      </svg>
    </button>
  );
}

// #14: Rubber Stamp Save/Action Button (Uses dedicated Oswald Vietnamese Stamp Font)
export function RubberStampButton({
  onClick,
  children,
  stampWord = 'ĐÃ ĐÓNG DẤU',
  disabled = false,
  type = 'button',
}: {
  onClick?: () => void;
  children: React.ReactNode;
  stampWord?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const [stamped, setStamped] = useState(false);

  const handlePress = () => {
    playStampThud();
    setStamped(true);
    setTimeout(() => setStamped(false), 1100);
    onClick?.();
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={type === 'button' ? handlePress : undefined}
      className="relative px-4 py-2 border-2 border-[#2A2018] bg-[#9E1B16] hover:bg-[#C81E1E] text-[#F5EAD2] font-stamp font-bold text-xs uppercase tracking-wider hard-shadow transition-transform active:translate-y-0.5 active:scale-95 disabled:opacity-50"
    >
      {stamped ? `[${stampWord}]` : children}
    </button>
  );
}

// #34: Rolling Date Stamp Picker
export function RollingDateStamp({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1 border-2 border-[#2A2018] dark:border-[#9E1B16] bg-[#EBDAB9] dark:bg-[#2B0909]">
      <span className="font-stamp text-[11px] uppercase text-[#9E1B16] dark:text-[#FF6B5B]">
        NGÀY ĐÓNG MỘC:
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => {
          playDateClick();
          onChange(e.target.value);
        }}
        className="bg-transparent font-cipher text-xs focus:outline-none"
      />
    </div>
  );
}

// #15: Custom Detective Evidence Illustrations
export function EvidenceThumbnailIcon({ type }: { type: VaultItemType }) {
  if (type === 'video' || type === 'audio') {
    return (
      <svg viewBox="0 0 36 24" className="w-7 h-5 shrink-0">
        <rect x="1" y="2" width="34" height="20" rx="2" fill="#2A2018" stroke="#C69C4B" strokeWidth="1.5" />
        <circle cx="11" cy="12" r="3.5" fill="#EBDAB9" />
        <circle cx="25" cy="12" r="3.5" fill="#EBDAB9" />
        <rect x="13" y="16" width="10" height="3" fill="#9E1B16" />
      </svg>
    );
  }
  if (type === 'image') {
    return (
      <svg viewBox="0 0 28 32" className="w-5 h-6 shrink-0">
        <rect x="2" y="2" width="24" height="28" fill="#F7F0DE" stroke="#2A2018" strokeWidth="1.5" />
        <rect x="5" y="5" width="18" height="16" fill="#463526" />
        <circle cx="14" cy="11" r="3" fill="#C69C4B" />
      </svg>
    );
  }
  if (type === 'model_3d' || type === 'office_doc') {
    return (
      <svg viewBox="0 0 28 32" className="w-5 h-6 shrink-0">
        <path d="M4 7 H24 L26 30 H2 Z" fill="rgba(235, 218, 185, 0.55)" stroke="#9E1B16" strokeWidth="1.5" />
        <line x1="3" y1="7" x2="25" y2="7" stroke="#9E1B16" strokeWidth="2.5" />
        <text x="14" y="21" textAnchor="middle" fontSize="6" fill="#9E1B16" fontFamily="monospace">EVID</text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 26" className="w-6 h-5 shrink-0">
      <path d="M2 5 H12 L15 8 H30 V24 H2 Z" fill="#D4B886" stroke="#2A2018" strokeWidth="1.5" />
      <rect x="8" y="13" width="16" height="4" fill="#9E1B16" />
    </svg>
  );
}

// #24: Empty State (Full Ashtray, Empty Coffee Mug, Crumpled White Paper)
export function EmptyAshtrayState({ onAction }: { onAction: () => void }) {
  return (
    <div className="p-10 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] text-center space-y-4">
      <svg viewBox="0 0 260 110" className="w-60 h-28 mx-auto">
        <polygon
          points="28,74 44,48 72,56 82,78 58,92 34,88"
          fill="#F5EAD2"
          stroke="#2A2018"
          strokeWidth="1.8"
        />
        <path d="M44 48 L56 70 L72 56 M56 70 L58 92" stroke="#8C7659" strokeWidth="1.2" fill="none" />
        <ellipse cx="132" cy="78" rx="22" ry="9" fill="#3A281A" stroke="#1A120B" strokeWidth="1.8" />
        <path d="M110 52 V78 A22 9 0 0 0 154 78 V52" fill="#EBDAB9" stroke="#2A2018" strokeWidth="1.8" />
        <ellipse cx="132" cy="52" rx="22" ry="8" fill="#5A3E28" stroke="#2A2018" strokeWidth="1.8" />
        <path d="M154 58 C166 58, 166 74, 154 74" fill="none" stroke="#2A2018" strokeWidth="2.5" />
        <ellipse cx="206" cy="76" rx="28" ry="11" fill="#7D7368" stroke="#1A120B" strokeWidth="1.8" />
        <ellipse cx="206" cy="74" rx="20" ry="7" fill="#3D3630" />
        <line x1="194" y1="73" x2="216" y2="66" stroke="#F5EAD2" strokeWidth="4" />
        <line x1="216" y1="66" x2="220" y2="65" stroke="#9E1B16" strokeWidth="4" />
      </svg>
      <div className="space-y-1">
        <h3 className="font-dossier text-lg font-bold">NGĂN HỒ SƠ ĐANG TRỐNG</h3>
        <p className="font-handwriting text-xl text-[#574A3D] dark:text-[#FF9E8E]">
          "Chưa có vật chứng nào trong ngăn này... Chỉ còn tàn thuốc và ly cà phê cạn."
        </p>
      </div>
      <RubberStampButton onClick={onAction} stampWord="ĐÃ MỞ NGĂN">
        + Nạp Chứng Cứ Mới
      </RubberStampButton>
    </div>
  );
}

// Bảng Quy Chuẩn 12 Bộ Chữ Tiếng Việt Theo Từng Phần & Từng Mục
export function VietnameseTypographyModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#120C08]/80 flex items-center justify-center p-4">
      <div className="smoke-overlay fixed inset-0" />
      <div className="relative w-full max-w-4xl max-h-[85vh] flex flex-col manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] hard-shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b-2 border-[#2A2018] dark:border-[#9E1B16] bg-[#DFC79C] dark:bg-[#3A0C0C]">
          <div>
            <h3 className="font-dossier font-bold text-base sm:text-lg">
              BẢNG QUY CHUẨN 12 PHÔNG CHỮ TIẾNG VIỆT CỤC LƯU TRỮ
            </h3>
            <p className="font-typewriter text-[11px] text-[#574A3D] dark:text-[#FF9E8E]">
              Thiết kế riêng cho từng phân khu & từng định dạng vật chứng — Hỗ trợ 100% dấu Tiếng Việt
            </p>
          </div>
          <PaperclipCloseBtn onClose={onClose} />
        </div>

        <div className="p-5 overflow-y-auto space-y-6">
          {/* 1. Theo Phân Khu Chức Năng */}
          <div className="space-y-3">
            <h4 className="font-stamp text-sm text-[#9E1B16] dark:text-[#FF6B5B]">
              I. PHÔNG CHỮ RIÊNG THEO TỪNG PHÂN KHU (SECTIONS)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(SECTION_TYPOGRAPHY).map(([secKey, cfg]) => (
                <div
                  key={secKey}
                  className="p-3 border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-stamp text-[10px] text-[#9E1B16] dark:text-[#FF6B5B]">
                      KHU VỰC: {secKey.toUpperCase()}
                    </span>
                    <span className="font-mono-tabular text-[10px] opacity-75">
                      {cfg.fontNameLabel}
                    </span>
                  </div>
                  <div className={`${cfg.headerFontClass} text-base font-bold`}>
                    Hồ sơ điều tra đặc biệt tại Cục Lưu Trữ Việt Nam
                  </div>
                  <div className={`${cfg.subtitleFontClass} text-sm text-[#574A3D] dark:text-[#FF9E8E]`}>
                    {cfg.descVi} — Đầy đủ dấu: ă, â, đ, ê, ô, ơ, ư, ự, ể, ặ, ữ.
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="masking-tape-divider" />

          {/* 2. Theo Loại Vật Chứng / Mục Hồ Sơ */}
          <div className="space-y-3">
            <h4 className="font-stamp text-sm text-[#9E1B16] dark:text-[#FF6B5B]">
              II. PHÔNG CHỮ RIÊNG THEO TỪNG LOẠI MỤC HỒ SƠ (VAULT ITEM TYPES)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(ITEM_TYPE_TYPOGRAPHY).map(([typeKey, prof]) => (
                <div
                  key={typeKey}
                  className="p-3 border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-stamp text-[10px] px-1.5 py-0.5 bg-[#9E1B16] text-[#F5EAD2]">
                      {typeKey.toUpperCase()}
                    </span>
                    <span className={prof.metaClass}>{prof.badgeFontName}</span>
                  </div>
                  <div className={prof.titleClass}>
                    {prof.purposeVi}: Chuyên án số 029 — Tiếng Việt sắc nét
                  </div>
                  <p className={`${prof.bodyClass} text-[#574A3D] dark:text-[#FF9E8E]`}>
                    Mẫu thử dấu Tiếng Việt: "Lật mở từng trang chứng cứ mật, đối chiếu lời khai & mật mã."
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// #56: Top Secret Login Closed Folder Cover Gate
export function TopSecretLoginGate({ onUnlock }: { onUnlock: () => void }) {
  const [opening, setOpening] = useState(false);

  const handleOpen = () => {
    playStampThud();
    setOpening(true);
    setTimeout(() => {
      onUnlock();
    }, 460);
  };

  return (
    <div className="fixed inset-0 z-50 oak-desk-bg flex items-center justify-center p-4 overflow-hidden">
      <DeskBackgroundDecor />

      {/* Two Folder Wings that split open (#20, #56) */}
      <div className="relative w-full max-w-xl h-[440px] flex overflow-hidden border-2 border-[#2A2018] hard-shadow-lg">
        <div
          className={`w-1/2 h-full manila-paper border-r border-[#8C7659] p-6 flex flex-col justify-between ${
            opening ? 'wing-left-open' : ''
          }`}
        >
          <div className="font-cipher text-[11px] uppercase tracking-widest text-[#574A3D] dark:text-[#FF9E8E]">
            BIỂU MẪU SC-029 · LƯU TRỮ 1936
          </div>
          <div className="space-y-2">
            <span className="stamp-crimson text-sm font-bold">TUYỆT MẬT</span>
            <p className="font-handwriting text-2xl text-[#2A2018] dark:text-[#FFD6CE]">
              Chỉ dành cho Thanh tra được ủy quyền.
            </p>
            <p className="font-signature text-xl text-[#9E1B16] dark:text-[#FF6B5B]">
              Ký duyệt: Thanh tra Minh Nguyễn
            </p>
          </div>
          <div className="font-typewriter text-[10px] text-[#574A3D] dark:text-[#FF9E8E]">
            CỤC LƯU TRỮ & TÌNH BÁO HỒ SƠ
          </div>
        </div>

        <div
          className={`w-1/2 h-full manila-paper p-6 flex flex-col justify-between items-end text-right ${
            opening ? 'wing-right-open' : ''
          }`}
        >
          <div className="font-stamp text-xs uppercase text-[#9E1B16] dark:text-[#FF6B5B]">
            CHỈ XEM TẠI PHÒNG MẬT
          </div>
          <div className="space-y-4">
            <h1 className="font-dossier text-2xl sm:text-3xl font-extrabold leading-tight">
              HỒ SƠ MẬT AETHEL BUREAU
            </h1>
            <RubberStampButton onClick={handleOpen} stampWord="ĐÃ XÁC THỰC">
              MỞ BÌA HỒ SƠ
            </RubberStampButton>
          </div>
          <div className="font-cipher text-[10px] text-[#574A3D] dark:text-[#FF9E8E]">
            CẤP ĐỘ BẢO MẬT: CẤP IV
          </div>
        </div>

        {/* Center Red Wax Seal */}
        {!opening && (
          <button
            onClick={handleOpen}
            aria-label="Phá niêm phong hồ sơ"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-[#8E1B16] border-4 border-[#5C100C] text-[#F5EAD2] font-stamp text-[10px] tracking-widest uppercase shadow-[3px_5px_0px_rgba(14,9,5,0.6)] hover:scale-105 transition-transform flex items-center justify-center text-center leading-tight"
          >
            NIÊM PHONG
            <br />
            MẬT
          </button>
        )}
      </div>
    </div>
  );
}
