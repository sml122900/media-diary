/**
 * @file me.js
 * 인증된 사용자 관련 API 라우터 (/api/me/*)
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { calculateTasteProfile, updateTasteProfile } = require('../services/tasteProfile');

/**
 * GET /api/me/taste-profile
 * 내 취향 프로필 조회
 * 저장된 프로필이 없으면 즉시 계산 후 반환
 */
router.get('/taste-profile', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM user_taste_profile WHERE user_id = $1',
      [req.user.id]
    );

    if (rows[0]) {
      return res.json({ success: true, data: rows[0] });
    }

    // 저장된 프로필 없으면 실시간 계산 후 저장
    await updateTasteProfile(req.user.id);
    const { rows: fresh } = await pool.query(
      'SELECT * FROM user_taste_profile WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ success: true, data: fresh[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
