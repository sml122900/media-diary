/**
 * @file reports.js
 * 월간 취향 리포트 API (Phase 3.5)
 * Claude API로 감상 기록 분석 → 마크다운 리포트 생성·저장·조회
 */

const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const pool = require('../db');
const auth = require('../middleware/auth');
const { requireTokens, deductTokens } = require('../middleware/tokenCheck');

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const TYPE_LABEL = { movie: '영화', anime: '애니메이션', drama: '드라마' };
const { REPORT_COMPONENTS, COMPONENT_PROMPTS } = require('./reportTemplates');

/**
 * 감상 기록 배열을 Claude 프롬프트용 텍스트로 변환
 */
function formatItemsForPrompt(items) {
  return items.map(i => {
    const parts = [
      `- ${i.title} (${i.year || '?'}, ${TYPE_LABEL[i.type] || i.type})`,
      i.director ? `  감독: ${i.director}` : null,
      i.rating > 0 ? `  별점: ${'★'.repeat(i.rating)}` : null,
      i.review_text ? `  감상: ${i.review_text.slice(0, 80)}` : null,
    ].filter(Boolean);
    return parts.join('\n');
  }).join('\n');
}

/**
 * GET /api/me/reports
 * 내 리포트 목록 조회 (최신순)
 */
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, period, created_at,
              LEFT(content, 200) AS preview
       FROM ai_reports
       WHERE user_id = $1
       ORDER BY period DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/me/reports/:period
 * 특정 기간 리포트 조회 (YYYY-MM 형식)
 */
router.get('/:period', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM ai_reports WHERE user_id = $1 AND period = $2',
      [req.user.id, req.params.period]
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: '리포트가 없습니다' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/me/reports/generate
 * 리포트 생성 (이미 있으면 기존 반환)
 * body: { period?: "YYYY-MM" }  (없으면 이번 달)
 */
router.post('/generate', auth, requireTokens(5, 'report'), async (req, res) => {
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const period     = req.body.period || defaultPeriod;
  const templateId = req.body.templateId || null; // 선택된 템플릿 ID

  // 기간 형식 검증
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return res.status(400).json({ success: false, message: 'period 형식은 YYYY-MM이어야 합니다' });
  }

  try {
    // 이미 생성된 리포트 확인
    const { rows: existing } = await pool.query(
      'SELECT * FROM ai_reports WHERE user_id = $1 AND period = $2',
      [req.user.id, period]
    );
    if (existing[0]) {
      return res.json({ success: true, data: existing[0], cached: true });
    }

    // 해당 기간 감상 항목 조회 (watched_at 기준)
    const { rows: periodItems } = await pool.query(
      `SELECT title, year, type, director, rating, review_text
       FROM user_media
       WHERE user_id = $1
         AND watched_at >= $2::date
         AND watched_at < ($2::date + INTERVAL '1 month')
       ORDER BY watched_at DESC`,
      [req.user.id, period + '-01']
    );

    // 기간 내 항목이 없으면 전체 기록 중 최근 30개 사용
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
        message: '리포트를 생성할 감상 기록이 없습니다. 별점이나 감상 메모를 남겨보세요!',
      });
    }

    // 기간 한국어 표시
    const [year, month] = period.split('-');
    const periodLabel = periodItems.length > 0
      ? `${year}년 ${parseInt(month)}월`
      : `최근 감상 기록`;

    const avgRating = items.filter(i => i.rating > 0).length > 0
      ? (items.filter(i => i.rating > 0).reduce((s, i) => s + i.rating, 0) /
         items.filter(i => i.rating > 0).length).toFixed(1)
      : '-';

    // 템플릿 항목 조회 (templateId가 있으면)
    let selectedComponents = null;
    if (templateId) {
      const { rows: tmplRows } = await pool.query(
        'SELECT components FROM report_templates WHERE id = $1 AND user_id = $2',
        [templateId, req.user.id]
      );
      if (tmplRows[0]?.components?.length) {
        selectedComponents = tmplRows[0].components;
      }
    }

    // 선택된 항목별 지시문 빌드
    const componentInstructions = selectedComponents
      ? '선택된 분석 항목:\n' + selectedComponents
          .map(c => `- ${COMPONENT_PROMPTS[c] || c}`)
          .join('\n')
      : `기본 형식:
### 이달의 하이라이트 (가장 인상 깊은 작품 1-2편)
### 감상 패턴 분석 (장르/연대/감독 선호, 별점 경향)
### 이달의 한 줄 (대표 문장 또는 인상적인 리뷰 인용)
### 다음 달 추천 (패턴 기반 2-3편 추천)`;

    // Claude API 리포트 생성
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
${formatItemsForPrompt(items)}

[리포트 지시사항]
제목: ## ${periodLabel} 감상 리포트

${componentInstructions}

각 항목을 ### 제목으로 구분하고, 감상 목록에서 실제 데이터를 근거로 분석하세요.
데이터가 부족한 항목은 가능한 범위에서 추론하세요.`,
      }],
    });

    const content = message.content[0].text;

    // AI 호출 성공 → 토큰 차감 (실패해도 사용자 응답은 정상 반환)
    deductTokens(req.user.id, req.tokenInfo, {
      input_tokens: message.usage?.input_tokens,
      output_tokens: message.usage?.output_tokens,
    }).catch(err => console.error('토큰 차감 실패 (report):', err.message));

    // DB 저장
    const { rows: saved } = await pool.query(
      `INSERT INTO ai_reports (user_id, period, content, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, period) DO UPDATE SET content = $3, created_at = NOW()
       RETURNING *`,
      [req.user.id, period, content]
    );

    res.json({
      success: true,
      data: saved[0],
      cached: false,
      meta: { token_balance: req.tokenInfo.balance - req.tokenInfo.required },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
