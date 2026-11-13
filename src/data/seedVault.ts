import type {
  CanvasConnection,
  CanvasNodePos,
  CollaborativeComment,
  DashboardWidget,
  HabitProfile,
  VaultItem,
} from '@/src/types/vault';
import type { SamplePdfSpec } from '@/src/utils/pdfFactory';

export const SAMPLE_PDF_SPECS: Record<string, SamplePdfSpec> = {
  'pdf-arch-01': {
    title: 'CASE FILE LP-4407: Astermoor Unclaimed Property Dossier',
    subtitle: 'Confidential Bureau Forensic Registry, Chain-of-Custody Log & Semantic Indexing Protocol.',
    author: 'Inspector Minh Nguyen — Bureau Archives',
    accentRgb: [0.56, 0.14, 0.12],
    pages: [
      {
        heading: '01. Initial Crime Scene & Evidence Intake',
        body: [
          'Every physical artifact, photographed scene, witness transcript, and financial ledger enters the Bureau Vault under a standardized catalog number (CAT. No LP-1187-A).',
          'Traditional filing cabinets lock each dossier into a single drawer, severing crucial cross-case links between suspects, locations, and dates.',
          'By indexing every PDF page and surveillance timestamp into vector chunks, investigators trace hidden patterns across decades of cold cases in milliseconds.',
        ],
      },
      {
        heading: '02. Forensic Page Verification & Live Redaction',
        body: [
          'High-DPI vector rendering ensures handwriting, fingerprint ridges, and architectural blueprints remain razor-sharp at 280% magnification.',
          'Field agents annotate exhibits directly with highlights, ink notes, and permanent black redaction bars before exporting court-ready PDF packets.',
        ],
      },
      {
        heading: '03. Zero-Knowledge Classified Safes (E2EE)',
        body: [
          'Top-secret informant identities and undercover operations are encrypted client-side via AES-256-GCM before touching external storage.',
          'Without the investigator passphrase, only unreadable ciphertext exists on the server.',
        ],
      },
      {
        heading: '04. Red-String Correlation & Visual Synthesis',
        body: [
          'Spatial corkboards allow detectives to pin Polaroids, floorplans, and autopsy PDFs side-by-side and draw red investigation yarn between leads.',
        ],
      },
    ],
  },
  'pdf-ai-02': {
    title: 'FORENSIC LAB MANUAL: Optical OCR & Wiretap Transcription',
    subtitle: 'Standard Operating Procedure for scanned police reports, surveillance tapes, and multilingual wiretaps.',
    author: 'Agent Linh Tran — Signal Intelligence',
    accentRgb: [0.11, 0.24, 0.42],
    pages: [
      {
        heading: '01. Extracting Handwritten Field Notes via AI OCR',
        body: [
          'Scanned microfilm and faded carbon-copy police reports are processed through multimodal Vision OCR to become searchable plain text.',
          'Coordinates are normalized from 0.0 to 1.0 so sticky notes never drift when zooming into fine-print evidence.',
        ],
      },
      {
        heading: '02. Wiretap & Bodycam Timestamp Synchronization',
        body: [
          'Audio and video recordings are transcribed with exact second-level timestamps. Clicking any investigator note jumps playback straight to the exact second.',
        ],
      },
      {
        heading: '03. Self-Destructing Briefings & Audit Trail',
        body: [
          'External intelligence briefings use view-limited self-destructing links (auto-purged after 1 view or 24 hours) and 30-day version history.',
        ],
      },
    ],
  },
};

