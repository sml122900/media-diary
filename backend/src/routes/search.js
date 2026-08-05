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
const { matchWork } = require('../utils/tmdbMatch');

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Claude가 반드시 호출해야 하는 도구.
 * 예전엔 텍스트로 JSON을 요청하고 정규식으로 뽑았는데, 스키마 강제가 없어
 * "Hong Kong noir 1990s"(장르 설명어)나 "Christopher Nolan"(인물명) 같은
 * 검색 불가능한 값이 그대로 내려왔다. TMDB는 제목 색인이라 그런 값은 0건이 된다.
 * 연도·원제를 required로 받아야 TMDB 매칭을 검증할 기준도 생긴다.
 */
const SUGGEST_TOOL = {
  name: 'suggest_works',
  description: '검색어에 맞는 실제 작품 목록을 제안한다',
  input_schema: {
    type: 'object',
    properties: {
      explanation: { type: 'string', description: '검색 해석 (한국어 15자 이내)' },
      works: {
        type: 'array',
        description: '실제로 존재하는 작품 3~8개',
        items: {
          type: 'object',
          properties: {
            title:          { type: 'string',  description: '한국어 제목 (없으면 통용 표기)' },
            original_title: { type: 'string',  description: '원제' },
            year:           { type: 'integer', description: '개봉·방영 연도' },
            tmdb_type:      { type: 'string',  enum: ['movie', 'tv'] },
          },
          required: ['title', 'original_title', 'year', 'tmdb_type'],
        },
      },
    },
    required: ['explanation', 'works'],
  },
};

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
    // TMDB는 제목 기반 검색이므로, 설명형 쿼리를 실제 작품명으로 변환해야 한다.
    // 예시로 실제 작품명을 들면 AI가 그 예시를 그대로 답으로 뱉는 회차가 있어
    // (사용자가 본 Arrival 결과가 그 사례로 보인다) 예시는 형식만 보여준다.
    const message = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `영화/드라마/애니 검색 도우미입니다.

검색어: "${query}"

이 검색어에 해당하는 **실제로 존재하는 작품**을 3~8개 제안하세요.
장르명·감독명·분위기 설명이 아니라 반드시 개별 작품의 제목이어야 합니다.
(예: "홍콩 느와르"가 아니라 그 장르의 실제 작품 제목들)
각 작품의 원제와 개봉 연도를 정확히 채우세요.
suggest_works 도구로만 답하세요.`,
      }],
      tools: [SUGGEST_TOOL],
      tool_choice: { type: 'any' }, // 반드시 도구 호출
    });

    const toolUse = message.content.find(b => b.type === 'tool_use');
    if (!toolUse) {
      throw new Error('Claude가 도구를 호출하지 않았습니다.');
    }

    const { explanation, works: rawWorks } = toolUse.input;

    // 각 작품을 TMDB에서 검증 — 매칭에 실패한 항목은 결과에서 뺀다.
    // 엉뚱한 동명 작품을 보여주느니 빼는 편이 낫다
    const matched = await Promise.all((rawWorks || []).slice(0, 8).map(w => matchWork(w)));

    const seen = new Set();
    const results = [];
    for (const m of matched) {
      if (!m || seen.has(m.tmdb_id)) continue;
      seen.add(m.tmdb_id);
      results.push({
        tmdb_id: m.tmdb_id,
        title: m.title,
        year: m.year,
        type: m.type,
        poster_url: m.poster_url,
        overview: m.overview,
        vote_average: m.vote_average,
      });
    }

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
