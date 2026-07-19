/**
 * @file health.js
 * Render Cold Start 방지용 헬스체크 엔드포인트 (인증 불필요, UptimeRobot 등 외부 모니터링용)
 */

const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * GET /api/health
 * DB 연결 상태를 가벼운 쿼리(SELECT 1)로 확인 후 반환
 * 민감 정보(DB 버전, 서버 스펙 등)는 노출하지 않고 status/db/timestamp 3개 필드만 응답
 */
router.get('/', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      db: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      db: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