export const INITIAL_VAULT_ITEMS: VaultItem[] = [
  {
    id: 'pdf-arch-01',
    workspaceId: 'personal',
    title: 'Hồ Sơ Vụ Án LP-4407: Tài Sản Thất Lạc Astermoor',
    type: 'pdf',
    smartFolder: 'Kiến trúc & Hệ thống',
    tags: ['Mật', 'Vật chứng', 'Hồ sơ Gốc'],
    excerpt:
      'Báo cáo hiện trường, danh mục 8 vật chứng (chìa khóa đồng, đồng hồ vỡ, bức ảnh không rõ danh tính) và chuỗi niêm phong.',
    content:
      'Hồ Sơ Vụ Án LP-4407 Astermoor. Danh mục vật chứng số LP-1187-A đến LP-8883-O. Quy trình phân mảnh vector từng trang PDF, xóa che thông tin mật (Redaction) và niêm phong mã hóa AES-256-GCM.',
    fileSizeLabel: '1.8 MB',
    pageCount: 5,
    lastReadPage: 2,
    readProgressPct: 40,
    offlineCached: true,
    pinned: true,
    linkedIds: ['note-zettelkasten', 'web-brutalist-lib', 'video-cat-jump', 'img-corkboard-lead'],
    annotations: [
      {
        id: 'ann-1',
        page: 2,
        kind: 'sticky',
        color: '#fde047',
        x: 0.72,
        y: 0.34,
        content: 'Lưu ý điều tra: Đối chiếu chữ khắc "IV" trên chìa khóa cũ.',
        author: 'Thanh tra Minh',
        createdAt: '2026-11-10T09:15:00Z',
      },
    ],
    versions: [
      {
        id: 'v-pdf-1',
        versionNumber: 1,
        summary: 'Bản niêm phong hồ sơ hiện trường ban đầu',
        contentSnapshot: 'Case File LP-4407 v1 — 5 trang tài liệu hiện trường.',
        savedAt: '2026-11-08T10:00:00Z',
        author: 'Minh Nguyễn',
      },
    ],
    createdAt: '2026-11-08T10:00:00Z',
    updatedAt: '2026-11-12T08:30:00Z',
  },
  {
    id: 'pdf-ai-02',
    workspaceId: 'engineering',
    title: 'Sổ Tay Tình Báo Tín Hiệu: OCR & Giải Băng Nghe Lén',
    type: 'pdf',
    smartFolder: 'Nghiên cứu AI',
    tags: ['AI OCR', 'Giải băng', 'Tín hiệu'],
    excerpt:
      'Quy trình bóc tách văn bản từ hồ sơ giấy scan, đồng bộ phụ đề ghi âm mật và tạo liên kết tự hủy.',
    content:
      'Sổ Tay Tình Báo Tín Hiệu: OCR & Giải Băng Nghe Lén. Kết xuất vector độ phân giải cao, lưu tọa độ chuẩn hóa và tạo phụ đề đa ngôn ngữ.',
    fileSizeLabel: '2.4 MB',
    pageCount: 4,
    lastReadPage: 1,
    readProgressPct: 25,
    offlineCached: true,
    linkedIds: ['pdf-arch-01', 'video-cat-jump'],
    annotations: [],
    versions: [
      {
        id: 'v-pdf-2',
        versionNumber: 1,
        summary: 'Lưu hành nội bộ Phòng Kỹ thuật Hình sự',
        contentSnapshot: 'Forensic Lab Manual v1.',
        savedAt: '2026-11-09T14:20:00Z',
        author: 'Đặc vụ Linh Trần',
      },
    ],
    createdAt: '2026-11-09T14:20:00Z',
    updatedAt: '2026-11-11T16:40:00Z',
  },
  {
    id: 'web-brutalist-lib',
    workspaceId: 'design-lab',
    title: 'Lưu Trữ Báo Cũ: Bản Tin Hiện Trường & Kho Lưu Trữ 1936',
    type: 'web_archive',
    smartFolder: 'Tài liệu PDF',
    tags: ['Lưu trữ Báo', 'Zen Reading', 'Chứng cứ'],
    sourceUrl: 'https://bureau-archives.example/case-1936-record',
    coverImage: '/assets/aistudio/image_e37dd7c7.png',
    excerpt:
      'Bản chụp ngoại tuyến từ hồ sơ lưu trữ báo chí điều tra, kèm kính lúp đối chiếu dấu vân tay và ghi chú hiện trường.',
    content: `## Hồ Sơ Điều Tra Số 487321 — Vụ Án Chưa Có Lời Giải

Vào lúc 23:40 đêm ngày 14 tháng 10, nhân viên trực lưu trữ phát hiện tập hồ sơ mang dấu mộc đỏ CONFIDENCIAL bị thất lạc khỏi ngăn kéo số 4. Trên mặt bàn chỉ còn lại bản chụp vân tay, một chiếc kính lúp và vết cà phê chưa khô.

## Các Đầu Mối Pháp Y Đã Thu Thập

1. Dấu vân tay trên mặt thẻ Ficha Dactiloscópica khớp với mẫu lưu trữ số C-17.
2. Tờ nhật báo Crónica Policial nhắc tới một nhân chứng đứng ở con hẻm phía sau tòa thị chính.
3. Không có dấu hiệu cạy khóa; người tiếp cận sở hữu chìa khóa khắc chữ La Mã "IV".

> "Những gì bị bỏ quên trong kho lưu trữ không bao giờ tự biến mất — chúng chỉ chờ người đủ kiên nhẫn kết nối lại."`,
    snapshotHtml:
      '<html><body><article><h1>Expediente Policial Nº 487321</h1><p>Archived offline forensic newspaper record.</p></article></body></html>',
    fileSizeLabel: '640 KB',
    readProgressPct: 65,
    offlineCached: true,
    linkedIds: ['pdf-arch-01', 'img-corkboard-lead', 'img-case-folder'],
    versions: [
      {
        id: 'v-web-1',
        versionNumber: 1,
        summary: 'Chụp toàn trang Web Archive & lọc Zen Mode',
        contentSnapshot: 'Bản chụp ban đầu từ Bureau Archives.',
        savedAt: '2026-11-07T11:00:00Z',
        author: 'Web Clipper',
      },
    ],
    createdAt: '2026-11-07T11:00:00Z',
    updatedAt: '2026-11-11T19:00:00Z',
  },
  {
    id: 'video-cat-jump',
    workspaceId: 'personal',
    title: 'Băng Giám Sát CCTV-04: Chuyển Động Đêm & Mèo Nhảy Qua Rào',
    type: 'video',
    smartFolder: 'Tư liệu Media',
    tags: ['CCTV', 'Timestamp Notes', 'Phân tích khung hình'],
    sourceUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    mediaUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    durationSec: 15,
    excerpt:
      'Băng trích xuất camera an ninh kèm ghi chú điều tra gắn chặt vào từng giây và phụ đề giải băng tự động.',
    content:
      'Băng CCTV-04: cảnh chú mèo bật nhảy qua hàng rào gỗ kích hoạt cảm biến chuyển động ở giây thứ 4, tiếp đất ở giây thứ 9. Đã giải băng timestamp.',
    fileSizeLabel: '4.2 MB',
    readProgressPct: 20,
    offlineCached: false,
    timestampNotes: [
      {
        id: 'ts-1',
        timestampSec: 2,
        text: 'Cảm biến hồng ngoại khu B bắt đầu ghi nhận chuyển động thấp.',
        createdAt: '2026-11-11T09:00:00Z',
      },
      {
        id: 'ts-2',
        timestampSec: 6,
        text: 'Đối tượng (chú mèo) nhảy vượt hàng rào gỗ — loại trừ nghi vấn xâm nhập người.',
        createdAt: '2026-11-11T09:02:00Z',
      },
      {
        id: 'ts-3',
        timestampSec: 11,
        text: 'Khu vực trở lại trạng thái tĩnh, lưu biên bản xác minh hiện trường.',
        createdAt: '2026-11-11T09:04:00Z',
      },
    ],
    subtitles: [
      { startSec: 0, endSec: 4, text: '00:00 — Camera CCTV-04 ghi hình góc sân sau dưới ánh đèn vàng.' },
      { startSec: 4, endSec: 9, text: '00:04 — Một chú mèo nhảy qua hàng rào gỗ kích hoạt chuông báo.' },
      { startSec: 9, endSec: 15, text: '00:09 — Không phát hiện dấu vết khả nghi khác tại hiện trường.' },
    ],
    linkedIds: ['pdf-ai-02', 'pdf-arch-01'],
    versions: [],
    createdAt: '2026-11-10T15:30:00Z',
    updatedAt: '2026-11-12T07:45:00Z',
  },
  {
    id: 'note-zettelkasten',
    workspaceId: 'personal',
    title: 'Sổ Tay Thám Tử: Suy Luận Dây Đỏ & Danh Sách Kiểm Tra Alibi',
    type: 'note',
    smartFolder: 'Ghi chú Cá nhân',
    tags: ['Thẩm vấn', 'Alibi', 'Ghi chú Mật'],
    excerpt:
      'Ghi chú điều tra kèm checklist xác minh chứng cứ ngoại phạm, đoạn mã truy vết và Time-Machine 30 ngày.',
    content: `# Nhật Ký Thẩm Vấn — Vụ Án Astermoor

Mỗi đầu mối rời rạc chỉ có giá trị khi được đối chiếu chéo giữa lời khai nhân chứng, dấu vân tay và mốc thời gian CCTV.

## Danh sách kiểm tra tối nay
- [x] Chuyện gì đã xảy ra vào đêm 28/09? (Đối chiếu CCTV-04)
- [x] Tìm nhân chứng tại kho lưu trữ phía Đông
- [ ] Xác minh chứng cứ ngoại phạm (Alibi) của người giữ chìa khóa IV

\`\`\`typescript
// Truy vết chuỗi liên kết chứng cứ trong hồ sơ
export interface EvidenceLink {
  exhibitA: string;
  exhibitB: string;
  confidence: number; // >= 0.85 xác nhận trùng khớp
}
\`\`\``,
    fileSizeLabel: '18 KB',
    readProgressPct: 100,
    offlineCached: true,
    pinned: true,
    linkedIds: ['pdf-arch-01', 'img-case-folder', 'web-brutalist-lib'],
    versions: [
      {
        id: 'v-note-2',
        versionNumber: 2,
        summary: 'Bổ sung checklist thẩm vấn & mã đối chiếu chứng cứ',
        contentSnapshot: '# Nhật Ký Thẩm Vấn — Vụ Án Astermoor\n\nĐã cập nhật checklist alibi.',
        savedAt: '2026-11-12T08:00:00Z',
        author: 'Thanh tra Minh',
      },
      {
        id: 'v-note-1',
        versionNumber: 1,
        summary: 'Ghi chép nháp tại hiện trường',
        contentSnapshot: '# Nhật Ký Thẩm Vấn\n\nCần xác minh lại nhân chứng và chìa khóa cổ.',
        savedAt: '2026-11-05T21:10:00Z',
        author: 'Thanh tra Minh',
      },
    ],
    createdAt: '2026-11-05T21:10:00Z',
    updatedAt: '2026-11-12T08:00:00Z',
  },
  {
    id: 'img-corkboard-lead',
    workspaceId: 'design-lab',
    title: 'Ảnh Chứng Cứ: Bảng Ghim Dây Đỏ & Sơ Đồ Mặt Bằng Hiện Trường',
    type: 'image',
    smartFolder: 'Tư liệu Media',
    tags: ['Bảng Dây Đỏ', 'Nghi phạm', 'OCR Hiện trường'],
    coverImage: '/assets/aistudio/image_943ddbd2.png',
    excerpt: 'Ảnh chụp bảng ghim điều tra nối dây đỏ giữa báo cáo hiện trường, thẻ EVIDENCE 2D79, bản vẽ mặt bằng và phong bì niêm sáp.',
    content: 'Ảnh bảng điều tra dây đỏ: Crime Scene Report, Evidence C7 3F61, Evidence 2D79, Suspect photo, dấu vân tay 47A.',
    fileSizeLabel: '1.4 MB',
    offlineCached: true,
    linkedIds: ['pdf-arch-01', 'web-brutalist-lib', 'img-case-folder'],
    versions: [],
    createdAt: '2026-11-09T11:20:00Z',
    updatedAt: '2026-11-09T11:20:00Z',
  },
  {
    id: 'img-case-folder',
    workspaceId: 'personal',
    title: 'Ảnh Hồ Sơ Vật Chứng: Bìa Da CASE FILE & Sổ Tay Nhân Chứng',
    type: 'image',
    smartFolder: 'Tư liệu Media',
    tags: ['Case File', 'Nhân chứng', 'Ảnh Polaroid'],
    coverImage: '/assets/aistudio/image_88b2f7bf.png',
    excerpt: 'Tập hồ sơ bìa da kẹp ghim ảnh nghi phạm, ảnh hiện trường khu rừng và sổ tay ghi chú thẩm vấn.',
    content: 'Case File kẹp ảnh Polaroid, sổ tay lò xo với 3 gạch đầu dòng: What happened that night?, Find witness, Question alibi.',
    fileSizeLabel: '1.2 MB',
    offlineCached: true,
    linkedIds: ['note-zettelkasten', 'img-corkboard-lead'],
    versions: [],
    createdAt: '2026-11-10T10:15:00Z',
    updatedAt: '2026-11-10T10:15:00Z',
  },
  {
    id: 'img-lost-property',
    workspaceId: 'design-lab',
    title: 'Bảng Kê Vật Chứng Chính Thức: Văn Phòng Tài Sản Thất Lạc 029',
    type: 'image',
    smartFolder: 'Tài liệu PDF',
    tags: ['Form LP-77A', 'Vật chứng', 'Niêm phong Sáp'],
    coverImage: '/assets/aistudio/image_451860d4.png',
    excerpt: 'Biểu mẫu Form LP-77A liệt kê 8 hiện vật (găng tay len, chìa khóa IV, cúc áo, bút máy, bi ve, đồng hồ vỡ) kèm dấu mộc sáp đỏ.',
    content: 'Form LP-77A Rev. 10/1936: CAT. No LP-1187-A đến LP-8883-O. Có thể dùng AI OCR để trích xuất toàn bộ chữ trên ảnh này.',
    fileSizeLabel: '1.9 MB',
    offlineCached: true,
    linkedIds: ['pdf-arch-01'],
    versions: [],
    createdAt: '2026-11-11T08:00:00Z',
    updatedAt: '2026-11-11T08:00:00Z',
  },
  {
    id: 'office-roadmap-sheet',
    workspaceId: 'engineering',
    title: 'Bảng Theo Dõi Chuyên Án & Giám Định Vật Chứng (Sổ Cái)',
    type: 'office_doc',
    smartFolder: 'Kiến trúc & Hệ thống',
    tags: ['Sổ Cái', 'Vật chứng', 'Giám định'],
    excerpt: 'Bảng thống kê mã hiện vật, tình trạng niêm phong, đơn vị phụ trách và mức độ ưu tiên điều tra.',
    content: `Mã Vật Chứng | Tên Hiện Vật | Vị Trí Thu Giữ | Trạng Thái Hồ Sơ
LP-1187-A | Găng tay len đơn chiếc | Ga tàu phía Bắc | Chờ đối chiếu ADN
LP-2264-F | Chìa khóa đồng khắc chữ IV | Ngăn kéo Phòng Lưu Trữ | Đang kiểm tra ổ khóa
LP-6621-W | Đồng hồ bỏ túi vỡ mặt kính | Hiện trường khu rừng | Dừng kim lúc 23:40
LP-7719-PH | Ảnh chân dung quay lưng | Bìa sau ghi chữ "Almost" | Đang chạy AI OCR`,
    fileSizeLabel: '420 KB',
    offlineCached: true,
    linkedIds: ['pdf-arch-01', 'img-lost-property'],
    versions: [],
    createdAt: '2026-11-06T09:00:00Z',
    updatedAt: '2026-11-11T10:15:00Z',
  },
  {
    id: 'model-pavilion',
    workspaceId: 'design-lab',
    title: 'Mô Hình Pháp Y 3D: Khối Đa Diện Tái Dựng Hiện Trường (.OBJ)',
    type: 'model_3d',
    smartFolder: 'Tư liệu Media',
    tags: ['3D Pháp y', 'Không gian', 'Tái dựng'],
    excerpt: 'Trình kiểm tra hình khối 3D xoay 360 độ, hỗ trợ chế độ khung dây (Wireframe) và nạp tệp .OBJ từ máy.',
    content: 'Mô hình tái dựng hình học không gian phục vụ phân tích góc quan sát nhân chứng.',
    fileSizeLabel: '3.6 MB',
    offlineCached: false,
    linkedIds: ['web-brutalist-lib', 'img-corkboard-lead'],
    versions: [],
    createdAt: '2026-11-10T18:00:00Z',
    updatedAt: '2026-11-10T18:00:00Z',
  },
];

