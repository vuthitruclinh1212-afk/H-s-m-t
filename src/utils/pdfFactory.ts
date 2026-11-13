import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PdfAnnotation } from '@/src/types/vault';

function toAsciiSafe(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^\x20-\x7E\n]/g, ' ');
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToUint8(b64: string): Uint8Array {
  const clean = b64.includes(',') ? b64.split(',')[1] : b64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface SamplePdfSpec {
  title: string;
  subtitle: string;
  author: string;
  accentRgb: [number, number, number];
  pages: Array<{ heading: string; body: string[] }>;
}

export async function generateSamplePdfBase64(spec: SamplePdfSpec): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const courier = await pdfDoc.embedFont(StandardFonts.Courier);

  const [r, g, b] = spec.accentRgb;

  // Cover Page
  const cover = pdfDoc.addPage([595, 842]);
  cover.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.98, 0.985, 0.995) });
  cover.drawRectangle({ x: 48, y: 740, width: 499, height: 6, color: rgb(r, g, b) });

  cover.drawText('AETHELV VAULT ARCHIVE', {
    x: 48,
    y: 765,
    size: 10,
    font: courier,
    color: rgb(0.4, 0.45, 0.55),
  });

  cover.drawText(toAsciiSafe(spec.title), {
    x: 48,
    y: 650,
    size: 26,
    font: helveticaBold,
    color: rgb(0.06, 0.09, 0.16),
    maxWidth: 490,
    lineHeight: 34,
  });

  cover.drawText(toAsciiSafe(spec.subtitle), {
    x: 48,
    y: 575,
    size: 13,
    font: helvetica,
    color: rgb(0.32, 0.37, 0.46),
    maxWidth: 480,
    lineHeight: 20,
  });

  cover.drawRectangle({
    x: 48,
    y: 260,
    width: 499,
    height: 210,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.86, 0.89, 0.94),
    borderWidth: 1,
  });

  cover.drawText('Document Blueprint & Vector Metadata', {
    x: 70,
    y: 435,
    size: 12,
    font: helveticaBold,
    color: rgb(r, g, b),
  });

  const metaLines = [
    `Author: ${toAsciiSafe(spec.author)}`,
    `Pages: ${spec.pages.length + 1} (Vector PDF 1.7)`,
    `Features: 3D Flipbook, Live Edit, AI OCR, Split & Merge`,
    `Status: Ready for Annotation & Semantic Indexing`,
  ];
  metaLines.forEach((line, idx) => {
    cover.drawText(line, {
      x: 70,
      y: 398 - idx * 28,
      size: 11,
      font: courier,
      color: rgb(0.2, 0.25, 0.33),
    });
  });

  cover.drawText('Page 1', {
    x: 500,
    y: 38,
    size: 10,
    font: courier,
    color: rgb(0.45, 0.5, 0.6),
  });

  // Content Pages
  spec.pages.forEach((p, idx) => {
    const page = pdfDoc.addPage([595, 842]);
    page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(1, 1, 1) });
    page.drawRectangle({ x: 48, y: 785, width: 499, height: 1, color: rgb(0.88, 0.9, 0.94) });

    page.drawText(toAsciiSafe(spec.title), {
      x: 48,
      y: 798,
      size: 9,
      font: courier,
      color: rgb(0.45, 0.5, 0.6),
    });

    page.drawText(toAsciiSafe(p.heading), {
      x: 48,
      y: 735,
      size: 18,
      font: helveticaBold,
      color: rgb(0.08, 0.11, 0.2),
      maxWidth: 495,
    });

    let cursorY = 690;
    for (const para of p.body) {
      const safe = toAsciiSafe(para);
      page.drawText(safe, {
        x: 48,
        y: cursorY,
        size: 11.5,
        font: helvetica,
        color: rgb(0.18, 0.23, 0.31),
        maxWidth: 495,
        lineHeight: 18,
      });
      const estimatedLines = Math.max(2, Math.ceil(safe.length / 72));
      cursorY -= estimatedLines * 18 + 16;
    }

    // Subtle schematic diagram box
    if (cursorY > 210) {
      page.drawRectangle({
        x: 48,
        y: 130,
        width: 499,
        height: 90,
        color: rgb(0.97, 0.98, 1),
        borderColor: rgb(0.85, 0.88, 0.95),
        borderWidth: 1,
      });
      page.drawText('Key Takeaways & Vector Index Anchor', {
        x: 66,
        y: 192,
        size: 10.5,
        font: helveticaBold,
        color: rgb(r, g, b),
      });
      page.drawText(
        `Section ${idx + 1} indexed for AI Semantic Search, Text-to-Speech, and Knowledge Graph linking.`,
        {
          x: 66,
          y: 165,
          size: 10,
          font: helvetica,
          color: rgb(0.32, 0.38, 0.48),
          maxWidth: 460,
        }
      );
    }

    page.drawText(`Page ${idx + 2}`, {
      x: 500,
      y: 38,
      size: 10,
      font: courier,
      color: rgb(0.45, 0.5, 0.6),
    });
  });

  const bytes = await pdfDoc.save();
  return uint8ToBase64(bytes);
}

