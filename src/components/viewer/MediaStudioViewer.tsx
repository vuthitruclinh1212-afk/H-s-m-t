import React, { useEffect, useRef, useState } from 'react';
import {
  Captions,
  Clock,
  Globe,
  Pause,
  Play,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { SubtitleCue, TimestampNote, VaultItem } from '@/src/types/vault';
import { RevolverSpinner, RubberStampButton } from '@/src/components/bureau/BureauDecorations';
import { playTypewriterDing } from '@/src/utils/bureauAudio';

interface MediaStudioViewerProps {
  item: VaultItem;
  initialTimestampSec?: number;
  onUpdateItem: (patch: Partial<VaultItem>) => void;
  onGainExp?: (amount: number, reason: string) => void;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function MediaStudioViewer({
  item,
  initialTimestampSec,
  onUpdateItem,
  onGainExp,
}: MediaStudioViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState<number>(initialTimestampSec ?? 0);
  const [duration, setDuration] = useState<number>(item.durationSec ?? 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [noteInput, setNoteInput] = useState('');
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [targetLang, setTargetLang] = useState('Tiếng Việt');
  const [transcribing, setTranscribing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const mediaUrl = item.mediaUrl || item.sourceUrl || '';
  const isYoutube = /youtube\.com|youtu\.be/i.test(mediaUrl);
  const isAudio = item.type === 'audio';

  useEffect(() => {
    if (initialTimestampSec !== undefined && initialTimestampSec > 0) {
      seekTo(initialTimestampSec);
    }
  }, [initialTimestampSec]);

  const getMediaEl = () => (isAudio ? audioRef.current : videoRef.current);

  const seekTo = (sec: number) => {
    const el = getMediaEl();
    if (el) {
      el.currentTime = sec;
      setCurrentTime(sec);
      el.play().catch(() => {});
      setIsPlaying(true);
    } else {
      setCurrentTime(sec);
    }
  };

  const togglePlay = () => {
    const el = getMediaEl();
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    const el = getMediaEl();
    if (el) el.playbackRate = rate;
  };

  const handleAddTimestampNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    const sec = Math.floor(getMediaEl()?.currentTime ?? currentTime);
    const newNote: TimestampNote = {
      id: crypto.randomUUID(),
      timestampSec: sec,
      text: noteInput.trim(),
      createdAt: new Date().toISOString(),
    };
    const nextNotes = [...(item.timestampNotes || []), newNote].sort(
      (a, b) => a.timestampSec - b.timestampSec
    );
    onUpdateItem({ timestampNotes: nextNotes });
    setNoteInput('');
    playTypewriterDing();
    onGainExp?.(10, 'Gắn mốc giây vào băng chứng cứ');
  };

  const handleDeleteNote = (id: string) => {
    onUpdateItem({
      timestampNotes: (item.timestampNotes || []).filter((n) => n.id !== id),
    });
  };

  const handleAiTranscribe = async () => {
    setTranscribing(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          sourceContext: item.content || item.excerpt,
          targetLang,
          existingSubtitles: item.subtitles?.length ? item.subtitles : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi tạo phụ đề');

      if (Array.isArray(data.subtitles)) {
        onUpdateItem({ subtitles: data.subtitles as SubtitleCue[] });
        playTypewriterDing();
        onGainExp?.(15, 'Giải băng & dịch phụ đề AI');
      } else if (data.transcriptText) {
        onUpdateItem({
          subtitles: [{ startSec: 0, endSec: item.durationSec || 30, text: data.transcriptText }],
        });
        playTypewriterDing();
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Không thể giải băng phụ đề.');
    } finally {
      setTranscribing(false);
    }
  };

  const activeCue = (item.subtitles || []).find(
    (s) => currentTime >= s.startSec && currentTime <= s.endSec
  );

  const getYoutubeEmbedUrl = (url: string): string => {
    const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
    return match ? `https://www.youtube.com/embed/${match[1]}?start=${Math.floor(currentTime)}` : url;
  };

  const effectiveDuration = Math.max(duration || item.durationSec || 60, 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
      {/* LEFT: SURVEILLANCE MONITOR / DICTAPHONE & TRANSCRIPT */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        {/* #39: Vintage CRT / 16mm Projector Housing OR #40: Police Dictaphone Cassette */}
        {isAudio ? (
          <div className="p-6 bg-[#2A2018] dark:bg-[#240606] border-4 border-[#14100C] hard-shadow-lg space-y-4">
            <div className="flex items-center justify-between text-[#EBDAB9] font-typewriter text-xs">
              <span className="uppercase tracking-widest">SCOTLAND YARD DICTAPHONE · M-1948</span>
              <span className="px-2 py-0.5 bg-[#9E1B16] text-[#F5EAD2] text-[10px]">
                {isPlaying ? 'REC / PLAY' : 'STANDBY'}
              </span>
            </div>

            {/* #40: Cassette Deck with Two Rotating Reels */}
            <div className="mx-auto max-w-md bg-[#18120D] border-2 border-[#6E5332] p-4 space-y-3">
              <div className="manila-paper px-3 py-1.5 border border-[#2A2018] flex items-center justify-between text-xs">
                <span className="font-handwriting text-base font-bold truncate">
                  {item.title}
                </span>
                <span className="font-mono-tabular text-[10px] text-[#9E1B16] shrink-0">
                  SIDE A · 60M
                </span>
              </div>

              <div className="flex items-center justify-center gap-10 py-3 bg-[#100C08] border border-[#463526]">
                {/* Left Tape Reel */}
                <svg
                  viewBox="0 0 60 60"
                  className={`w-14 h-14 text-[#EBDAB9] ${isPlaying ? 'animate-spin' : ''}`}
                  style={{ animationDuration: '2.6s' }}
                >
                  <circle cx="30" cy="30" r="24" fill="#2A2018" stroke="#C69C4B" strokeWidth="2.5" />
                  <circle cx="30" cy="30" r="9" fill="#14100C" stroke="#EBDAB9" strokeWidth="2" />
                  <path d="M30 10 V20 M30 40 V50 M10 30 H20 M40 30 H50" stroke="#C69C4B" strokeWidth="3" />
                </svg>

                {/* Tape Window Bridge */}
                <div className="w-20 h-6 bg-[#2A2018] border border-[#6E5332] flex items-center justify-center overflow-hidden">
                  <div className={`w-full h-1 bg-[#9E1B16]/75 ${isPlaying ? 'animate-pulse' : ''}`} />
                </div>

                {/* Right Tape Reel */}
                <svg
                  viewBox="0 0 60 60"
                  className={`w-14 h-14 text-[#EBDAB9] ${isPlaying ? 'animate-spin' : ''}`}
                  style={{ animationDuration: '2.6s' }}
                >
                  <circle cx="30" cy="30" r="24" fill="#2A2018" stroke="#C69C4B" strokeWidth="2.5" />
                  <circle cx="30" cy="30" r="9" fill="#14100C" stroke="#EBDAB9" strokeWidth="2" />
                  <path d="M30 10 V20 M30 40 V50 M10 30 H20 M40 30 H50" stroke="#C69C4B" strokeWidth="3" />
                </svg>
              </div>

              <audio
                ref={audioRef}
                controls
                src={mediaUrl}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="w-full"
              />
            </div>
          </div>
        ) : (
          /* #39: Vintage CRT / 16mm Surveillance Bezel */
          <div className="p-3 sm:p-4 bg-[#221912] dark:bg-[#240606] border-4 border-[#14100C] hard-shadow-lg space-y-2.5">
            <div className="flex items-center justify-between text-[#D9C49E] font-typewriter text-[11px]">
              <span>CAM-04 · 16MM SURVEILLANCE MONITOR</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#9E1B16] animate-pulse" />
                CH-09
              </span>
            </div>

            <div className="relative border-4 border-[#100B08] bg-black overflow-hidden">
              {isYoutube ? (
                <iframe
                  src={getYoutubeEmbedUrl(mediaUrl)}
                  title={item.title}
                  className="w-full aspect-video"
                  allowFullScreen
                />
              ) : (
                <div className="relative">
                  <video
                    ref={videoRef}
                    src={mediaUrl}
                    controls
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    className="w-full aspect-video bg-black"
                  />
                  {/* #39: Scanline & Phosphor Vignette Overlay */}
                  <div className="crt-scanlines absolute inset-0" />
                  {showSubtitles && activeCue && (
                    <div className="pointer-events-none absolute bottom-12 inset-x-4 flex justify-center z-10">
                      <div className="px-3.5 py-1.5 bg-[#14100C]/90 border border-[#C69C4B] text-[#F5EAD2] font-mono-tabular text-xs max-w-lg text-center hard-shadow">
                        {activeCue.text}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Brass Dial Decorative Strip on CRT */}
            <div className="flex items-center justify-between px-1 text-[10px] font-mono-tabular text-[#B69F7D]">
              <span>V-HOLD · CONTRAST · TRACKING</span>
              <span>ARCHIVE REEL #{item.id.slice(0, 6).toUpperCase()}</span>
            </div>
          </div>
        )}

        {/* Controls Bar with #33 Brass Seek Slider */}
        <div className="p-4 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] space-y-3">
          {!isYoutube && (
            <div className="flex items-center gap-3">
              <span className="font-mono-tabular text-[11px] w-12">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={effectiveDuration}
                step={0.5}
                value={Math.min(currentTime, effectiveDuration)}
                onChange={(e) => seekTo(Number(e.target.value))}
                className="brass-slider flex-1"
                aria-label="Thanh tua thước đồng"
              />
              <span className="font-mono-tabular text-[11px] w-12 text-right">
                {formatTime(effectiveDuration)}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {!isYoutube && (
                <button
                  onClick={togglePlay}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#9E1B16] text-[#F5EAD2] border border-[#2A2018] font-typewriter uppercase text-xs hover:bg-[#C81E1E]"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {isPlaying ? 'Tạm dừng' : 'Phát băng'}
                </button>
              )}
              <span className="font-mono-tabular text-xs">
                TC: {formatTime(currentTime)}
                {item.durationSec ? ` / ${formatTime(item.durationSec)}` : ''}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {[1, 1.5, 2].map((rate) => (
                <button
                  key={rate}
                  onClick={() => changeSpeed(rate)}
                  className={`px-2 py-1 text-xs font-mono-tabular border ${
                    playbackRate === rate
                      ? 'bg-[#2A2018] dark:bg-[#9E1B16] text-[#F5EAD2] border-[#2A2018]'
                      : 'bg-[#F5EAD2] dark:bg-[#1E0505] text-[#574A3D] dark:text-[#FF9E8E] border-[#6E5332]'
                  }`}
                >
                  {rate}x
                </button>
              ))}
              <button
                onClick={() => setShowSubtitles((s) => !s)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-mono-tabular border ${
                  showSubtitles
                    ? 'bg-[#9E1B16] text-[#F5EAD2] border-[#2A2018]'
                    : 'bg-[#F5EAD2] dark:bg-[#1E0505] text-[#574A3D] dark:text-[#FF9E8E] border-[#6E5332]'
                }`}
              >
                <Captions className="w-3.5 h-3.5" />
                Phụ đề
              </button>
            </div>
          </div>
        </div>

        {/* Auto-Transcription & Translation */}
        <div className="p-4 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <h4 className="font-typewriter text-sm font-bold flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#9E1B16] dark:text-[#FF6B5B]" />
              Biên Bản Giải Băng & Dịch Phụ Đề AI
            </h4>
            <div className="flex items-center gap-2">
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="text-xs px-2.5 py-1.5 border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505]"
              >
                <option value="Tiếng Việt">Tiếng Việt</option>
                <option value="English">English</option>
                <option value="日本語 (Japanese)">日本語 (Japanese)</option>
              </select>
              <RubberStampButton
                disabled={transcribing}
                onClick={handleAiTranscribe}
                stampWord="TRANSCRIBED"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {transcribing ? 'Đang giải băng...' : 'Giải băng AI'}
                </span>
              </RubberStampButton>
            </div>
          </div>

          <div className="masking-tape-divider" />

          {aiError && <p className="text-xs text-[#9E1B16] dark:text-[#FF6B5B]">{aiError}</p>}

          {transcribing ? (
            <RevolverSpinner label="Đang bóc tách lời thoại từ băng từ..." />
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {(item.subtitles || []).length === 0 ? (
                <p className="font-handwriting text-lg text-[#574A3D] dark:text-[#FF9E8E]">
                  Chưa có bản giải băng. Nhấn "Giải băng AI" để bóc tách lời thoại theo mốc thời gian.
                </p>
              ) : (
                (item.subtitles || []).map((cue, i) => {
                  const active = currentTime >= cue.startSec && currentTime <= cue.endSec;
                  return (
                    <button
                      key={i}
                      onClick={() => seekTo(cue.startSec)}
                      className={`w-full text-left flex items-start gap-3 px-3 py-2 text-xs transition-colors ${
                        active
                          ? 'bg-[#9E1B16]/15 border border-[#9E1B16] text-[#1A120B] dark:text-[#FFD6CE]'
                          : 'hover:bg-[#DFC79C]/60 dark:hover:bg-[#3A0C0C] text-[#3D3329] dark:text-[#FFC2B8]'
                      }`}
                    >
                      <span className="font-mono-tabular text-[#9E1B16] dark:text-[#FF6B5B] font-semibold shrink-0">
                        {formatTime(cue.startSec)}
                      </span>
                      <span className="leading-relaxed">{cue.text}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: TIMESTAMP EVIDENCE NOTES */}
      <div className="lg:col-span-5 flex flex-col p-4 manila-paper torn-paper-card border-2 border-[#2A2018] dark:border-[#9E1B16]">
        <div className="flex items-center justify-between pb-3">
          <div>
            <h4 className="font-typewriter text-sm font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#9E1B16] dark:text-[#FF6B5B]" />
              Nhật Ký Mốc Thời Gian CCTV / Âm Thanh
            </h4>
            <p className="text-xs text-[#574A3D] dark:text-[#FF9E8E] mt-0.5">
              Nhấn vào mốc giây để tua băng đến đúng khoảnh khắc chứng cứ
            </p>
          </div>
          <span className="stamp-crimson text-[10px]">
            {(item.timestampNotes || []).length} MỐC
          </span>
        </div>

        <div className="red-string-divider my-2" />

        <form onSubmit={handleAddTimestampNote} className="py-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#574A3D] dark:text-[#FF9E8E]">
            <span>Ghi nhận tại thời điểm:</span>
            <span className="font-mono-tabular font-semibold text-[#9E1B16] dark:text-[#FF6B5B]">
              {formatTime(currentTime)}
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Ghi chú hiện tượng ở giây này..."
              className="flex-1 px-3 py-2 font-handwriting text-lg border border-[#6E5332] bg-[#F5EAD2] dark:bg-[#1E0505] focus:outline-none focus:ring-2 focus:ring-[#9E1B16]"
            />
            <button
              type="submit"
              className="flex items-center gap-1 px-3 py-2 bg-[#9E1B16] text-[#F5EAD2] text-xs font-typewriter uppercase hover:bg-[#C81E1E] shrink-0 hard-shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              Gắn mốc
            </button>
          </div>
        </form>

        <div className="masking-tape-divider my-1" />

        <div className="flex-1 overflow-y-auto pt-3 space-y-2">
          {(item.timestampNotes || []).length === 0 ? (
            <p className="font-handwriting text-xl text-[#574A3D] dark:text-[#FF9E8E] py-8 text-center">
              Chưa có ghi chú timestamp. Hãy phát băng và đánh dấu mốc đầu tiên.
            </p>
          ) : (
            (item.timestampNotes || []).map((note) => (
              <div
                key={note.id}
                className="group flex items-start gap-2.5 p-3 border border-[#6E5332] bg-[#F5EAD2]/90 dark:bg-[#1E0505] hover:border-[#9E1B16] transition-colors"
              >
                <button
                  onClick={() => seekTo(note.timestampSec)}
                  className="font-mono-tabular px-2 py-1 bg-[#9E1B16]/12 border border-[#9E1B16] text-[#9E1B16] dark:text-[#FF6B5B] text-xs font-semibold shrink-0 hover:bg-[#9E1B16] hover:text-white transition-colors"
                >
                  {formatTime(note.timestampSec)}
                </button>
                <p className="flex-1 font-handwriting text-lg leading-snug text-[#1A120B] dark:text-[#FFD6CE]">
                  {note.text}
                </p>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-[#574A3D] hover:text-[#9E1B16] transition-opacity"
                  title="Xóa ghi chú"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
