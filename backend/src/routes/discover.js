/**
 * @file discover.js
 * AI 채팅형 작품 추천 API (Phase 10.5)
 * POST /api/discover/chat         — 메시지 전송 → 추천 응답
 * GET  /api/discover/sessions     — 이전 대화 세션 목록
 * GET  /api/discover/history      — 세션별 대화 이력
 */

const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');
const pool = require('../db');
const auth = require('../middleware/auth');
const { requireTokens, deductTokens } = require('../middleware/tokenCheck');

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY  = process.env.TMDB_API_KEY;

// 추천 작품 제안 도구 (restore.js와 동일 구조)
const SUGGEST_TOOL = {
  name: 'suggest_works',
  description: '사용자에게 작품을 추천할 때 반드시 이 도구를 사용하세요.',
  input_schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: '사용자에게 전달할 한국어 메시지 (추천 이유·다음 질문 포함)',
      },
      works: {
        type: 'array',
        description: '추천 작품 목록 (0~8개, 아직 좁히는 단계면 빈 배열 가능)',
        items: {
          type: 'object',
          properties: {
            title:          { type: 'string',  description: '한국어 제목' },
            original_title: { type: 'string',  description: '원제 (TMDB 검색 정확도용)' },
            year:           { type: 'integer', description: '개봉·방영 연도' },
            tmdb_type:      { type: 'string',  enum: ['movie', 'tv'] },
            media_type:     { type: 'string',  enum: ['movie', 'anime', 'drama'] },
            reason:         { type: 'string',  description: '이 작품을 추천하는 이유 한 줄' },
          },
          required: ['title', 'year', 'tmdb_type', 'media_type'],
        },
      },
    },
    required: ['message', 'works'],
  },
};

/** TMDB 제목 검색 — 포스터 + ID 반환 */
async function searchTmdb(title, year, tmdbType) {
  const type = tmdbType === 'tv' ? 'tv' : 'movie';
  const yearParam = type === 'tv' ? 'first_air_date_year' : 'year';
  try {
    const qs = new URLSearchParams({
      api_key: TMDB_KEY, query: title, language: 'ko-KR',
      ...(year ? { [yearParam]: year } : {}),
    });
    const res  = await fetch(`${TMDB_BASE}/search/${type}?${qs}`);
    const data = await res.json();
    if (data.results?.length) {
      const r = data.results[0];
      return { tmdb_id: r.id, poster_path: r.poster_path || null };
    }
    // 연도 없이 재시도
    const qs2  = new URLSearchParams({ api_key: TMDB_KEY, query: title, language: 'ko-KR' });
    const res2 = await fetch(`${TMDB_BASE}/search/${type}?${qs2}`);
    const d2   = await res2.json();
    if (d2.results?.length) {
      const r = d2.results[0];
      return { tmdb_id: r.id, poster_path: r.poster_path || null };
    }
  } catch (_) {}
  return { tmdb_id: 0, poster_path: null };
}

/**
 * POST /api/discover/chat
 * 사용자 메시지 → Claude 큐레이터 → 추천 작품 반환
 * body: { message, sessionId? }
 */
