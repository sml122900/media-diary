/**
 * @file importScreenshot.js
 * OTT 스크린샷 이미지 인식 API — Phase 6.3에서 강화
 * 멀티 이미지, OTT 종류 힌트, 구조화 추출 (제목+연도+타입), 매칭 신뢰도 반환
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const pool = require('../db');
const auth = require('../middleware/auth');

// 스크린샷 인식 일일 한도 (이미지 1장 = 1회 카운트)
const SCREENSHOT_DAILY_LIMIT = 20;

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = process.env.TMDB_API_KEY;
const IMG_BASE = 'https://image.tmdb.org/t/p/w300';

// 임시 업로드 디렉토리
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// multer — 이미지 최대 10장, 장당 5MB
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('이미지 파일만 업로드 가능합니다'));
  },
});

// OTT/극장 종류별 시스템 프롬프트 힌트
const OTT_HINTS = {
  netflix:    '넷플릭스(Netflix)',
  watcha:     '왓챠(Watcha)',
  tving:      '티빙(Tving)',
  disneyplus: '디즈니+(Disney+)',
  coupang:    '쿠팡플레이(Coupang Play)',
  wavve:      '웨이브(Wavve)',
  cgv:        'CGV 영화관 앱 (관람 내역)',
  megabox:    '메가박스 영화관 앱 (관람 내역)',
  lotte:      '롯데시네마 영화관 앱 (관람 내역)',
  other:      'OTT 또는 영화관 앱',
};

/** TMDB 검색 — 제목+연도+타입으로 가장 유사한 결과 반환 */
async function searchTmdb(title, year, tmdbType) {
  const type = tmdbType === 'movie' ? 'movie' : 'tv';
  const yearParam = type === 'tv' ? 'first_air_date_year' : 'year';

  try {
    // 연도 포함 검색
    if (year) {
      const qs = new URLSearchParams({ query: title, language: 'ko-KR', api_key: TMDB_KEY, [yearParam]: year });
      const res = await fetch(`${TMDB_BASE}/search/${type}?${qs}`);
      const data = await res.json();
      if (data.results?.length) return { result: data.results[0], type };
    }

    // 연도 없이 재검색
    const qs2 = new URLSearchParams({ query: title, language: 'ko-KR', api_key: TMDB_KEY });
    const res2 = await fetch(`${TMDB_BASE}/search/${type}?${qs2}`);
    const data2 = await res2.json();
    if (data2.results?.length) return { result: data2.results[0], type };

    // 반대 타입으로 재검색
    const altType = type === 'movie' ? 'tv' : 'movie';
    const qs3 = new URLSearchParams({ query: title, language: 'ko-KR', api_key: TMDB_KEY });
    const res3 = await fetch(`${TMDB_BASE}/search/${altType}?${qs3}`);
    const data3 = await res3.json();
    if (data3.results?.length) return { result: data3.results[0], type: altType };
  } catch (_) {}

  return null;
}

/**
 * 매칭 신뢰도 계산 (0~1)
 * Claude 추출 제목 vs TMDB 결과 제목 유사도 + 연도 일치 여부
 */
function calcConfidence(extracted, tmdbResult, matchedType) {
  const tmdbTitle = (tmdbResult.title || tmdbResult.name || '').toLowerCase();
  const extTitle = extracted.title.toLowerCase();

  // 제목 완전 일치
  if (tmdbTitle === extTitle) return 0.95;

  // 제목 포함 관계
  if (tmdbTitle.includes(extTitle) || extTitle.includes(tmdbTitle)) return 0.8;

  // 연도 일치 보너스
  const tmdbYear = parseInt((tmdbResult.release_date || tmdbResult.first_air_date || '').slice(0, 4)) || 0;
  const yearMatch = extracted.year && tmdbYear === extracted.year;

  // popularity 기반 fallback
  const pop = tmdbResult.popularity || 0;
  let base = pop > 50 ? 0.65 : pop > 10 ? 0.5 : 0.3;
  if (yearMatch) base = Math.min(base + 0.15, 0.9);

  return base;
}

/**
 * Claude Vision으로 이미지에서 작품 목록 추출 (구조화 JSON)
 */
async function extractWorksFromImage(imageBuffer, mediaType, ottHint) {
  const base64Image = imageBuffer.toString('base64');

  const prompt = `이 이미지는 ${ottHint} 화면의 스크린샷입니다.
이미지에서 영화·드라마·애니메이션 제목을 모두 찾아주세요.

다음 JSON 배열 형식으로만 응답하세요 (설명 없이):
[{"title":"제목","year":2023,"type":"movie"},{"title":"제목2","year":null,"type":"tv"}]

규칙:
- title: 화면에 보이는 제목 그대로 (한글이면 한글, 영어면 영어)
- year: 보이면 숫자, 안 보이면 null
- type: "movie"(영화) 또는 "tv"(드라마/애니)
- 제목이 없으면 []`;

  const message = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
        { type: 'text', text: prompt },
      ],
    }],
  });

  try {
    const text = message.content[0].text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    return [];
  }
}

/**
 * POST /api/import/screenshot
 * 멀티 이미지 업로드 → 구조화 추출 → TMDB 매칭 → 신뢰도 포함 반환
 * body (multipart): images[] + ott_type (optional)
 */