export async function exportAnnotatedPdf(
  sourceBase64: string,
  annotations: PdfAnnotation[]
): Promise<Uint8Array> {
  const bytes = base64ToUint8(sourceBase64);
  const pdfDoc = await PDFDocument.load(bytes);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  for (const ann of annotations) {
    const page = pages[ann.page - 1];
    if (!page) continue;
    const { width, height } = page.getSize();

    if (ann.kind === 'text' && ann.content && ann.x !== undefined && ann.y !== undefined) {
      page.drawText(toAsciiSafe(ann.content), {
        x: ann.x * width,
        y: height - ann.y * height,
        size: 12,
        font,
        color: rgb(0.85, 0.15, 0.15),
      });
    } else if (ann.kind === 'redact' && ann.x !== undefined && ann.y !== undefined) {
      page.drawRectangle({
        x: ann.x * width,
        y: height - ann.y * height - 18,
        width: (ann.width ?? 0.22) * width,
        height: (ann.height ?? 0.04) * height,
        color: rgb(0.06, 0.09, 0.16),
      });
    } else if (ann.kind === 'sticky' && ann.content && ann.x !== undefined && ann.y !== undefined) {
      const boxX = Math.min(Math.max(ann.x * width - 55, 16), width - 140);
      const boxY = Math.min(Math.max(height - ann.y * height - 16, 20), height - 44);
      page.drawRectangle({
        x: boxX,
        y: boxY,
        width: 130,
        height: 28,
        color: rgb(0.99, 0.92, 0.54),
        borderColor: rgb(0.85, 0.68, 0.1),
        borderWidth: 1,
      });
      page.drawText(toAsciiSafe(ann.content).slice(0, 26), {
        x: boxX + 6,
        y: boxY + 10,
        size: 8.5,
        font,
        color: rgb(0.25, 0.18, 0.02),
      });
    } else if ((ann.kind === 'highlight' || ann.kind === 'draw' || ann.kind === 'underline') && ann.points && ann.points.length > 1) {
      for (let i = 1; i < ann.points.length; i++) {
        const p1 = ann.points[i - 1];
        const p2 = ann.points[i];
        page.drawLine({
          start: { x: p1.x * width, y: height - p1.y * height },
          end: { x: p2.x * width, y: height - p2.y * height },
          thickness: ann.kind === 'highlight' ? 12 : 2,
          color:
            ann.kind === 'highlight'
              ? rgb(0.98, 0.85, 0.15)
              : ann.kind === 'underline'
              ? rgb(0.86, 0.16, 0.24)
              : rgb(0.15, 0.39, 0.92),
          opacity: ann.kind === 'highlight' ? 0.38 : 0.9,
        });
      }
    }
  }

  return pdfDoc.save();
}

export async function splitPdfByRange(
  sourceBase64: string,
  fromPage: number,
  toPage: number
): Promise<{ base64: string; pageCount: number }> {
  const srcDoc = await PDFDocument.load(base64ToUint8(sourceBase64));
  const total = srcDoc.getPageCount();
  const start = Math.max(1, Math.min(fromPage, total));
  const end = Math.max(start, Math.min(toPage, total));
  const indices: number[] = [];
  for (let i = start - 1; i <= end - 1; i++) {
    indices.push(i);
  }
  const outDoc = await PDFDocument.create();
  const copied = await outDoc.copyPages(srcDoc, indices);
  copied.forEach((p) => outDoc.addPage(p));
  const bytes = await outDoc.save();
  return { base64: uint8ToBase64(bytes), pageCount: copied.length };
}

export async function mergePdfBase64List(
  base64List: string[]
): Promise<{ base64: string; pageCount: number }> {
  const merged = await PDFDocument.create();
  for (const b64 of base64List) {
    const doc = await PDFDocument.load(base64ToUint8(b64));
    const copied = await merged.copyPages(doc, doc.getPageIndices());
    copied.forEach((p) => merged.addPage(p));
  }
  const bytes = await merged.save();
  return { base64: uint8ToBase64(bytes), pageCount: merged.getPageCount() };
}
