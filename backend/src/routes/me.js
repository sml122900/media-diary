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

/**
 * PATCH /api/me/profile
 * 본인 프로필 수정 (username, bio, avatar_url, is_profile_public)
 */
router.patch('/profile', auth, async (req, res) => {
  const { username, bio, avatar_url, is_profile_public } = req.body;

  // username 유효성: 3-20자, 영소문자·숫자·언더스코어
  if (username !== undefined) {
    const valid = /^[a-z0-9][a-z0-9_]{1,18}[a-z0-9]$/.test(username) ||
                  /^[a-z0-9]{3,20}$/.test(username);
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: 'username은 3-20자 영소문자·숫자·언더스코어만 허용합니다',
      });
    }
    // 중복 확인 (본인 제외)
    const { rows: dup } = await pool.query(
      'SELECT id FROM users WHERE username = $1 AND id <> $2',
      [username, req.user.id]
    );
    if (dup.length > 0) {
      return res.status(409).json({ success: false, message: '이미 사용 중인 username입니다' });
    }
  }

  try {
    const { rows } = await pool.query(
      `UPDATE users SET
         username          = COALESCE($1, username),
         bio               = COALESCE($2, bio),
         avatar_url        = COALESCE($3, avatar_url),
         is_profile_public = COALESCE($4, is_profile_public)
       WHERE id = $5
       RETURNING id, name, email, username, bio, avatar_url, is_profile_public`,
      [username ?? null, bio ?? null, avatar_url ?? null, is_profile_public ?? null, req.user.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/me/info
 * 내 프로필 정보 조회 (username 포함)
 */
router.get('/info', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, username, bio, avatar_url, is_profile_public FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
