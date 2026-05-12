/**
 * @file onboarding.js
 * 신규 가입자 온보딩 API (Phase 6.4)
 * GET  /api/onboarding/status   — 현재 온보딩 상태 조회
 * POST /api/onboarding/step     — 진행 단계 저장
 * POST /api/onboarding/complete — 온보딩 완료 처리
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

/**
 * GET /api/onboarding/status
 * 온보딩 완료 여부 + 마지막 단계 + 총 미디어 수 반환
 */
router.get('/status', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT onboarding_completed, onboarding_step,
              (SELECT COUNT(*) FROM user_media WHERE user_id = $1) AS media_count
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    const row = rows[0];
    res.json({
      success: true,
      data: {
        onboarding_completed: row?.onboarding_completed ?? false,
        onboarding_step:      row?.onboarding_step      ?? 0,
        media_count:          parseInt(row?.media_count  ?? 0),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/onboarding/step
 * 진행 중인 단계 저장 (새로고침 후 복원용)
 * body: { step: number }
 */
router.post('/step', auth, async (req, res) => {
  const step = parseInt(req.body.step);
  if (isNaN(step) || step < 0 || step > 5) {
    return res.status(400).json({ success: false, message: '유효하지 않은 단계입니다.' });
  }
  try {
    await pool.query(
      'UPDATE users SET onboarding_step = $1 WHERE id = $2',
      [step, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/onboarding/complete
 * 온보딩 완료 처리 (건너뛰기 포함)
 */
router.post('/complete', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE users SET onboarding_completed = true, onboarding_step = 5 WHERE id = $1',
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
