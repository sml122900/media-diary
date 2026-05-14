/**
 * @file reportTemplates.js
 * 리포트 템플릿 CRUD + 항목 목록 + AI 커스터마이징 (Phase 10.6)
 * GET    /api/reports/components        — 사용 가능한 16개 항목 목록
 * GET    /api/reports/templates         — 내 템플릿 목록
 * POST   /api/reports/templates         — 템플릿 저장
 * PUT    /api/reports/templates/:id     — 템플릿 수정
 * DELETE /api/reports/templates/:id     — 템플릿 삭제
 * POST   /api/reports/customize-chat   — AI로 항목 자동 선택 (2토큰)
 */

const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const pool = require('../db');
const auth = require('../middleware/auth');
const { requireTokens, deductTokens } = require('../middleware/tokenCheck');

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 리포트 항목 정의 (16개)
const REPORT_COMPONENTS = {
  basic_count:        { name: '총 감상 작품 수',        desc: '이번 달 카테고리별(영화·드라마·애니) 작품 수' },
  avg_rating:         { name: '평균 별점',               desc: '이번 달 평균 별점 및 별점 경향' },
  top_genres:         { name: '선호 장르 TOP 3',         desc: '가장 자주 본 장르와 비율' },
  top_directors:      { name: '자주 찾은 감독',          desc: '이번 달 가장 많이 본 감독' },
  best_of_month:      { name: '이달의 인생작 후보',      desc: '★5 또는 최고 별점 작품 소개' },
  yoy_change:         { name: '작년 동기 대비',           desc: '작년 같은 달과 감상 수·별점 비교' },
  avg_year:           { name: '본 작품 평균 연도',        desc: '클래식 vs 최신작 선호도 분석' },
  longest_watch:      { name: '긴 시청 시간 작품',       desc: '런타임 기준 상위 작품' },
  memorable_review:   { name: '인상 깊은 한 줄 평',      desc: '이번 달 가장 길게·열정적으로 쓴 리뷰' },
  new_genre:          { name: '새로 시도한 장르',        desc: '기존에 잘 안 보던 장르 발견' },
  watch_patterns:     { name: '시청 패턴 분석',          desc: '요일별·시간대별 시청 분포' },
  mood_stats:         { name: '무드 통계',               desc: '시청 시 기분(즐거운/슬픈/감동 등) 분포' },
  context_stats:      { name: '시청 컨텍스트',           desc: '혼자 vs 함께, 장소별 시청 비율' },
  rewatch_stats:      { name: '재시청 통계',             desc: '이번 달 다시 본 작품과 재시청 이유' },
  rating_distribution:{ name: '별점 분포',               desc: '★1~5 분포 그래프와 평균 변화' },
  top_watched_with:   { name: '함께 본 사람 통계',       desc: '누구와 가장 많이 시청했는지 분석' },
};

// 항목 코드 → 프롬프트 지시문 변환
const COMPONENT_PROMPTS = {
  basic_count:        '이번 달 총 감상 작품 수를 영화·드라마·애니 카테고리별로 분석하세요.',
  avg_rating:         '이번 달 평균 별점을 계산하고 별점 경향(짜다/관대하다)을 분석하세요.',
  top_genres:         '가장 자주 등장한 장르 TOP 3를 비율과 함께 설명하세요.',
  top_directors:      '이번 달 2편 이상 본 감독이 있다면 언급하고 취향을 분석하세요.',
  best_of_month:      '★5 작품 또는 가장 높은 별점을 받은 작품을 "이달의 인생작"으로 소개하세요.',
  yoy_change:         '기록에서 연도 차이를 분석하거나, 이번 달의 특이한 변화를 언급하세요.',
  avg_year:           '감상 목록의 개봉·방영 연도를 분석해 클래식 vs 최신작 선호도를 파악하세요.',
  longest_watch:      '드라마·시리즈 중 긴 작품이나 영화 런타임이 긴 작품을 언급하세요.',
  memorable_review:   '리뷰 메모가 있는 작품 중 가장 인상 깊은 한 줄을 인용하고 분석하세요.',
  new_genre:          '평소 자주 안 보던 장르를 새로 시도했다면 그 발견을 강조하세요.',
  watch_patterns:     '시청 날짜 패턴에서 특이점(주말 집중, 특정 시기 등)을 찾아 언급하세요.',
  mood_stats:         '시청 컨텍스트의 mood 정보가 있다면 기분 패턴을 분석하세요.',
  context_stats:      '혼자·함께·특별한 장소에서 본 작품 정보가 있다면 컨텍스트를 분석하세요.',
  rewatch_stats:      '재시청 작품이 있다면 왜 다시 봤을지 분석하고 인상을 남기세요.',
  rating_distribution:'별점 1~5점 분포를 분석하고 사용자의 별점 패턴을 파악하세요.',
  top_watched_with:   '함께 본 사람(companion_names) 정보가 있다면 시청 파트너를 언급하세요.',
};

