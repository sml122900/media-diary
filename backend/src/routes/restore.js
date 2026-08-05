/**
 * @file restore.js
 * AI 대화형 기억 복원 API (Phase 6.2)
 * POST /api/restore/chat  — Claude에게 메시지 전송, 작품 제안 수신
 * GET  /api/restore/chat/history — 대화 히스토리 조회
 * POST /api/restore/chat/accept  — 제안 작품 일괄 수락(추가)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const pool = require('../db');
const auth = require('../middleware/auth');
const { requireTokens, deductTokens } = require('../middleware/tokenCheck');

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// CSV 업로드용 multer 설정
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const csvUpload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.originalname.toLowerCase().endsWith('.csv') || file.mimetype.includes('csv') || file.mimetype.includes('excel');
    ok ? cb(null, true) : cb(new Error('CSV 파일만 업로드 가능합니다.'));
  },
});
const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';

// Claude가 반드시 호출해야 하는 작품 제안 도구 정의
const SUGGEST_TOOL = {
  name: 'suggest_works',
  description: '사용자에게 작품을 추천할 때 반드시 이 도구를 사용하세요. 작품 목록과 메시지를 함께 반환합니다.',
  input_schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: '사용자에게 전달할 친근한 한국어 메시지 (작품 소개 포함)',
      },
      works: {
        type: 'array',
        description: '추천 작품 목록 (5~10개)',
        items: {
          type: 'object',
          properties: {
            title:          { type: 'string',  description: '한국어 제목 (한국 서비스용)' },
            original_title: { type: 'string',  description: '원제 (영어/일어 등, TMDB 검색 정확도 향상용)' },
            year:           { type: 'integer', description: '개봉/방영 연도' },
            tmdb_type:      { type: 'string',  enum: ['movie', 'tv'], description: 'TMDB 검색 유형' },
            media_type:     { type: 'string',  enum: ['movie', 'anime', 'drama'], description: '앱 내 분류' },
            reason:         { type: 'string',  description: '추천 이유 한 줄' },
          },
          required: ['title', 'year', 'tmdb_type', 'media_type'],
        },
      },
    },
    required: ['message', 'works'],
  },
};

/**
 * TMDB 제목+연도 검색 — 첫 번째 결과의 id, poster_path 반환
 */
async function searchTmdb(title, year, tmdbType) {
  const endpoint = tmdbType === 'tv' ? '/search/tv' : '/search/movie';
  const yearParam = tmdbType === 'tv' ? `&first_air_date_year=${year}` : `&year=${year}`;
  const query = encodeURIComponent(title);

  try {
    const res = await fetch(
      `${TMDB_BASE}${endpoint}?api_key=${TMDB_KEY}&query=${query}${yearParam}&language=ko-KR`
    );
    const data = await res.json();
    if (data.results?.length) {
      const r = data.results[0];
      return { tmdb_id: r.id, poster_path: r.poster_path || null };
    }
    // 연도 없이 재시도
    const res2 = await fetch(
      `${TMDB_BASE}${endpoint}?api_key=${TMDB_KEY}&query=${query}&language=ko-KR`
    );
    const data2 = await res2.json();
    if (data2.results?.length) {
      const r = data2.results[0];
      return { tmdb_id: r.id, poster_path: r.poster_path || null };
    }
  } catch (_) {}
  return { tmdb_id: 0, poster_path: null };
}

/**
 * POST /api/restore/chat
 * 사용자 메시지 → Claude 호출 → 작품 제안 반환
 * body: { message: string }
 */
