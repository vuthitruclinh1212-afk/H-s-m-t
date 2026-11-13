import React, { useEffect, useState } from 'react';
import { Award, Flame, Pause, Play, RotateCcw, Target } from 'lucide-react';
import type { HabitProfile } from '@/src/types/vault';
import { RubberStampButton } from '@/src/components/bureau/BureauDecorations';

interface GamificationHabitsViewProps {
  habits: HabitProfile;
  onGainExp: (amount: number, reason: string) => void;
  onLogMinutes: (mins: number) => void;
}

export default function GamificationHabitsView({
  habits,
  onGainExp,
  onLogMinutes,
}: GamificationHabitsViewProps) {
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          onLogMinutes(25);
          onGainExp(50, 'Hoàn thành ca trực đọc hồ sơ 25 phút');
          return 25 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, onGainExp, onLogMinutes]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const goalPct = Math.min(100, Math.round((habits.readingMinutesToday / habits.dailyGoalMinutes) * 100));
  const levelProgress = Math.round(((habits.expPoints % 300) / 300) * 100);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Ledger Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] space-y-2">
          <div className="font-surveillance text-[11px] font-bold uppercase text-[#574A3D] dark:text-[#FF9E8E]">
            Cấp Bậc Điều Tra Viên (Chakra Petch VN)
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-surveillance text-2xl font-bold">Cấp {habits.level}</span>
            <span className="font-cipher text-xs font-semibold text-[#9E1B16] dark:text-[#FF6B5B]">
              {habits.expPoints} EXP
            </span>
          </div>
          {/* #38: Burning Cigarette Progress Bar */}
          <div className="relative h-2.5 bg-[#DFC79C] dark:bg-[#140404] border border-[#6E5332] flex items-center">
            <div
              className="h-full bg-gradient-to-r from-[#5C0E0B] via-[#9E1B16] to-[#E25822] transition-all"
              style={{ width: `${levelProgress}%` }}
            />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B5B] shadow-[0_0_8px_#FF4500] -ml-1" />
          </div>
        </div>

        <div className="p-5 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] space-y-2">
          <div className="font-surveillance text-[11px] font-bold uppercase text-[#574A3D] dark:text-[#FF9E8E] flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-[#9E1B16]" />
            Chuỗi Ngày Trực Ban
          </div>
          <div className="font-surveillance text-2xl font-bold">{habits.streakDays} ngày</div>
          <p className="font-handwriting text-base text-[#574A3D] dark:text-[#FF9E8E]">
            Rà soát hồ sơ hoặc ghi chú mỗi ngày để giữ chuỗi công tác.
          </p>
        </div>

        <div className="p-5 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] space-y-2">
          <div className="font-surveillance text-[11px] font-bold uppercase text-[#574A3D] dark:text-[#FF9E8E] flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-[#9E1B16]" />
            Định Mức Hôm Nay
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-surveillance text-2xl font-bold">
              {habits.readingMinutesToday} / {habits.dailyGoalMinutes}p
            </span>
            <span className="font-cipher text-xs text-[#9E1B16] dark:text-[#FF6B5B]">
              {goalPct}%
            </span>
          </div>
          <div className="relative h-2.5 bg-[#DFC79C] dark:bg-[#140404] border border-[#6E5332] flex items-center">
            <div
              className="h-full bg-gradient-to-r from-[#5C0E0B] via-[#9E1B16] to-[#E25822] transition-all"
              style={{ width: `${goalPct}%` }}
            />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF6B5B] shadow-[0_0_8px_#FF4500] -ml-1" />
          </div>
        </div>
      </div>

      {/* Focus Timer & Bureau Badges */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 p-6 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] flex flex-col items-center justify-center text-center space-y-4">
          <h3 className="font-surveillance text-base font-bold uppercase tracking-wide">
            Đồng Hồ Nghiên Cứu Hồ Sơ
          </h3>
          <div className="font-surveillance text-5xl font-bold tracking-tight">
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <RubberStampButton onClick={() => setRunning((r) => !r)} stampWord={running ? 'PAUSED' : 'ON DUTY'}>
              <span className="inline-flex items-center gap-1.5">
                {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {running ? 'Tạm dừng' : 'Bắt đầu ca trực'}
              </span>
            </RubberStampButton>
            <button
              onClick={() => {
                setRunning(false);
                setSecondsLeft(25 * 60);
              }}
              className="p-2 border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] hover:bg-[#DFC79C]"
              title="Đặt lại đồng hồ"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                onLogMinutes(10);
                onGainExp(20, 'Ghi nhận 10 phút giám định tài liệu');
              }}
              className="px-3 py-2 border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] text-xs font-surveillance font-bold uppercase hover:bg-[#DFC79C]"
            >
              +10 phút
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 p-6 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-dossier text-base font-bold flex items-center gap-2 uppercase tracking-wide">
              <Award className="w-4 h-4 text-[#9E1B16] dark:text-[#FF6B5B]" />
              Huy Hiệu Công Tác Cục Lưu Trữ
            </h3>
            <span className="font-cipher text-[10px] text-[#574A3D] dark:text-[#FF9E8E]">
              Oswald + Dancing Script VN
            </span>
          </div>
          <div className="masking-tape-divider" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {habits.badges.map((badge) => (
              <div
                key={badge.id}
                className={`p-4 border-2 text-xs space-y-1.5 ${
                  badge.earned
                    ? 'border-[#9E1B16] bg-[#F5EAD2] dark:bg-[#1E0505] hard-shadow'
                    : 'border-[#6E5332]/50 opacity-55'
                }`}
              >
                <div className="font-stamp font-bold text-sm uppercase tracking-wider">{badge.name}</div>
                <p className="font-signature text-xl font-bold text-[#574A3D] dark:text-[#FF9E8E]">
                  {badge.description}
                </p>
                <div className="pt-1 font-stamp text-[10px] uppercase font-bold text-[#9E1B16] dark:text-[#FF6B5B]">
                  {badge.earned ? '[ĐÃ CẤP CHỨNG NHẬN]' : '[CHƯA ĐẠT]'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
