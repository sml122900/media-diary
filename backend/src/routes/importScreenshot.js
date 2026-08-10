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
const { requireTokens, deductTokens, logZeroUsage } = require('../middleware/tokenCheck');
const { getExtractionPrompt } = require('../services/screenshotPrompts');

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = process.env.TMDB_API_KEY;
const IMG_BASE = 'https://image.tmdb.org/t/p/w300';

// 임포트 무료화 플래그 (Phase 12.3) — 기본 무료, Render 환경변수 IMPORT_TOKEN_FREE=false로 유료 전환
const importTokenFree = () => process.env.IMPORT_TOKEN_FREE !== 'false';

/**
 * 임포트 토큰 게이트 — 무료 기간에는 잔액 부족이어도 통과시키고 req.tokenInfo.required=0으로 표시.
 * 유료 전환 시(IMPORT_TOKEN_FREE=false)는 기존 requireTokens(5, 'screenshot')과 동일하게 동작.
 */
async function screenshotTokenGate(req, res, next) {
  if (!importTokenFree()) return requireTokens(5, 'screenshot')(req, res, next);
  try {
    const { rows } = await pool.query('SELECT token_balance FROM users WHERE id = $1', [req.user.id]);
    req.tokenInfo = { required: 0, feature: 'import', balance: rows[0]?.token_balance ?? 0 };
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: '토큰 확인 중 오류가 발생했습니다.' });
  }
}

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
 * AI가 추출한 별점 값 검증 — 1~5 정수만 통과, 그 외(범위 밖·소수·문자열 등)는 null
 * (프롬프트가 1~5 정수 또는 null만 지시하지만 모델 출력은 신뢰하지 않고 방어)
 */
function normalizeRating(rating) {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
}

/**
 * 동시성 제한 병렬 map (Phase 12.3) — 워커 풀 방식, 순서 보존
 * @param {Array} items
 * @param {number} limit 동시 실행 개수
 * @param {(item: any, index: number) => Promise<any>} fn
 */
async function mapWithLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
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
    // max_tokens 4000 (Phase 12.3) — 실측 결과 title+year+type+rating 40개 응답이
    // pretty-print 기준 1667 토큰(compact 기준 876 토큰)이라 기존 1500으로는 40개
    // 언저리에서 잘림. 4000은 같은 밀도로 pretty-print 기준 약 95개까지 여유
    max_tokens: 4000,
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
// Sonnet 업그레이드로 5토큰으로 조정 (Phase 10.3), Phase 12.3에서 무료화 플래그 도입
router.post('/', auth, screenshotTokenGate, upload.array('images', 10), async (req, res) => {
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

    // 전체 추출 결과 병합 + (제목, 연도) 복합 기준 중복 제거
    // 연도가 없으면 제목만으로 판단 (동명이작을 연도 없이는 구분할 수 없음)
    const seenKeys = new Set();
    const allExtracted = [];
    for (const works of perImageResults) {
      for (const w of works) {
        const title = w.title?.toLowerCase();
        if (!title) continue;
        const key = w.year ? `${title}::${w.year}` : title;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          allExtracted.push(w);
        }
      }
    }

    // 한 장도 인식하지 못했으면 사용자에게 줄 결과가 없으므로 차감하지 않는다.
    // (차감 후 환급하는 방식은 deductTokens가 fire-and-forget이라 환급이 먼저
    //  커밋되면 잔액이 늘어나는 레이스가 생겨, 애초에 차감하지 않는 쪽을 택했다)
    if (allExtracted.length === 0) {
      logZeroUsage(req.user.id, 'screenshot', {
        image_count: files.length,
        empty_result: true,
      }).catch(err => console.error('빈 결과 로그 기록 실패 (screenshot):', err.message));

      return res.json({
        success: true,
        data: [],
        message: '이미지에서 작품 제목을 찾지 못했습니다. OTT 시청 목록이나 작품 썸네일 화면을 사용해보세요.',
        meta: { token_balance: req.tokenInfo.balance },  // 차감 없음 → 원래 잔액
      });
    }

    // 각 추출 작품을 TMDB로 매칭 — 동시 4개로 제한 병렬 처리 (Phase 12.3)
    // 항목 내부(searchTmdb)가 이미 최대 5단계 순차 요청이라, 동시 4개면 TMDB로
    // 나가는 순간 동시 요청은 최대 4건 — 별도 문서화된 rate limit은 없지만
    // 40개 항목을 한 번에 무제한 병렬로 쏘던 기존 방식보다 여유 있게 안전한 값
    const results = await mapWithLimit(allExtracted, 4, async (extracted) => {
      // 개별 항목에서 예외가 나도 이 항목만 매칭 실패로 처리 — 전체 배치 중단 금지
      try {
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
            rating: normalizeRating(extracted.rating),
          },
        };
      } catch (err) {
        return {
          inputTitle: extracted.title,
          extractedYear: extracted.year,
          result: null,
          confidence: 0,
        };
      }
    });

    // 신뢰도 내림차순 정렬
    results.sort((a, b) => b.confidence - a.confidence);

    // 임포트 무료화 기간 — 차감 없이 사용량만 관찰 기록 (기존 빈 결과 무차감 패턴과 동일)
    if (req.tokenInfo.required === 0) {
      logZeroUsage(req.user.id, 'import', {
        image_count: files.length, extracted_count: allExtracted.length,
      }).catch(err => console.error('임포트 무료 사용 로그 실패 (screenshot):', err.message));

      return res.json({
        success: true,
        data: results,
        meta: { token_balance: req.tokenInfo.balance },
      });
    }

    // 결과가 확정된 뒤에 차감 (실패해도 사용자 응답은 정상 반환).
    // 차감 후에도 TMDB 매칭이 남아 있으면 거기서 터졌을 때 500을 받으면서
    // 토큰만 빠진다. 일부 이미지만 인식된 경우도 결과가 있으므로 요청당 5토큰을 차감한다
    deductTokens(req.user.id, req.tokenInfo, {
      metadata: { image_count: files.length, extracted_count: allExtracted.length },
    }).catch(err => console.error('토큰 차감 실패 (screenshot):', err.message));

    res.json({
      success: true,
      data: results,
      meta: { token_balance: req.tokenInfo.balance - req.tokenInfo.required },
    });
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
