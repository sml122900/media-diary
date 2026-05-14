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
const { requireTokens, deductTokens } = require('../middleware/tokenCheck');
const { getExtractionPrompt } = require('../services/screenshotPrompts');

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

/**
 * 제목 정규화 — 시즌/회차/괄호연도 제거
 * "기묘한 이야기 시즌 4" → "기묘한 이야기"
 * "타이타닉(1997)" → "타이타닉"
 */
function normalizeTitle(title) {
  return title
    .replace(/\s*시즌\s*\d+/g, '')
    .replace(/\s*Season\s*\d+/gi, '')
    .replace(/\s*S\d{1,2}E\d{1,2}/gi, '')
    .replace(/\s*\d+화/g, '')
    .replace(/\s*EP\.?\s*\d+/gi, '')
    .replace(/\(\d{4}\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * TMDB 단일 검색 헬퍼
 */
async function tmdbSearch(query, type, yearParam, year) {
  const params = { query, language: 'ko-KR', api_key: TMDB_KEY };
  if (year) params[yearParam] = year;
  const qs = new URLSearchParams(params);
  const res = await fetch(`${TMDB_BASE}/search/${type}?${qs}`);
  const data = await res.json();
  return data.results || [];
}

/**
 * TMDB 검색 — 4단계 전략
 * 1. 원본 제목 + 연도
 * 2. 정규화 제목 + 연도
 * 3. 원본 제목 (연도 없이)
 * 4. 정규화 제목 (연도 없이)
 * 5. 반대 타입으로 재시도 (정규화 제목)
 */
async function searchTmdb(title, year, tmdbType) {
  const type = tmdbType === 'movie' ? 'movie' : 'tv';
  const altType = type === 'movie' ? 'tv' : 'movie';
  const yearParam = type === 'tv' ? 'first_air_date_year' : 'year';
  const altYearParam = altType === 'tv' ? 'first_air_date_year' : 'year';
  const normalized = normalizeTitle(title);

  try {
    const strategies = [
      { q: title,      t: type,    y: year },
      { q: normalized, t: type,    y: year },
      { q: title,      t: type,    y: null },
      { q: normalized, t: type,    y: null },
      { q: normalized, t: altType, y: null },
    ];

    for (const s of strategies) {
      if (!s.q) continue;
      const yp = s.t === 'tv' ? 'first_air_date_year' : 'year';
      const results = await tmdbSearch(s.q, s.t, yp, s.y);
      if (results.length) return { result: results[0], type: s.t };
    }
  } catch (_) {}

  return null;
}

/**
 * 제목 유사도 계산 (0~1)
 * 완전 일치 > 포함 > 공통 글자 비율
 */
function titleSimilarity(a, b) {
  const na = a.toLowerCase().replace(/\s+/g, '');
  const nb = b.toLowerCase().replace(/\s+/g, '');
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  // 공통 글자 비율
  const setA = new Set(na.split(''));
  const common = nb.split('').filter(c => setA.has(c)).length;
  return common / Math.max(na.length, nb.length, 1);
}

/**
 * 매칭 신뢰도 계산 (0~1)
 * 제목 유사도 + 연도 일치 + 인기도 보정
 */
function calcConfidence(extracted, tmdbResult) {
  const tmdbTitle = tmdbResult.title || tmdbResult.name || '';
  const similarity = titleSimilarity(extracted.title, tmdbTitle);

  // 연도 일치 보너스
  const tmdbYear = parseInt((tmdbResult.release_date || tmdbResult.first_air_date || '').slice(0, 4)) || 0;
  const yearBonus = extracted.year && tmdbYear === extracted.year ? 0.1 : 0;

  // popularity 기반 기저 신뢰도
  const pop = tmdbResult.popularity || 0;
  const popBonus = pop > 100 ? 0.05 : pop > 30 ? 0.03 : 0;

  return Math.min(similarity + yearBonus + popBonus, 1.0);
}

/**
 * Claude Vision으로 이미지에서 작품 목록 추출 (구조화 JSON)
 */
async function extractWorksFromImage(imageBuffer, mediaType, ottType, ottDisplayName) {
  const base64Image = imageBuffer.toString('base64');
  const prompt = getExtractionPrompt(ottType, ottDisplayName);

  // Sonnet 4.6 — Haiku 대비 인식 정확도 대폭 향상 (Phase 10.3)
  const message = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
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
// Sonnet 업그레이드로 5토큰으로 조정 (Phase 10.3)
router.post('/', auth, requireTokens(5, 'screenshot'), upload.array('images', 10), async (req, res) => {
  const files = req.files || [];
  const filePaths = files.map(f => f.path);

  try {
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: '이미지를 1장 이상 업로드해주세요.' });
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

    // 각 이미지를 병렬 처리 (OTT 타입+표시명 전달)
    const perImageResults = await Promise.all(
      files.map(async (file) => {
        const imageBuffer = fs.readFileSync(file.path);
        const extracted = await extractWorksFromImage(imageBuffer, file.mimetype, ottType, ottHint);
        return extracted;
      })
    );

    // AI 호출 성공 → 토큰 차감 (실패해도 사용자 응답은 정상 반환)
    deductTokens(req.user.id, req.tokenInfo, {
      metadata: { image_count: files.length },
    }).catch(err => console.error('토큰 차감 실패 (screenshot):', err.message));

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
        const confidence = calcConfidence(extracted, tmdb);

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
