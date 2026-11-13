import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình trong Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-memory self-destruct link store (persisted for session)
interface ShareRecord {
  token: string;
  itemId: string;
  title: string;
  type: string;
  contentPreview: string;
  maxDownloads: number;
  downloadCount: number;
  expiresAt: number;
  createdAt: number;
}
const shareStore = new Map<string, ShareRecord>();

// 1. AI Summarization
app.post('/api/ai/summarize', async (req, res) => {
  try {
    const { title, content, type } = req.body as { title: string; content: string; type?: string };
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Không có nội dung văn bản để tóm tắt.' });
    }
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Hãy tóm tắt tài liệu sau bằng tiếng Việt rõ ràng, súc tích và có cấu trúc.\nLoại: ${type || 'Tài liệu'}\nTiêu đề: ${title}\n\nNội dung:\n${content.slice(0, 24000)}`,
      config: {
        systemInstruction:
          'Bạn là trợ lý nghiên cứu tri thức (Second Brain). Hãy trả về bản tóm tắt gồm: 1) Tóm tắt cốt lõi (2-3 câu), 2) Các luận điểm quan trọng nhất (gạch đầu dòng), 3) Gợi ý ứng dụng / liên kết tri thức. Trả lời bằng tiếng Việt chuyên nghiệp.',
      },
    });
    res.json({ summary: response.text ?? 'Không thể tạo tóm tắt.' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Lỗi AI Summarization' });
  }
});

// 2. AI OCR (Multimodal Vision)
app.post('/api/ai/ocr', async (req, res) => {
  try {
    const { imageBase64, mimeType, pageNumber } = req.body as {
      imageBase64: string;
      mimeType?: string;
      pageNumber?: number;
    };
    if (!imageBase64) {
      return res.status(400).json({ error: 'Thiếu dữ liệu hình ảnh để OCR.' });
    }
    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/png',
              data: cleanBase64,
            },
          },
          {
            text: `Trích xuất toàn bộ văn bản, tiêu đề, công thức và bảng biểu (dạng Markdown nếu có) xuất hiện trong hình ảnh${pageNumber ? ` (trang ${pageNumber})` : ''}. Giữ nguyên ngôn ngữ gốc của văn bản và không thêm lời bình thừa.`,
          },
        ],
      },
    });
    res.json({ text: response.text ?? '' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Lỗi AI OCR' });
  }
});

// 3. AI Auto-Tagging & Smart Folder Classification
app.post('/api/ai/autotag', async (req, res) => {
  try {
    const { title, content, type } = req.body as { title: string; content: string; type: string };
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Phân tích mục lưu trữ sau và đề xuất thẻ tag + thư mục thông minh:\nLoại: ${type}\nTiêu đề: ${title}\nNội dung: ${(content || '').slice(0, 6000)}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 đến 5 tag ngắn gọn (1-2 từ, tiếng Việt hoặc thuật ngữ chuẩn)',
            },
            smartFolder: {
              type: Type.STRING,
              description: 'Tên 1 thư mục phù hợp nhất trong: Kiến trúc & Hệ thống, Nghiên cứu AI, Tài liệu PDF, Tư liệu Media, Ghi chú Cá nhân',
            },
            oneLineSummary: {
              type: Type.STRING,
              description: 'Tóm tắt 1 câu ngắn gọn dưới 140 ký tự',
            },
          },
          required: ['tags', 'smartFolder', 'oneLineSummary'],
        },
      },
    });
    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Lỗi AI Auto-Tagging' });
  }
});

// 4. AI Semantic Search
app.post('/api/ai/search', async (req, res) => {
  try {
    const { query, items } = req.body as {
      query: string;
      items: Array<{
        id: string;
        title: string;
        type: string;
        tags: string[];
        excerpt: string;
        chunks?: Array<{ label: string; text: string; page?: number; timestampSec?: number }>;
      }>;
    };
    if (!query || !items?.length) {
      return res.json({ results: [] });
    }

    const ai = getGeminiClient();
    const compactCatalog = items.slice(0, 40).map((it) => ({
      id: it.id,
      title: it.title,
      type: it.type,
      tags: it.tags,
      excerpt: it.excerpt.slice(0, 500),
      chunks: (it.chunks || []).slice(0, 6),
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Truy vấn tìm kiếm ngữ nghĩa của người dùng: "${query}"\n\nDanh sách kho dữ liệu:\n${JSON.stringify(compactCatalog)}`,
      config: {
        systemInstruction:
          'Hãy xếp hạng các mục phù hợp nhất theo NGỮ NGHĨA (không cần khớp chính xác từ khóa). Nếu có chunk trùng ngữ nghĩa (số trang PDF hoặc số giây Video), hãy trả về matchedPage hoặc matchedTimestampSec.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  itemId: { type: Type.STRING },
                  relevanceScore: { type: Type.NUMBER, description: 'Điểm từ 0 đến 1' },
                  reason: { type: Type.STRING, description: 'Lý do ngắn gọn bằng tiếng Việt vì sao khớp ngữ nghĩa' },
                  matchedPage: { type: Type.INTEGER },
                  matchedTimestampSec: { type: Type.NUMBER },
                },
                required: ['itemId', 'relevanceScore', 'reason'],
              },
            },
          },
          required: ['results'],
        },
      },
    });
    const parsed = JSON.parse((response.text ?? '{"results":[]}').trim());
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Lỗi AI Semantic Search' });
  }
});

