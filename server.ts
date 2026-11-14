import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Allow CORS from https://h-s-m-t.vercel.app and all authorized origins
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Vault-Uid');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(express.json({ limit: '25mb' }));

// Persistent Multi-Device Cloud Vault Database (1 Email = 1 Unique Account, Anti-Overwrite)
const CLOUD_DB_FILE = path.join(__dirname, '.aethelvault_cloud_db.json');

interface CloudAccountRecord {
  uid: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  meta: {
    expPoints: number;
    level: number;
    streakDays: number;
    readingMinutesToday: number;
    dailyGoalMinutes: number;
    earnedBadgeIds: string[];
    hiddenWidgetIds: string[];
  };
  items: Record<string, Record<string, unknown>>;
  comments: Record<string, Record<string, unknown>>;
}

interface CloudDbSchema {
  accountsByUid: Record<string, CloudAccountRecord>;
  uidByEmail: Record<string, string>;
}

function loadCloudDb(): CloudDbSchema {
  try {
    if (fs.existsSync(CLOUD_DB_FILE)) {
      const raw = fs.readFileSync(CLOUD_DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as CloudDbSchema;
      if (parsed && parsed.accountsByUid && parsed.uidByEmail) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read cloud vault store:', err);
  }
  return { accountsByUid: {}, uidByEmail: {} };
}

const cloudDb: CloudDbSchema = loadCloudDb();

function persistCloudDb() {
  try {
    fs.writeFileSync(CLOUD_DB_FILE, JSON.stringify(cloudDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist cloud vault store:', err);
  }
}

function deriveUidFromEmail(email: string): string {
  const norm = email.trim().toLowerCase();
  const hash = crypto.createHash('sha256').update(`aethelvault::${norm}`).digest('hex').slice(0, 28);
  return `usr_${hash}`;
}

function hashAccountPassword(email: string, password: string): string {
  const norm = email.trim().toLowerCase();
  return crypto.createHash('sha256').update(`aethelvault_pw::${norm}::${password}`).digest('hex');
}

// Cloud Auth Endpoint: 1 Email = 1 Account, Never Overwrites Existing Account Data
app.post('/api/cloud-vault/auth', (req, res) => {
  const { email, password, displayName, mode } = req.body as {
    email?: string;
    password?: string;
    displayName?: string;
    mode?: 'login' | 'register' | 'auto';
  };
  const normEmail = (email || '').trim().toLowerCase();
  if (!normEmail || !normEmail.includes('@')) {
    return res.status(400).json({ error: 'Vui lòng nhập địa chỉ Email hợp lệ.' });
  }
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Mật khẩu niêm phong phải có ít nhất 4 ký tự.' });
  }

  const existingUid = cloudDb.uidByEmail[normEmail];
  const pwHash = hashAccountPassword(normEmail, password);
  const nowIso = new Date().toISOString();

  if (existingUid && cloudDb.accountsByUid[existingUid]) {
    const acc = cloudDb.accountsByUid[existingUid];
    if (mode === 'register') {
      return res.status(409).json({
        error: `Email "${normEmail}" đã được đăng ký một tài khoản duy nhất. Vui lòng chọn chế độ Đăng nhập để khôi phục dữ liệu cũ.`,
      });
    }
    if (acc.passwordHash !== pwHash) {
      return res.status(401).json({
        error: 'Mật khẩu không chính xác cho tài khoản Email này. Dữ liệu cũ được bảo vệ chống ghi đè.',
      });
    }
    acc.updatedAt = nowIso;
    persistCloudDb();
    return res.json({
      user: {
        uid: acc.uid,
        email: acc.email,
        displayName: acc.displayName,
        isNewAccount: false,
      },
    });
  }

  // Create new isolated account for this email
  const uid = deriveUidFromEmail(normEmail);
  const cleanName = (displayName || normEmail.split('@')[0] || 'Thanh tra').trim().slice(0, 80);
  const newAcc: CloudAccountRecord = {
    uid,
    email: normEmail,
    displayName: cleanName,
    passwordHash: pwHash,
    createdAt: nowIso,
    updatedAt: nowIso,
    meta: {
      expPoints: 0,
      level: 1,
      streakDays: 1,
      readingMinutesToday: 0,
      dailyGoalMinutes: 60,
      earnedBadgeIds: [],
      hiddenWidgetIds: [],
    },
    items: {},
    comments: {},
  };

  cloudDb.uidByEmail[normEmail] = uid;
  cloudDb.accountsByUid[uid] = newAcc;
  persistCloudDb();

  return res.json({
    user: {
      uid: newAcc.uid,
      email: newAcc.email,
      displayName: newAcc.displayName,
      isNewAccount: true,
    },
  });
});

// Ensure or Fetch Account Snapshot without Overwriting
app.get('/api/cloud-vault/snapshot/:uid', (req, res) => {
  const { uid } = req.params;
  const emailQuery = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
  const nameQuery = typeof req.query.displayName === 'string' ? req.query.displayName.trim() : '';

  let acc = cloudDb.accountsByUid[uid];
  if (!acc && emailQuery && cloudDb.uidByEmail[emailQuery]) {
    acc = cloudDb.accountsByUid[cloudDb.uidByEmail[emailQuery]];
  }
  if (!acc) {
    const nowIso = new Date().toISOString();
    acc = {
      uid,
      email: emailQuery || `${uid}@aethel.bureau`,
      displayName: nameQuery || (emailQuery ? emailQuery.split('@')[0] : 'Thanh tra'),
      passwordHash: '',
      createdAt: nowIso,
      updatedAt: nowIso,
      meta: {
        expPoints: 0,
        level: 1,
        streakDays: 1,
        readingMinutesToday: 0,
        dailyGoalMinutes: 60,
        earnedBadgeIds: [],
        hiddenWidgetIds: [],
      },
      items: {},
      comments: {},
    };
    cloudDb.accountsByUid[uid] = acc;
    if (emailQuery && !cloudDb.uidByEmail[emailQuery]) {
      cloudDb.uidByEmail[emailQuery] = uid;
    }
    persistCloudDb();
  }

  return res.json({
    uid: acc.uid,
    email: acc.email,
    displayName: acc.displayName,
    meta: acc.meta,
    items: Object.values(acc.items),
    comments: Object.values(acc.comments),
  });
});

app.put('/api/cloud-vault/meta/:uid', (req, res) => {
  const { uid } = req.params;
  const acc = cloudDb.accountsByUid[uid];
  if (!acc) {
    return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  }
  const body = req.body as Partial<CloudAccountRecord['meta']>;
  acc.meta = {
    expPoints: typeof body.expPoints === 'number' ? body.expPoints : acc.meta.expPoints,
    level: typeof body.level === 'number' ? body.level : acc.meta.level,
    streakDays: typeof body.streakDays === 'number' ? body.streakDays : acc.meta.streakDays,
    readingMinutesToday:
      typeof body.readingMinutesToday === 'number'
        ? body.readingMinutesToday
        : acc.meta.readingMinutesToday,
    dailyGoalMinutes:
      typeof body.dailyGoalMinutes === 'number' ? body.dailyGoalMinutes : acc.meta.dailyGoalMinutes,
    earnedBadgeIds: Array.isArray(body.earnedBadgeIds)
      ? body.earnedBadgeIds
      : acc.meta.earnedBadgeIds,
    hiddenWidgetIds: Array.isArray(body.hiddenWidgetIds)
      ? body.hiddenWidgetIds
      : acc.meta.hiddenWidgetIds,
  };
  acc.updatedAt = new Date().toISOString();
  persistCloudDb();
  return res.json({ ok: true, meta: acc.meta });
});

app.put('/api/cloud-vault/item/:uid/:itemId', (req, res) => {
  const { uid, itemId } = req.params;
  const acc = cloudDb.accountsByUid[uid];
  if (!acc) {
    return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  }
  const payload = req.body as Record<string, unknown>;
  const existing = acc.items[itemId] || {};
  acc.items[itemId] = {
    ...existing,
    ...payload,
    id: itemId,
    ownerId: uid,
    updatedAtIso: new Date().toISOString(),
  };
  acc.updatedAt = new Date().toISOString();
  persistCloudDb();
  return res.json({ ok: true, item: acc.items[itemId] });
});

app.delete('/api/cloud-vault/item/:uid/:itemId', (req, res) => {
  const { uid, itemId } = req.params;
  const acc = cloudDb.accountsByUid[uid];
  if (!acc) {
    return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  }
  delete acc.items[itemId];
  acc.updatedAt = new Date().toISOString();
  persistCloudDb();
  return res.json({ ok: true });
});

app.post('/api/cloud-vault/comment/:uid', (req, res) => {
  const { uid } = req.params;
  const acc = cloudDb.accountsByUid[uid];
  if (!acc) {
    return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  }
  const comment = req.body as { id?: string } & Record<string, unknown>;
  const cid = String(comment.id || `cm-${crypto.randomUUID().slice(0, 8)}`);
  acc.comments[cid] = {
    ...comment,
    id: cid,
    ownerId: uid,
  };
  acc.updatedAt = new Date().toISOString();
  persistCloudDb();
  return res.json({ ok: true, comment: acc.comments[cid] });
});

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
