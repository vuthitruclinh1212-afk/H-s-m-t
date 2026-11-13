import type { NavSection, VaultItemType } from '@/src/types/vault';

export interface TypographyProfile {
  titleClass: string;
  bodyClass: string;
  metaClass: string;
  badgeFontName: string;
  purposeVi: string;
}

/**
 * Thiết kế font chữ riêng biệt cho từng loại mục hồ sơ (VaultItemType)
 * Tất cả các font đều thuộc bộ subset=vietnamese hỗ trợ 100% dấu tiếng Việt.
 */
export const ITEM_TYPE_TYPOGRAPHY: Record<VaultItemType, TypographyProfile> = {
  pdf: {
    titleClass: 'font-legal-dossier text-lg font-bold tracking-tight',
    bodyClass: 'font-serif-editorial text-xs leading-relaxed',
    metaClass: 'font-mono-tabular text-[11px]',
    badgeFontName: 'Cormorant Garamond VN',
    purposeVi: 'Văn bản Pháp quy & Hồ sơ PDF',
  },
  web_archive: {
    titleClass: 'font-dossier text-base font-bold leading-snug',
    bodyClass: 'font-serif-editorial text-xs leading-relaxed',
    metaClass: 'font-typewriter text-[10px]',
    badgeFontName: 'Newsreader & Playfair VN',
    purposeVi: 'Báo in Lưu trữ & Đọc Zen Mode',
  },
  note: {
    titleClass: 'font-handwriting text-xl font-bold leading-snug',
    bodyClass: 'font-handwriting text-lg leading-snug',
    metaClass: 'font-typewriter text-[10px]',
    badgeFontName: 'Patrick Hand VN',
    purposeVi: 'Sổ tay Phóng sự & Bút ký Hiện trường',
  },
  video: {
    titleClass: 'font-surveillance text-sm font-bold uppercase tracking-wide',
    bodyClass: 'font-bureau-ui text-xs leading-relaxed',
    metaClass: 'font-cipher text-[10px]',
    badgeFontName: 'Chakra Petch VN',
    purposeVi: 'Băng Giám sát CCTV & Timecode',
  },
  audio: {
    titleClass: 'font-surveillance text-sm font-bold uppercase tracking-wide',
    bodyClass: 'font-typewriter text-xs leading-relaxed',
    metaClass: 'font-cipher text-[10px]',
    badgeFontName: 'Chakra Petch & Space Mono VN',
    purposeVi: 'Băng Ghi âm Thẩm vấn Dictaphone',
  },
  image: {
    titleClass: 'font-polaroid text-base font-bold leading-snug',
    bodyClass: 'font-polaroid text-sm leading-snug',
    metaClass: 'font-stamp text-[10px]',
    badgeFontName: 'Mali & Oswald VN',
    purposeVi: 'Chữ viết Bút lông trên Ảnh Polaroid',
  },
  office_doc: {
    titleClass: 'font-mono-tabular text-sm font-bold uppercase',
    bodyClass: 'font-mono-tabular text-xs leading-relaxed',
    metaClass: 'font-cipher text-[10px]',
    badgeFontName: 'IBM Plex Mono VN',
    purposeVi: 'Sổ cái Kế toán & Bảng Biểu',
  },
  model_3d: {
    titleClass: 'font-cipher text-sm font-bold uppercase tracking-wider',
    bodyClass: 'font-surveillance text-xs leading-relaxed',
    metaClass: 'font-cipher text-[10px]',
    badgeFontName: 'JetBrains Mono VN',
    purposeVi: 'Trắc địa & Mô hình Pháp y 3D',
  },
};

/**
 * Thiết kế font chữ riêng biệt cho từng Phân khu chức năng (NavSection)
 */
export const SECTION_TYPOGRAPHY: Record<
  NavSection,
  {
    headerFontClass: string;
    subtitleFontClass: string;
    fontNameLabel: string;
    descVi: string;
  }
> = {
  dashboard: {
    headerFontClass: 'font-dossier',
    subtitleFontClass: 'font-serif-editorial italic',
    fontNameLabel: 'Playfair Display + Newsreader (Tiếng Việt)',
    descVi: 'Font Báo chí Chính luận Cổ điển',
  },
  library: {
    headerFontClass: 'font-legal-dossier',
    subtitleFontClass: 'font-typewriter',
    fontNameLabel: 'Cormorant Garamond + Space Mono (Tiếng Việt)',
    descVi: 'Font Danh mục Hồ sơ Lưu trữ',
  },
  clipper: {
    headerFontClass: 'font-stamp',
    subtitleFontClass: 'font-bureau-ui',
    fontNameLabel: 'Oswald Stencil + Be Vietnam Pro (Tiếng Việt)',
    descVi: 'Font Khay Tiếp nhận Vật chứng',
  },
  graph: {
    headerFontClass: 'font-typewriter',
    subtitleFontClass: 'font-handwriting',
    fontNameLabel: 'Space Mono + Patrick Hand (Tiếng Việt)',
    descVi: 'Font Sơ đồ Truy vết Dây Đỏ',
  },
  canvas: {
    headerFontClass: 'font-polaroid',
    subtitleFontClass: 'font-handwriting',
    fontNameLabel: 'Mali + Patrick Hand (Tiếng Việt)',
    descVi: 'Font Bảng Ghim Bần & Giấy Nhớ Hiện Trường',
  },
  e2ee: {
    headerFontClass: 'font-cipher',
    subtitleFontClass: 'font-surveillance',
    fontNameLabel: 'JetBrains Mono + Chakra Petch (Tiếng Việt)',
    descVi: 'Font Mật mã Quân sự & Két Sắt AES-256',
  },
  habits: {
    headerFontClass: 'font-surveillance',
    subtitleFontClass: 'font-signature',
    fontNameLabel: 'Chakra Petch + Dancing Script (Tiếng Việt)',
    descVi: 'Font Nhật ký Ca trực & Bút tích Thanh tra',
  },
};