export const INITIAL_CANVAS_POSITIONS: Record<string, CanvasNodePos> = {
  'pdf-arch-01': { x: 60, y: 70 },
  'img-corkboard-lead': { x: 390, y: 55 },
  'note-zettelkasten': { x: 80, y: 370 },
  'img-case-folder': { x: 420, y: 360 },
  'video-cat-jump': { x: 740, y: 170 },
};

export const INITIAL_CANVAS_CONNECTIONS: CanvasConnection[] = [
  { id: 'c1', fromId: 'pdf-arch-01', toId: 'img-corkboard-lead', label: 'Khớp mặt bằng' },
  { id: 'c2', fromId: 'pdf-arch-01', toId: 'note-zettelkasten', label: 'Checklist Alibi' },
  { id: 'c3', fromId: 'img-corkboard-lead', toId: 'img-case-folder', label: 'Ảnh nghi phạm' },
  { id: 'c4', fromId: 'pdf-arch-01', toId: 'video-cat-jump', label: 'Mốc CCTV 23:40' },
];

export const INITIAL_WIDGETS: DashboardWidget[] = [
  { id: 'continue-reading', title: 'Hồ sơ đang điều tra dở', visible: true },
  { id: 'watch-queue', title: 'Băng CCTV & Ghi âm cần rà soát', visible: true },
  { id: 'daily-quote', title: 'Ghi chú lưu trữ trong ngày', visible: true },
  { id: 'habit-summary', title: 'Thâm niên công tác & Điểm EXP', visible: true },
];