router.post('/chat', auth, requireTokens(2, 'chat'), async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) {
    return res.status(400).json({ success: false, message: '메시지를 입력해주세요.' });
  }

  try {
    // 사용자가 이미 추가한 작품 목록 조회 (중복 방지용)
    const { rows: existingMedia } = await pool.query(
      `SELECT title, year, type FROM user_media
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [req.user.id]
    );
    const existingList = existingMedia
      .map(m => `${m.title} (${m.year})`)
      .join(', ');

    // 최근 대화 히스토리 조회 (최대 10턴 = 20개 메시지)
    const { rows: historyRows } = await pool.query(
      `SELECT role, content FROM memory_chats
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );
    // 시간 역순이므로 뒤집기
    const history = historyRows.reverse().map(r => ({
      role: r.role,
      content: r.content,
    }));

    // 시스템 프롬프트
    const systemPrompt = `당신은 사용자가 과거에 본 영화·드라마·애니메이션을 기억해내도록 돕는 친근한 AI입니다.

사용자의 막연한 기억을 구체적인 작품으로 변환하세요.

규칙:
1. 항상 suggest_works 도구를 호출해 5~10개의 구체적인 작품을 제안하세요.
2. 제안 작품은 사용자 기억과 관련성이 높은 것들로 선정하세요.
3. 이미 사용자 목록에 있는 작품은 제안하지 마세요.
4. 한국 사용자이므로 한국어 제목을 우선 사용하세요.
5. 연도는 정확하게 기입하세요.

사용자가 이미 목록에 추가한 작품 (제안 제외):
${existingList || '(없음)'}`;

    // Claude 호출
    const claudeRes = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        ...history,
        { role: 'user', content: message },
      ],
      tools: [SUGGEST_TOOL],
      tool_choice: { type: 'any' }, // 반드시 도구 호출
    });

    // tool_use 블록 추출
    const toolUse = claudeRes.content.find(b => b.type === 'tool_use');
    if (!toolUse) {
      throw new Error('Claude가 도구를 호출하지 않았습니다.');
    }

    const { message: aiMessage, works: rawWorks } = toolUse.input;

    // 각 작품을 TMDB에서 검색해 tmdb_id / poster_path 보강
    const enrichedWorks = await Promise.all(
      rawWorks.map(async (w) => {
        // original_title이 있으면 TMDB 검색에 우선 사용
        const searchTitle = w.original_title || w.title;
        const { tmdb_id, poster_path } = await searchTmdb(searchTitle, w.year, w.tmdb_type);
        return {
          title: w.title,
          year: w.year,
          tmdb_type: w.tmdb_type,
          media_type: w.media_type,
          reason: w.reason || '',
          tmdb_id,
          poster_path,
        };
      })
    );

    // 대화 히스토리 저장
    await pool.query(
      `INSERT INTO memory_chats (user_id, role, content) VALUES ($1, 'user', $2)`,
      [req.user.id, message]
    );
    await pool.query(
      `INSERT INTO memory_chats (user_id, role, content, suggested_works)
       VALUES ($1, 'assistant', $2, $3::jsonb)`,
      [req.user.id, aiMessage, JSON.stringify(enrichedWorks)]
    );

    // 사용자에게 돌려줄 응답이 확정된 뒤에 차감한다.
    // 차감 후에도 TMDB 보강·대화 저장이 남아 있으면 거기서 터졌을 때
    // 500을 받으면서 토큰만 빠진다 (실패해도 사용자 응답은 정상 반환)
    deductTokens(req.user.id, req.tokenInfo, {
      input_tokens: claudeRes.usage?.input_tokens,
      output_tokens: claudeRes.usage?.output_tokens,
    }).catch(err => console.error('토큰 차감 실패 (chat):', err.message));

    res.json({
      success: true,
      data: {
        message: aiMessage,
        works: enrichedWorks,
        token_balance: req.tokenInfo.balance - req.tokenInfo.required,
      },
    });
  } catch (err) {
    console.error('restore/chat 오류:', err.message);
    res.status(500).json({ success: false, message: '작품 기억 복원 중 오류가 발생했습니다.' });
  }
});

/**
 * GET /api/restore/chat/history
 * 최근 대화 히스토리 조회 (최대 50건)
 */
router.get('/chat/history', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, role, content, suggested_works, created_at
       FROM memory_chats
       WHERE user_id = $1
       ORDER BY created_at ASC
       LIMIT 100`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/restore/chat/accept
 * AI 제안 작품 중 선택한 것들을 user_media에 일괄 추가
 * body: { works: [{ title, year, tmdb_id, tmdb_type, media_type, poster_path }] }
 */
router.post('/chat/accept', auth, async (req, res) => {
  const { works } = req.body;
  if (!Array.isArray(works) || works.length === 0) {
    return res.status(400).json({ success: false, message: 'works 배열이 필요합니다.' });
  }

  let added = 0;
  let skipped = 0;

  for (const w of works) {
    // 중복 체크 (tmdb_id 일치 OR title+year 일치 — tmdb_id가 있어도 title+year로도 대조)
    const { rows: existing } = await pool.query(
      `SELECT id FROM user_media
       WHERE user_id = $1 AND ((tmdb_id = $2 AND tmdb_id > 0) OR (title = $3 AND year = $4))`,
      [req.user.id, w.tmdb_id || 0, w.title, w.year || 0]
    );

    if (existing.length > 0) { skipped++; continue; }

    const posterUrl = w.poster_path
      ? `https://image.tmdb.org/t/p/w500${w.poster_path}`
      : '';

    try {
      await pool.query(
        `INSERT INTO user_media
           (user_id, type, title, year, tmdb_id, poster_url, rewatch_count)
         VALUES ($1, $2, $3, $4, $5, $6, 1)`,
        [req.user.id, w.media_type || 'movie', w.title,
         w.year || 0, w.tmdb_id || 0, posterUrl]
      );
      added++;
    } catch (err) {
      console.error('accept insert 실패:', err.message);
      skipped++;
    }
  }

  res.json({ success: true, data: { added, skipped } });
});

/**
 * DELETE /api/restore/chat/history
 * 대화 기록 전체 삭제
 */
router.delete('/chat/history', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM memory_chats WHERE user_id = $1', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Letterboxd CSV 가져오기 (Phase 6.5.2) ───────────────────────────────────

/** 간단한 CSV 한 줄 파서 (따옴표 필드 지원) */
function parseCsvLine(line) {
  const cols = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
    else { cur += ch; }
  }
  cols.push(cur.trim());
  return cols;
}