/**
 * GET /api/reports/components
 * 사용 가능한 리포트 항목 목록 반환
 */
router.get('/components', auth, (req, res) => {
  const list = Object.entries(REPORT_COMPONENTS).map(([code, info]) => ({
    code, ...info,
  }));
  res.json({ success: true, data: list });
});

/**
 * GET /api/reports/templates
 * 내 템플릿 목록
 */
router.get('/templates', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, components, is_default, created_at
       FROM report_templates WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/reports/templates
 * 새 템플릿 저장
 * body: { name, components: ['basic_count', ...], is_default? }
 */
router.post('/templates', auth, async (req, res) => {
  const { name, components, is_default = false } = req.body;
  if (!name?.trim()) return res.status(400).json({ success: false, message: '템플릿 이름을 입력해주세요.' });
  if (!Array.isArray(components) || components.length === 0) {
    return res.status(400).json({ success: false, message: '항목을 하나 이상 선택해주세요.' });
  }

  // 유효한 항목 코드만 허용
  const validCodes = components.filter(c => REPORT_COMPONENTS[c]);

  try {
    // 기본 템플릿으로 설정하면 기존 기본 해제
    if (is_default) {
      await pool.query(
        'UPDATE report_templates SET is_default = false WHERE user_id = $1',
        [req.user.id]
      );
    }
    const { rows } = await pool.query(
      `INSERT INTO report_templates (user_id, name, components, is_default)
       VALUES ($1, $2, $3::jsonb, $4) RETURNING *`,
      [req.user.id, name.trim(), JSON.stringify(validCodes), is_default]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/reports/templates/:id
 * 템플릿 수정
 */
router.put('/templates/:id', auth, async (req, res) => {
  const { name, components, is_default } = req.body;
  try {
    if (is_default) {
      await pool.query(
        'UPDATE report_templates SET is_default = false WHERE user_id = $1',
        [req.user.id]
      );
    }
    const validCodes = Array.isArray(components)
      ? components.filter(c => REPORT_COMPONENTS[c])
      : undefined;

    const { rows } = await pool.query(
      `UPDATE report_templates
       SET name = COALESCE($1, name),
           components = COALESCE($2::jsonb, components),
           is_default = COALESCE($3, is_default),
           updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [name?.trim() || null, validCodes ? JSON.stringify(validCodes) : null,
       is_default ?? null, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: '템플릿을 찾을 수 없습니다.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/reports/templates/:id
 * 템플릿 삭제
 */
router.delete('/templates/:id', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM report_templates WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/reports/preview
 * 선택한 항목으로 미리보기 리포트 생성 (DB 저장 없음, 5토큰)
 * body: { components: ['basic_count', ...], period?: 'YYYY-MM' }
 */
router.post('/preview', auth, requireTokens(5, 'report'), async (req, res) => {
  const { components, period } = req.body;
  if (!Array.isArray(components) || components.length === 0) {
    return res.status(400).json({ success: false, message: '항목을 하나 이상 선택해주세요.' });
  }

  const now = new Date();
  const targetPeriod = (period && /^\d{4}-\d{2}$/.test(period))
    ? period
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const validComponents = components.filter(c => REPORT_COMPONENTS[c]);

  try {
    // 해당 기간 감상 항목 조회
    const { rows: periodItems } = await pool.query(
      `SELECT title, year, type, director, rating, review_text
       FROM user_media
       WHERE user_id = $1
         AND watched_at >= $2::date
         AND watched_at < ($2::date + INTERVAL '1 month')
       ORDER BY watched_at DESC`,
      [req.user.id, targetPeriod + '-01']
    );

    const { rows: fallbackItems } = periodItems.length === 0
      ? await pool.query(
          `SELECT title, year, type, director, rating, review_text
           FROM user_media
           WHERE user_id = $1 AND (rating > 0 OR review_text <> '')
           ORDER BY created_at DESC LIMIT 30`,
          [req.user.id]
        )
      : { rows: [] };

    const items = periodItems.length > 0 ? periodItems : fallbackItems;

    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        message: '미리보기를 생성할 감상 기록이 없습니다.',
      });
    }

    const [y, m] = targetPeriod.split('-');
    const periodLabel = periodItems.length > 0 ? `${y}년 ${parseInt(m)}월` : '최근 감상 기록';
    const TYPE_LABEL = { movie: '영화', anime: '애니메이션', drama: '드라마' };

    const avgRating = items.filter(i => i.rating > 0).length > 0
      ? (items.filter(i => i.rating > 0).reduce((s, i) => s + i.rating, 0) /
         items.filter(i => i.rating > 0).length).toFixed(1)
      : '-';

    const itemsText = items.map(i => {
      const parts = [
        `- ${i.title} (${i.year || '?'}, ${TYPE_LABEL[i.type] || i.type})`,
        i.director ? `  감독: ${i.director}` : null,
        i.rating > 0 ? `  별점: ${'★'.repeat(i.rating)}` : null,
        i.review_text ? `  감상: ${i.review_text.slice(0, 80)}` : null,
      ].filter(Boolean);
      return parts.join('\n');
    }).join('\n\n');

    const componentInstructions = '선택된 분석 항목:\n' +
      validComponents.map(c => `- ${COMPONENT_PROMPTS[c] || c}`).join('\n');

    const message = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `당신은 영화·드라마·애니 감상 분석 전문가입니다.
아래 감상 기록을 바탕으로 한국어 마크다운 리포트를 작성해주세요.
따뜻하고 통찰력 있는 문체로, 사용자가 자신의 취향을 발견하도록 도와주세요.

[분석 대상]
기간: ${periodLabel}
총 ${items.length}편 (평균 별점: ${avgRating})

[감상 목록]
${itemsText}

[리포트 지시사항]
제목: ## ${periodLabel} 감상 리포트 (미리보기)

${componentInstructions}

각 항목을 ### 제목으로 구분하고, 감상 목록에서 실제 데이터를 근거로 분석하세요.
데이터가 부족한 항목은 가능한 범위에서 추론하세요.`,
      }],
    });

    deductTokens(req.user.id, req.tokenInfo, {
      input_tokens: message.usage?.input_tokens,
      output_tokens: message.usage?.output_tokens,
    }).catch(err => console.error('토큰 차감 실패 (preview):', err.message));

    res.json({ success: true, data: { content: message.content[0].text } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/reports/customize-chat
 * 자연어 설명 → 항목 코드 자동 선택 (2토큰)
 * body: { description: "장르 변화에 집중한 리포트" }
 */
router.post('/customize-chat', auth, requireTokens(2, 'report_chat'), async (req, res) => {
  const { description } = req.body;
  if (!description?.trim()) {
    return res.status(400).json({ success: false, message: '설명을 입력해주세요.' });
  }

  const codeList = Object.entries(REPORT_COMPONENTS)
    .map(([code, { name, desc }]) => `- ${code}: ${name} (${desc})`)
    .join('\n');

  try {
    const message = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `사용자가 원하는 리포트 스타일을 설명합니다. 아래 항목 코드 목록에서 가장 적절한 4~8개를 선택해주세요.

[사용 가능한 항목]
${codeList}

[사용자 설명]
"${description}"

선택한 코드를 JSON 배열로만 응답하세요. 예: ["basic_count","top_genres","avg_rating"]
다른 텍스트·설명 없이 JSON만 출력하세요.`,
      }],
    });

    // AI 호출 성공 → 토큰 차감
    deductTokens(req.user.id, req.tokenInfo, {
      input_tokens: message.usage?.input_tokens,
      output_tokens: message.usage?.output_tokens,
    }).catch(err => console.error('토큰 차감 실패 (report_chat):', err.message));

    let selected = [];
    try {
      const text = message.content[0].text.trim();
      const match = text.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(match ? match[0] : text);
      selected = parsed.filter(c => REPORT_COMPONENTS[c]);
    } catch {
      selected = Object.keys(REPORT_COMPONENTS).slice(0, 5);
    }

    res.json({ success: true, data: { components: selected } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = { router, REPORT_COMPONENTS, COMPONENT_PROMPTS };