router.post('/chat', auth, requireTokens(2, 'discover_chat'), async (req, res) => {
  const { message, sessionId: clientSessionId } = req.body;
  if (!message?.trim()) {
    return res.status(400).json({ success: false, message: '메시지를 입력해주세요.' });
  }

  // sessionId 없으면 신규 세션 생성
  const sessionId = clientSessionId || randomUUID();

  try {
    // 이미 본 작품 목록 (추천 제외용)
    const { rows: watchedRows } = await pool.query(
      `SELECT title, year, type FROM user_media
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 300`,
      [req.user.id]
    );
    const watchedList = watchedRows.map(m => `${m.title} (${m.year})`).join(', ');

    // 취향 프로필 (장르 가중치)
    const { rows: profileRows } = await pool.query(
      'SELECT genres, avg_rating FROM user_taste_profile WHERE user_id = $1',
      [req.user.id]
    );
    const topGenres = profileRows[0]?.genres
      ? Object.entries(profileRows[0].genres)
          .sort(([, a], [, b]) => b - a).slice(0, 5)
          .map(([g]) => g).join(', ')
      : '';

    // 이 세션의 이전 대화 (최근 10개)
    const { rows: historyRows } = await pool.query(
      `SELECT role, content FROM discovery_chats
       WHERE user_id = $1 AND session_id = $2
       ORDER BY created_at DESC LIMIT 10`,
      [req.user.id, sessionId]
    );
    const history = historyRows.reverse().map(r => ({ role: r.role, content: r.content }));

    // 시스템 프롬프트 — 단계적으로 좁혀가는 큐레이터
    const systemPrompt = `당신은 사용자의 영화·드라마·애니메이션 취향을 파악해서 완벽한 다음 작품을 찾아주는 전문 큐레이터입니다.

[대화 전략 — 반드시 따르기]
1. 사용자의 현재 기분·원하는 분위기 파악
2. 좋아하는 장르·국가·시대 확인
3. 이미 본 비슷한 작품 기반으로 좁히기
4. 구체적인 후보 1~3편으로 압축
5. 각 추천에 명확한 이유 제시

항상 다음 단계 질문을 포함하고, 대화를 통해 점점 더 맞춤화된 추천을 제공하세요.
한국어로만 답변하세요. 친근하고 열정적인 톤을 유지하세요.

[사용자 정보]
선호 장르: ${topGenres || '아직 파악 안 됨'}
이미 본 작품 (절대 추천 금지): ${watchedList || '(없음)'}`;

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
      tool_choice: { type: 'any' },
    });

    const toolUse = claudeRes.content.find(b => b.type === 'tool_use');
    if (!toolUse) throw new Error('Claude가 도구를 호출하지 않았습니다.');

    const { message: aiMessage, works: rawWorks } = toolUse.input;

    // TMDB 검색으로 포스터·ID 보강
    const enrichedWorks = await Promise.all(
      (rawWorks || []).map(async (w) => {
        const searchTitle = w.original_title || w.title;
        const { tmdb_id, poster_path } = await searchTmdb(searchTitle, w.year, w.tmdb_type);
        return {
          title: w.title, year: w.year,
          tmdb_type: w.tmdb_type, media_type: w.media_type,
          reason: w.reason || '',
          tmdb_id, poster_path,
        };
      })
    );

    // 대화 저장
    await pool.query(
      `INSERT INTO discovery_chats (user_id, role, content, session_id)
       VALUES ($1, 'user', $2, $3)`,
      [req.user.id, message, sessionId]
    );
    await pool.query(
      `INSERT INTO discovery_chats
         (user_id, role, content, suggested_works, session_id)
       VALUES ($1, 'assistant', $2, $3::jsonb, $4)`,
      [req.user.id, aiMessage, JSON.stringify(enrichedWorks), sessionId]
    );

    // 사용자에게 돌려줄 응답이 확정된 뒤에 차감한다.
    // 차감 후에도 대화 저장이 남아 있으면 INSERT가 터졌을 때
    // 500을 받으면서 토큰만 빠진다 (실패해도 사용자 응답은 정상 반환)
    deductTokens(req.user.id, req.tokenInfo, {
      input_tokens: claudeRes.usage?.input_tokens,
      output_tokens: claudeRes.usage?.output_tokens,
    }).catch(err => console.error('토큰 차감 실패 (discover_chat):', err.message));

    res.json({
      success: true,
      data: {
        sessionId,
        message: aiMessage,
        works: enrichedWorks,
        token_balance: req.tokenInfo.balance - req.tokenInfo.required,
      },
    });
  } catch (err) {
    console.error('discover/chat 오류:', err.message);
    res.status(500).json({ success: false, message: '추천 중 오류가 발생했습니다.' });
  }
});

/**
 * GET /api/discover/sessions
 * 이전 대화 세션 목록 — 세션별 첫 메시지 미리보기 + 시간
 */
router.get('/sessions', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (session_id)
         session_id,
         content  AS preview,
         created_at
       FROM discovery_chats
       WHERE user_id = $1 AND role = 'user'
       ORDER BY session_id, created_at ASC`,
      [req.user.id]
    );
    // 최신 세션 순으로 정렬
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/discover/history?sessionId=
 * 특정 세션의 대화 이력
 */
router.get('/history', auth, async (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) {
    return res.status(400).json({ success: false, message: 'sessionId가 필요합니다.' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, role, content, suggested_works, created_at
       FROM discovery_chats
       WHERE user_id = $1 AND session_id = $2
       ORDER BY created_at ASC`,
      [req.user.id, sessionId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