/**
 * Letterboxd CSV → 작품 배열 파싱
 * 형식: Date, Name, Year, Letterboxd URI, Rating, Rewatch, Tags, Watched Date
 */
function parseLetterboxdCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());
  const nameIdx   = header.findIndex(h => h === 'name');
  const yearIdx   = header.findIndex(h => h === 'year');
  const ratingIdx = header.findIndex(h => h === 'rating');
  const dateIdx   = header.findIndex(h => h === 'watched date' || h === 'date');

  if (nameIdx === -1) return [];

  return lines.slice(1).flatMap(line => {
    if (!line.trim()) return [];
    const cols  = parseCsvLine(line);
    const title = cols[nameIdx]?.replace(/^"|"$/g, '').trim();
    if (!title) return [];

    const year   = parseInt(cols[yearIdx]) || 0;
    const lbRate = parseFloat(cols[ratingIdx]) || 0;
    // Letterboxd 0.5~5.0 → 앱 내 1~5 (반올림)
    const rating = lbRate > 0 ? Math.min(5, Math.max(1, Math.round(lbRate))) : 0;
    const watchedDate = cols[dateIdx]?.trim() || null;

    return [{ title, year, rating, watchedDate }];
  });
}

/**
 * POST /api/restore/letterboxd-csv
 * Letterboxd 내보내기 CSV → TMDB 매칭 → user_media 일괄 추가
 * multipart: file (csv)
 */
router.post('/letterboxd-csv', auth, csvUpload.single('file'), async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'CSV 파일을 업로드해주세요.' });

    const text   = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseLetterboxdCsv(text);

    if (parsed.length === 0) {
      return res.json({ success: true, data: { added: 0, skipped: 0, failed: 0 },
        message: 'CSV에서 작품을 찾지 못했습니다. Letterboxd 내보내기 파일인지 확인해주세요.' });
    }

    // 미리보기 모드 (preview=1이면 DB 저장 없이 파싱 결과만 반환)
    if (req.query.preview === '1') {
      return res.json({ success: true, data: { preview: parsed.slice(0, 20), total: parsed.length } });
    }

    // 사용자 기존 목록 (중복 체크)
    const { rows: existing } = await pool.query(
      'SELECT tmdb_id, title, year FROM user_media WHERE user_id = $1',
      [req.user.id]
    );
    const existingTmdbIds = new Set(existing.map(r => r.tmdb_id).filter(id => id > 0));
    const existingTitleYears = new Set(existing.map(r => `${r.title.toLowerCase()}::${r.year}`));

    let added = 0, skipped = 0, failed = 0;

    for (const item of parsed) {
      // TMDB 검색 (영화 우선, 실패 시 TV)
      let tmdbResult = null;
      let tmdbType   = 'movie';
      for (const type of ['movie', 'tv']) {
        const yearParam = type === 'tv' ? 'first_air_date_year' : 'year';
        const qs = new URLSearchParams({ query: item.title, language: 'ko-KR', api_key: TMDB_KEY,
          ...(item.year ? { [yearParam]: item.year } : {}) });
        try {
          const r = await fetch(`${TMDB_BASE}/search/${type}?${qs}`);
          const d = await r.json();
          if (d.results?.length) { tmdbResult = d.results[0]; tmdbType = type; break; }
        } catch (_) {}
      }

      const tmdbId = tmdbResult?.id || 0;
      const title  = tmdbResult?.title || tmdbResult?.name || item.title;
      const year   = parseInt((tmdbResult?.release_date || tmdbResult?.first_air_date || '').slice(0, 4)) || item.year;

      // 중복 체크 (tmdb_id 일치 OR title+year 일치)
      const isDup = (tmdbId && existingTmdbIds.has(tmdbId)) || existingTitleYears.has(`${title.toLowerCase()}::${year}`);
      if (isDup) { skipped++; continue; }

      try {
        const posterUrl = tmdbResult?.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbResult.poster_path}` : '';
        const mediaType = tmdbType === 'movie' ? 'movie' : 'drama';
        const watchedAt = item.watchedDate ? `'${item.watchedDate}'::date` : null;

        await pool.query(
          `INSERT INTO user_media
             (user_id, type, title, year, tmdb_id, poster_url, rating, rewatch_count, watched_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 1, ${watchedAt ? `$8::date` : 'NULL'})`,
          watchedAt
            ? [req.user.id, mediaType, title, year, tmdbId, posterUrl, item.rating, item.watchedDate]
            : [req.user.id, mediaType, title, year, tmdbId, posterUrl, item.rating]
        );
        if (tmdbId) existingTmdbIds.add(tmdbId);
        existingTitleYears.add(`${title.toLowerCase()}::${year}`);
        added++;
      } catch (_) {
        failed++;
      }
    }

    res.json({ success: true, data: { added, skipped, failed, total: parsed.length } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
});

module.exports = router;