// 5. AI Auto-Transcription & Multi-language Subtitle Translation
app.post('/api/ai/transcribe', async (req, res) => {
  try {
    const { title, sourceContext, targetLang, audioBase64, mimeType, existingSubtitles } = req.body as {
      title: string;
      sourceContext?: string;
      targetLang?: string;
      audioBase64?: string;
      mimeType?: string;
      existingSubtitles?: Array<{ startSec: number; endSec: number; text: string }>;
    };
    const ai = getGeminiClient();

    if (audioBase64) {
      const cleanBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            { inlineData: { mimeType: mimeType || 'audio/mp3', data: cleanBase64 } },
            { text: `Bóc băng âm thanh này và dịch/xuất phụ đề bằng ngôn ngữ ${targetLang || 'Tiếng Việt'}.` },
          ],
        },
      });
      return res.json({ transcriptText: response.text ?? '' });
    }

    if (existingSubtitles?.length) {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Hãy dịch danh sách phụ đề sau sang ${targetLang || 'Tiếng Việt'}, giữ nguyên startSec và endSec:\n${JSON.stringify(existingSubtitles)}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subtitles: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    startSec: { type: Type.NUMBER },
                    endSec: { type: Type.NUMBER },
                    text: { type: Type.STRING },
                  },
                  required: ['startSec', 'endSec', 'text'],
                },
              },
            },
            required: ['subtitles'],
          },
        },
      });
      return res.json(JSON.parse((response.text ?? '{"subtitles":[]}').trim()));
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Tạo bản bóc băng phụ đề có timestamp cho media "${title}" với ngữ cảnh: ${sourceContext || title}. Ngôn ngữ: ${targetLang || 'Tiếng Việt'}.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subtitles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  startSec: { type: Type.NUMBER },
                  endSec: { type: Type.NUMBER },
                  text: { type: Type.STRING },
                },
                required: ['startSec', 'endSec', 'text'],
              },
            },
          },
          required: ['subtitles'],
        },
      },
    });
    res.json(JSON.parse((response.text ?? '{"subtitles":[]}').trim()));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Lỗi AI Transcription' });
  }
});

// 6. Universal Web Archive Clipper (Fetch URL -> Clean Zen Article + Offline HTML Snapshot)
app.post('/api/clip-url', async (req, res) => {
  try {
    const { url } = req.body as { url: string };
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'Vui lòng nhập URL hợp lệ bắt đầu bằng http:// hoặc https://' });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AethelVaultArchiver/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);

    if (!resp.ok) {
      return res.status(400).json({ error: `Không thể tải trang web (HTTP ${resp.status}).` });
    }

    const rawHtml = await resp.text();
    const titleMatch = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : new URL(url).hostname;

    // Strip scripts, styles, navs, ads to extract readable Zen Mode paragraphs
    const cleanedHtml = rawHtml
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '');

    const textBlocks: string[] = [];
    const blockRegex = /<(h1|h2|h3|p|li|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
    let m: RegExpExecArray | null;
    while ((m = blockRegex.exec(cleanedHtml)) !== null && textBlocks.length < 60) {
      const inner = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (inner.length > 20) {
        const tag = m[1].toLowerCase();
        textBlocks.push(tag.startsWith('h') ? `## ${inner}` : inner);
      }
    }

    const cleanContent =
      textBlocks.length > 0
        ? textBlocks.join('\n\n')
        : cleanedHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000);

    res.json({
      title,
      url,
      cleanContent,
      snapshotHtml: rawHtml.slice(0, 120000),
      archivedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? `Không thể lưu trữ URL: ${err.message}` : 'Lỗi Web Clipper',
    });
  }
});

// 7. Self-Destruct Share Links API
app.post('/api/share', (req, res) => {
  const { itemId, title, type, contentPreview, maxDownloads = 1, ttlHours = 24 } = req.body as {
    itemId: string;
    title: string;
    type: string;
    contentPreview: string;
    maxDownloads?: number;
    ttlHours?: number;
  };
  const token = crypto.randomBytes(12).toString('hex');
  const now = Date.now();
  const record: ShareRecord = {
    token,
    itemId,
    title,
    type,
    contentPreview: (contentPreview || '').slice(0, 3000),
    maxDownloads: Math.max(1, Number(maxDownloads) || 1),
    downloadCount: 0,
    expiresAt: now + Math.max(0.05, Number(ttlHours) || 24) * 3600 * 1000,
    createdAt: now,
  };
  shareStore.set(token, record);
  res.json(record);
});

app.get('/api/share/:token', (req, res) => {
  const record = shareStore.get(req.params.token);
  if (!record) {
    return res.status(404).json({ error: 'Liên kết này không tồn tại hoặc đã tự hủy.' });
  }
  if (Date.now() > record.expiresAt) {
    shareStore.delete(req.params.token);
    return res.status(410).json({ error: 'Liên kết đã hết hạn và bị tự động tiêu hủy.' });
  }
  record.downloadCount += 1;
  const remaining = record.maxDownloads - record.downloadCount;
  const payload = { ...record, remainingViews: Math.max(0, remaining) };
  if (record.downloadCount >= record.maxDownloads) {
    shareStore.delete(req.params.token);
  }
  res.json(payload);
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AethelVault server listening on http://localhost:${PORT}`);
  });
}

startServer();