export const INITIAL_HABITS: HabitProfile = {
  expPoints: 1480,
  level: 6,
  streakDays: 9,
  readingMinutesToday: 38,
  dailyGoalMinutes: 60,
  badges: [
    { id: 'b1', name: 'Điều Tra Viên Lưu Trữ', description: 'Phân loại ít nhất 5 định dạng chứng cứ khác nhau', earned: true },
    { id: 'b2', name: 'Trực Ban Bền Bỉ 7 Ngày', description: 'Duy trì rà soát hồ sơ 7 ngày liên tiếp', earned: true },
    { id: 'b3', name: 'Bậc Thầy Dây Đỏ', description: 'Tạo trên 5 đường nối trên Sơ đồ Điều tra', earned: true },
    { id: 'b4', name: 'Người Giữ Két Mật Mã', description: 'Niêm phong ít nhất 1 tài liệu trong Két E2EE', earned: false },
  ],
};

export const INITIAL_COMMENTS: CollaborativeComment[] = [
  {
    id: 'cm-1',
    itemId: 'pdf-arch-01',
    author: 'Đặc vụ Linh Trần (Giám định)',
    text: 'Đã đối chiếu mẫu vân tay trên Form LP-77A, đề nghị kiểm tra lại mục ghi chú trang 2.',
    createdAt: '2026-11-12T08:45:00Z',
  },
];

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
