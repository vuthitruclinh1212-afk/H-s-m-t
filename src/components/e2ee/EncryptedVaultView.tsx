import React, { useState } from 'react';
import { Eye, KeyRound, Lock, Plus, RotateCw, ShieldCheck, Unlock } from 'lucide-react';
import { decryptVaultText, encryptVaultText } from '@/src/utils/e2eeCrypto';
import { RubberStampButton } from '@/src/components/bureau/BureauDecorations';
import { playDateClick, playStampThud, playTypewriterDing } from '@/src/utils/bureauAudio';

interface SecretEntry {
  id: string;
  title: string;
  createdAt: string;
  iv: string;
  salt: string;
  ciphertext: string;
}

interface EncryptedVaultViewProps {
  onGainExp?: (amount: number, reason: string) => void;
}

export default function EncryptedVaultView({ onGainExp }: EncryptedVaultViewProps) {
  const [passphrase, setPassphrase] = useState('');
  const [dialValue, setDialValue] = useState(0);
  const [unlockedKey, setUnlockedKey] = useState<string | null>(null);
  const [secrets, setSecrets] = useState<SecretEntry[]>([]);
  const [decryptedMap, setDecryptedMap] = useState<Record<string, string>>({});
  const [showCipherMap, setShowCipherMap] = useState<Record<string, boolean>>({});

  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // #35: Safe Combination Dial rotation appends digits or adjusts dial
  const rotateDial = (delta: number) => {
    playDateClick();
    setDialValue((prev) => (prev + delta + 10) % 10);
  };

  const lockDialDigit = () => {
    playStampThud();
    setPassphrase((prev) => `${prev}${dialValue}`);
  };

  const handleUnlockOrInit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (passphrase.trim().length < 4) {
      playStampThud();
      setError('DENIED: Vui lòng nhập hoặc xoay mã số két ít nhất 4 ký tự.');
      return;
    }

    setBusy(true);
    try {
      const nextDecrypted: Record<string, string> = {};
      for (const s of secrets) {
        nextDecrypted[s.id] = await decryptVaultText(
          { iv: s.iv, salt: s.salt, ciphertext: s.ciphertext },
          passphrase
        );
      }
      setDecryptedMap(nextDecrypted);
      setUnlockedKey(passphrase);
      playTypewriterDing();
    } catch {
      playStampThud();
      setError('DENIED: Mật khẩu giải mã không khớp với niêm phong hiện tại.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockedKey || !newTitle.trim() || !newContent.trim()) return;
    setBusy(true);
    try {
      const encrypted = await encryptVaultText(newContent.trim(), unlockedKey);
      const id = crypto.randomUUID();
      const entry: SecretEntry = {
        id,
        title: newTitle.trim(),
        createdAt: new Date().toISOString(),
        ...encrypted,
      };
      setSecrets((prev) => [entry, ...prev]);
      setDecryptedMap((prev) => ({ ...prev, [id]: newContent.trim() }));
      setNewTitle('');
      setNewContent('');
      playTypewriterDing();
      onGainExp?.(25, 'Niêm phong tài liệu vào Két E2EE');
    } finally {
      setBusy(false);
    }
  };

  const handleLock = () => {
    playStampThud();
    setUnlockedKey(null);
    setPassphrase('');
    setDecryptedMap({});
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="p-6 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="font-cipher text-[10px] uppercase tracking-widest text-[#9E1B16] dark:text-[#FF6B5B]">
            FONT MẬT MÃ HỌC: JETBRAINS MONO VN · KÉT SẮT E2EE
          </div>
          <h2 className="font-cipher text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#9E1B16] dark:text-[#FF6B5B]" />
            KÉT SẮT TỐI MẬT — MÃ HÓA ĐẦU CUỐI (AES-256-GCM)
          </h2>
          <p className="font-surveillance text-xs text-[#574A3D] dark:text-[#FF9E8E]">
            Hồ sơ tối mật được mã hóa trực tiếp trên máy trạm bằng Web Crypto API. Quản trị viên máy chủ chỉ thấy chuỗi mật mã.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="stamp-crimson text-[10px]">
            {unlockedKey ? 'ĐÃ MỞ NIÊM PHONG' : 'ĐANG KHÓA KÉT'}
          </span>
          {unlockedKey && (
            <button
              onClick={handleLock}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#2A2018] dark:bg-[#9E1B16] text-[#F5EAD2] text-xs font-cipher uppercase hard-shadow"
            >
              <Lock className="w-3.5 h-3.5" />
              Niêm Phong Ngay
            </button>
          )}
        </div>
      </div>

      {!unlockedKey ? (
        <form
          onSubmit={handleUnlockOrInit}
          className="p-8 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] max-w-lg mx-auto space-y-5 hard-shadow-lg"
        >
          <div className="text-center space-y-1">
            <h3 className="font-cipher text-lg font-bold">
              {secrets.length === 0 ? 'THIẾT LẬP KHÓA KÉT SẮT' : 'XOAY MÃ SỐ MỞ KÉT TÌNH BÁO'}
            </h3>
            <p className="font-surveillance text-xs text-[#574A3D] dark:text-[#FF9E8E]">
              {secrets.length === 0
                ? 'Xoay núm vặn đồng hoặc nhập mật mã chính dẫn xuất khóa AES-256-GCM (PBKDF2 120.000 vòng).'
                : `Đang bảo vệ ${secrets.length} hồ sơ tối mật.`}
            </p>
          </div>

          {/* #35: Safe Combination Rotating Dial */}
          <div className="p-4 bg-[#221912] dark:bg-[#190404] border-2 border-[#6E5332] flex flex-col items-center gap-3">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg
                viewBox="0 0 120 120"
                className="w-full h-full transition-transform duration-200"
                style={{ transform: `rotate(${dialValue * 36}deg)` }}
              >
                <circle cx="60" cy="60" r="54" fill="#2E241C" stroke="#C69C4B" strokeWidth="4" />
                <circle cx="60" cy="60" r="40" fill="#1A130E" stroke="#8C6426" strokeWidth="2" />
                {Array.from({ length: 10 }).map((_, n) => {
                  const angle = (n * 36 - 90) * (Math.PI / 180);
                  const tx = 60 + Math.cos(angle) * 46;
                  const ty = 60 + Math.sin(angle) * 46;
                  return (
                    <text
                      key={n}
                      x={tx}
                      y={ty + 3}
                      textAnchor="middle"
                      fontSize="8"
                      fill="#EBDAB9"
                      fontFamily="monospace"
                    >
                      {n}
                    </text>
                  );
                })}
                <line x1="60" y1="22" x2="60" y2="34" stroke="#9E1B16" strokeWidth="3" />
              </svg>
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent border-t-[#9E1B16]" />
              <div className="absolute font-cipher text-xl font-bold text-[#F5EAD2]">
                {dialValue}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => rotateDial(-1)}
                className="px-3 py-1 bg-[#3A2E23] text-[#EBDAB9] border border-[#8C6426] text-xs font-cipher hover:bg-[#4D3D2E]"
              >
                ◄ Xoay Trái
              </button>
              <button
                type="button"
                onClick={lockDialDigit}
                className="px-3 py-1 bg-[#9E1B16] text-[#F5EAD2] border border-[#14100C] text-xs font-stamp uppercase hover:bg-[#C81E1E]"
              >
                Chốt Số [{dialValue}]
              </button>
              <button
                type="button"
                onClick={() => rotateDial(1)}
                className="px-3 py-1 bg-[#3A2E23] text-[#EBDAB9] border border-[#8C6426] text-xs font-cipher hover:bg-[#4D3D2E] inline-flex items-center gap-1"
              >
                Xoay Phải <RotateCw className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-1.5 font-cipher text-[11px] uppercase">
              <KeyRound className="w-3.5 h-3.5 text-[#9E1B16]" />
              Chuỗi Mật Mã Két (Gõ hoặc chốt từ đĩa xoay)
            </label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Nhập tối thiểu 4 ký tự / số két..."
              className="w-full px-3.5 py-2.5 text-sm font-cipher border-2 border-[#2A2018] bg-[#F5EAD2] dark:bg-[#1E0505] focus:outline-none focus:ring-2 focus:ring-[#9E1B16]"
            />
          </div>

          {error && <p className="text-xs font-cipher text-[#9E1B16] dark:text-[#FF6B5B]">{error}</p>}

          <div className="flex justify-center">
            <RubberStampButton type="submit" disabled={busy} stampWord="OPENED">
              <span className="inline-flex items-center gap-2">
                <Unlock className="w-4 h-4" />
                {busy ? 'Đang giải mã...' : secrets.length === 0 ? 'Khởi tạo & Mở Két' : 'Giải Mã Hồ Sơ'}
              </span>
            </RubberStampButton>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleCreateSecret}
            className="lg:col-span-5 p-5 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] space-y-3 h-fit"
          >
            <h3 className="font-cipher text-sm font-bold flex items-center gap-2 uppercase">
              <Plus className="w-4 h-4 text-[#9E1B16]" />
              Niêm Phong Hồ Sơ Mật Mới
            </h3>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Tên hồ sơ (VD: Danh tính đặc tình X, Mật mã kho...)"
              className="w-full px-3 py-2 text-xs font-cipher border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505]"
            />
            <textarea
              rows={5}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Nội dung tuyệt mật sẽ được mã hóa AES-256-GCM tại trình duyệt..."
              className="w-full px-3 py-2 font-legal-dossier text-base border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505]"
            />
            <RubberStampButton type="submit" disabled={busy} stampWord="SEALED">
              Mã Hóa & Lưu Két
            </RubberStampButton>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {secrets.length === 0 ? (
              <div className="p-8 manila-paper torn-paper-card border-2 border-[#2A2018] text-center font-legal-dossier text-lg text-[#574A3D] dark:text-[#FF9E8E]">
                Két sắt đang trống. Hãy nhập một tài liệu mật bên trái để kiểm chứng mã hóa đầu cuối.
              </div>
            ) : (
              secrets.map((entry) => {
                const showCipher = showCipherMap[entry.id];
                return (
                  <div
                    key={entry.id}
                    className="p-4 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 pb-2">
                      <h4 className="font-cipher text-sm font-bold">{entry.title}</h4>
                      <button
                        onClick={() =>
                          setShowCipherMap((prev) => ({ ...prev, [entry.id]: !prev[entry.id] }))
                        }
                        className="flex items-center gap-1 font-cipher text-[11px] uppercase text-[#9E1B16] dark:text-[#FF6B5B] hover:underline"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {showCipher ? 'Xem bản rõ' : 'Kiểm tra Ciphertext'}
                      </button>
                    </div>
                    <div className="masking-tape-divider" />
                    {showCipher ? (
                      <pre className="p-3 bg-[#14100C] text-[#EBDAB9] text-[11px] font-cipher overflow-x-auto">
                        {JSON.stringify({ iv: entry.iv, ciphertext: entry.ciphertext }, null, 2)}
                      </pre>
                    ) : (
                      <p className="font-legal-dossier text-lg whitespace-pre-line leading-relaxed">
                        {decryptedMap[entry.id]}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
