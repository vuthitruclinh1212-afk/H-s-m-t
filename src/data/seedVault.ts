import type {
  CanvasConnection,
  CanvasNodePos,
  CollaborativeComment,
  DashboardWidget,
  HabitProfile,
  VaultItem,
} from '@/src/types/vault';
import type { SamplePdfSpec } from '@/src/utils/pdfFactory';

export const SAMPLE_PDF_SPECS: Record<string, SamplePdfSpec> = {};

// Toàn bộ dữ liệu khởi tạo được đặt rỗng theo yêu cầu (không dùng dữ liệu mẫu)
export const INITIAL_VAULT_ITEMS: VaultItem[] = [];

export const INITIAL_CANVAS_POSITIONS: Record<string, CanvasNodePos> = {};

export const INITIAL_CANVAS_CONNECTIONS: CanvasConnection[] = [];

export const INITIAL_WIDGETS: DashboardWidget[] = [
  { id: 'continue-reading', title: 'Hồ sơ đang điều tra dở', visible: true },
  { id: 'watch-queue', title: 'Băng CCTV & Ghi âm cần rà soát', visible: true },
  { id: 'daily-quote', title: 'Ghi chú lưu trữ trong ngày', visible: true },
  { id: 'habit-summary', title: 'Thâm niên công tác & Điểm EXP', visible: true },
];

export const INITIAL_HABITS: HabitProfile = {
  expPoints: 0,
  level: 1,
  streakDays: 0,
  readingMinutesToday: 0,
  dailyGoalMinutes: 60,
  badges: [
    { id: 'b1', name: 'Điều Tra Viên Lưu Trữ', description: 'Phân loại ít nhất 5 định dạng chứng cứ khác nhau', earned: false },
    { id: 'b2', name: 'Trực Ban Bền Bỉ 7 Ngày', description: 'Duy trì rà soát hồ sơ 7 ngày liên tiếp', earned: false },
    { id: 'b3', name: 'Bậc Thầy Dây Đỏ', description: 'Tạo trên 5 đường nối trên Sơ đồ Điều tra', earned: false },
    { id: 'b4', name: 'Người Giữ Két Mật Mã', description: 'Niêm phong ít nhất 1 tài liệu trong Két E2EE', earned: false },
  ],
};

export const INITIAL_COMMENTS: CollaborativeComment[] = [];

export const DAILY_QUOTES = [
  {
    quote: 'Một số thứ biến mất là có lý do. Những thứ khác thì đang chờ được tìm thấy.',
    author: 'Sổ Tay Văn Phòng Tài Sản Thất Lạc, 1936',
  },
  {
    quote: 'Không phải món đồ nào cũng thất lạc do vô tình — có những manh mối được cố tình để lại.',
    author: 'Hồ Sơ Lưu Trữ Astermoor, Mục LP-77A',
  },
  {
    quote: 'Khi mọi chi tiết tưởng như rời rạc đều khớp vào cùng một mốc thời gian, sự thật sẽ tự lên tiếng.',
    author: 'Nguyên tắc Điều tra Cục Lưu Trữ',
  },
];
