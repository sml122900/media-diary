/**
 * @file tmdb.js
 * TMDB API 프록시 라우터 — API 키를 백엔드 환경변수로 보호
 */

const express = require('express');
const router = express.Router();

const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';

/**
 * GET /api/tmdb/*
 * TMDB API 요청을 백엔드에서 중계 (API 키 노출 방지)
 * 쿼리 파라미터는 그대로 전달하고 api_key를 추가함
 */
// Express 5는 '*' 와일드카드 미지원 → 정규식 사용
router.get(/(.*)/, async (req, res) => {
  const path = req.path;
  const params = new URLSearchParams({ ...req.query, api_key: TMDB_KEY });
  try {
    const response = await fetch(`${TMDB_BASE}${path}?${params}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'TMDB 프록시 오류', message: err.message });
  }
});

module.exports = router;
