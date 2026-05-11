/**
 * @file search.js
 * AI 자연어 검색 API 라우터 (Phase 3.4)
 * Claude API로 의도 파악 → TMDB 검색 → 결과 반환
 */

const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const pool = require('../db');
const auth = require('../middleware/auth');

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = process.env.TMDB_API_KEY;
const IMG_BASE = 'https://image.tmdb.org/t/p/w300';
const DAILY_LIMIT = 20; // 사용자당 일일 AI 검색 제한

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** TMDB API GET 요청 */
async function tmdbGet(path, params = {}) {
  const qs = new URLSearchParams({ ...params, api_key: TMDB_KEY }).toString();
  const res = await fetch(`${TMDB_BASE}${path}?${qs}`);
  if (!res.ok) return null;
  return res.json();
}

/**
 * 사용자의 오늘 AI 검색 사용 횟수 확인 및 카운트 증가
 * 자정 기준으로 초기화 (last_ai_reset_at 기준)
 * @returns {{ allowed: boolean, remaining: number }}
 */
async function checkAndIncrementAiLimit(userId) {
  const { rows } = await pool.query(
    'SELECT daily_ai_calls, last_ai_reset_at FROM users WHERE id = $1',
    [userId]
  );
  const user = rows[0];
  if (!user) return { allowed: false, remaining: 0 };

  const now = new Date();
  const resetAt = user.last_ai_reset_at ? new Date(user.last_ai_reset_at) : null;

  // 오늘 자정이 지났으면 카운트 초기화
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const needsReset = !resetAt || resetAt < todayStart;

  if (needsReset) {
    await pool.query(
      'UPDATE users SET daily_ai_calls = 1, last_ai_reset_at = NOW() WHERE id = $1',
      [userId]
    );
    return { allowed: true, remaining: DAILY_LIMIT - 1 };
  }

  if (user.daily_ai_calls >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  await pool.query(
    'UPDATE users SET daily_ai_calls = daily_ai_calls + 1 WHERE id = $1',
    [userId]
  );
  return { allowed: true, remaining: DAILY_LIMIT - user.daily_ai_calls - 1 };
}

/**
 * POST /api/search/natural
 * 자연어 쿼리를 Claude API로 분석 → TMDB 검색 → 결과 반환
 * 요청: { query: "우주 배경의 잔잔한 SF 영화" }
 */
router.post('/natural', auth, async (req, res) => {
  const { query } = req.body;
  if (!query?.trim()) {
    return res.status(400).json({ success: false, message: '검색어를 입력해주세요' });
  }

  // 일일 사용 한도 확인
  const { allowed, remaining } = await checkAndIncrementAiLimit(req.user.id);
  if (!allowed) {
    return res.status(429).json({
      success: false,
      message: `일일 AI 검색 한도(${DAILY_LIMIT}회)에 도달했습니다. 내일 다시 시도해주세요.`,
    });
  }

  try {
    // Claude API로 검색 의도 분석
    // TMDB는 제목 기반 검색이므로, 설명형 쿼리는 대표 작품명으로 변환해야 함
    const message = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `영화/드라마/애니 검색 도우미입니다. TMDB는 제목으로 검색하므로 구체적인 작품명이 필요합니다.

검색어: "${query}"

다음 JSON만 출력하세요 (마크다운 없이, 설명 없이):
{"keywords":"영어 작품 제목 또는 핵심 단어 (TMDB에서 검색될 실제 제목, 예: Arrival, Parasite)","korean_keywords":"한국어 작품 제목 또는 키워드","type":"movie 또는 tv 또는 both","explanation":"검색 해석 (한국어 15자 이내)"}`,
      }],
    });

    // Claude 응답 파싱
    let parsed;
    try {
      const text = message.content[0].text.trim();
      // JSON 블록만 추출
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      // 파싱 실패 시 원본 쿼리로 fallback
      parsed = { keywords: query, korean_keywords: query, type: 'both', explanation: query };
    }

    const { keywords, korean_keywords, type, explanation } = parsed;

    // 쉼표 구분 키워드를 개별 검색어로 분리
    const kwList = keywords.split(',').map(k => k.trim()).filter(Boolean).slice(0, 4);
    const koKwList = korean_keywords
      ? korean_keywords.split(',').map(k => k.trim()).filter(Boolean).slice(0, 4)
      : [];

    const searchType = type === 'movie' ? ['movie'] : type === 'tv' ? ['tv'] : ['movie', 'tv'];
    const seen = new Set();
    const allResults = [];

    // 각 키워드를 개별 TMDB 검색 (영어+한국어)
    const searchTasks = [];
    for (const t of searchType) {
      for (const kw of kwList) {
        searchTasks.push(tmdbGet(`/search/${t}`, { query: kw, language: 'en-US' }));
      }
      for (const kw of koKwList) {
        searchTasks.push(tmdbGet(`/search/${t}`, { query: kw, language: 'ko-KR' }));
      }
    }

    const searchResults = await Promise.all(searchTasks);

    for (const data of searchResults) {
      for (const r of (data?.results || [])) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        allResults.push({
          tmdb_id: r.id,
          title: r.title || r.name || '',
          year: parseInt((r.release_date || r.first_air_date || '').slice(0, 4)) || 0,
          type: r.title ? 'movie' : 'drama',
          poster_url: r.poster_path ? IMG_BASE + r.poster_path : '',
          overview: r.overview || '',
          vote_average: r.vote_average || 0,
        });
      }
    }

    // 평점 순 정렬, 최대 8개
    const results = allResults
      .sort((a, b) => b.vote_average - a.vote_average)
      .slice(0, 8);

    res.json({
      success: true,
      data: results,
      meta: { explanation, remaining_calls: remaining },
    });
  } catch (err) {
    // Claude API 오류 시 카운트 롤백 (선택적 — 현재는 그냥 에러 반환)
    res.status(500).json({ success: false, message: 'AI 검색 중 오류가 발생했습니다: ' + err.message });
  }
});

module.exports = router;
