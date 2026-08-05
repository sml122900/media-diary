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
const { requireTokens, deductTokens, logZeroUsage } = require('../middleware/tokenCheck');

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = process.env.TMDB_API_KEY;
const IMG_BASE = 'https://image.tmdb.org/t/p/w300';

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** TMDB API GET 요청 — path 경로로 GET 요청 후 JSON 반환 */
async function tmdbGet(path, params = {}) {
  const qs = new URLSearchParams({ ...params, api_key: TMDB_KEY }).toString();
  const res = await fetch(`${TMDB_BASE}${path}?${qs}`);
  if (!res.ok) return null;
  return res.json();
}

/**
 * POST /api/search/natural
 * 자연어 쿼리를 Claude API로 분석 → TMDB 검색 → 결과 반환
 * 요청: { query: "우주 배경의 잔잔한 SF 영화" }
 */
router.post('/natural', auth, requireTokens(1, 'search'), async (req, res) => {
  const { query } = req.body;
  if (!query?.trim()) {
    return res.status(400).json({ success: false, message: '검색어를 입력해주세요' });
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

    // 한 건도 못 찾았으면 사용자에게 줄 결과가 없으므로 차감하지 않는다.
    // 0건은 작품이 없어서가 아니라 TMDB 제목 매칭이 실패해서 나는 경우가 있어,
    // 우리 쪽 실패를 과금하지 않는다는 뜻이다.
    // (스크린샷과 동일하게 환급이 아니라 차감 시점을 뒤로 미루는 방식 — deductTokens가
    //  fire-and-forget이라 환급 트랜잭션이 먼저 커밋되면 잔액이 늘어나는 레이스가 생긴다)
    if (results.length === 0) {
      logZeroUsage(req.user.id, 'search', {
        query: query.trim().slice(0, 100),  // 매칭 실패 쿼리 추적용
        empty_result: true,
      }).catch(err => console.error('빈 결과 로그 기록 실패 (search):', err.message));

      return res.json({
        success: true,
        data: [],
        meta: { explanation, token_balance: req.tokenInfo.balance },  // 차감 없음 → 원래 잔액
      });
    }

    // 결과가 있으면 차감 (실패해도 사용자 응답은 정상 반환)
    deductTokens(req.user.id, req.tokenInfo, {
      input_tokens: message.usage?.input_tokens,
      output_tokens: message.usage?.output_tokens,
    }).catch(err => console.error('토큰 차감 실패 (search):', err.message));

    res.json({
      success: true,
      data: results,
      meta: { explanation, token_balance: req.tokenInfo.balance - req.tokenInfo.required },
    });
  } catch (err) {
    // Claude API 오류 시 카운트 롤백 (선택적 — 현재는 그냥 에러 반환)
    res.status(500).json({ success: false, message: 'AI 검색 중 오류가 발생했습니다: ' + err.message });
  }
});

module.exports = router;