router.post('/', auth, upload.array('images', 10), async (req, res) => {
  const files = req.files || [];
  const filePaths = files.map(f => f.path);

  try {
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: '이미지를 1장 이상 업로드해주세요.' });
    }

    // 일일 한도 확인 (이미지 장수 기준)
    const { rows: uRows } = await pool.query(
      'SELECT daily_ai_calls, last_ai_reset_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const u = uRows[0];
    if (u) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const lastReset = u.last_ai_reset_at ? new Date(u.last_ai_reset_at).toISOString().slice(0, 10) : null;
      const needsReset = lastReset !== todayStr;
      const currentCount = needsReset ? 0 : (u.daily_ai_calls || 0);

      if (currentCount + files.length > SCREENSHOT_DAILY_LIMIT) {
        return res.status(429).json({
          success: false,
          message: `일일 인식 한도를 초과합니다. 오늘 남은 횟수: ${Math.max(0, SCREENSHOT_DAILY_LIMIT - currentCount)}장`,
        });
      }
      if (needsReset) {
        await pool.query(
          'UPDATE users SET daily_ai_calls = $1, last_ai_reset_at = NOW() WHERE id = $2',
          [files.length, req.user.id]
        );
      } else {
        await pool.query(
          'UPDATE users SET daily_ai_calls = daily_ai_calls + $1 WHERE id = $2',
          [files.length, req.user.id]
        );
      }
    }

    const ottType = (req.body.ott_type || 'other').toLowerCase();
    const ottHint = OTT_HINTS[ottType] || OTT_HINTS.other;

    // 사용자 기존 목록 (중복 체크용)
    const { rows: myItems } = await pool.query(
      'SELECT tmdb_id, title FROM user_media WHERE user_id = $1',
      [req.user.id]
    );
    const myTmdbIds = new Set(myItems.map(i => i.tmdb_id).filter(id => id > 0));
    const myTitles = new Set(myItems.map(i => i.title.toLowerCase()));

    // 각 이미지를 병렬 처리
    const perImageResults = await Promise.all(
      files.map(async (file) => {
        const imageBuffer = fs.readFileSync(file.path);
        const extracted = await extractWorksFromImage(imageBuffer, file.mimetype, ottHint);
        return extracted;
      })
    );

    // 전체 추출 결과 병합 + 제목 기준 중복 제거
    const seenTitles = new Set();
    const allExtracted = [];
    for (const works of perImageResults) {
      for (const w of works) {
        const key = w.title?.toLowerCase();
        if (key && !seenTitles.has(key)) {
          seenTitles.add(key);
          allExtracted.push(w);
        }
      }
    }

    if (allExtracted.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: '이미지에서 작품 제목을 찾지 못했습니다. OTT 시청 목록이나 작품 썸네일 화면을 사용해보세요.',
      });
    }

    // 각 추출 작품을 TMDB로 매칭 (병렬)
    const results = await Promise.all(
      allExtracted.map(async (extracted) => {
        const match = await searchTmdb(extracted.title, extracted.year, extracted.type);

        if (!match) {
          return {
            inputTitle: extracted.title,
            extractedYear: extracted.year,
            result: null,
            confidence: 0,
          };
        }

        const { result: tmdb, type: matchedType } = match;
        const confidence = calcConfidence(extracted, tmdb, matchedType);

        const tmdbTitle = tmdb.title || tmdb.name || extracted.title;
        const year = parseInt((tmdb.release_date || tmdb.first_air_date || '').slice(0, 4)) || extracted.year || 0;
        const inMyList = myTmdbIds.has(tmdb.id) || myTitles.has(tmdbTitle.toLowerCase());

        return {
          inputTitle: extracted.title,
          extractedYear: extracted.year,
          confidence,
          result: {
            tmdb_id: tmdb.id,
            title: tmdbTitle,
            year,
            type: matchedType === 'movie' ? 'movie' : 'drama',
            poster_url: tmdb.poster_path ? IMG_BASE + tmdb.poster_path : '',
            overview: (tmdb.overview || '').slice(0, 100),
            vote_average: tmdb.vote_average || 0,
            in_my_list: inMyList,
          },
        };
      })
    );

    // 신뢰도 내림차순 정렬
    results.sort((a, b) => b.confidence - a.confidence);

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    // 임시 파일 삭제
    for (const p of filePaths) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }
});

/**
 * GET /api/import/screenshot/search
 * 실패한 항목 수동 재검색용 TMDB 검색
 * query: ?q=제목&type=movie|tv
 */
router.get('/search', auth, async (req, res) => {
  const { q, type = 'movie' } = req.query;
  if (!q?.trim()) return res.status(400).json({ success: false, message: '검색어를 입력하세요.' });

  try {
    const tmdbType = type === 'tv' ? 'tv' : 'movie';
    const qs = new URLSearchParams({ query: q, language: 'ko-KR', api_key: TMDB_KEY });
    const res2 = await fetch(`${TMDB_BASE}/search/${tmdbType}?${qs}`);
    const data = await res2.json();

    const results = (data.results || []).slice(0, 5).map(r => ({
      tmdb_id: r.id,
      title: r.title || r.name,
      year: parseInt((r.release_date || r.first_air_date || '').slice(0, 4)) || 0,
      type: tmdbType === 'movie' ? 'movie' : 'drama',
      poster_url: r.poster_path ? IMG_BASE + r.poster_path : '',
    }));

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
