/**
 * @file importScreenshot.js
 * OTT 스크린샷 이미지 인식 API (Phase 3.6)
 * Claude Vision으로 이미지에서 작품명 추출 → TMDB 검색 → 결과 반환
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const pool = require('../db');
const auth = require('../middleware/auth');

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = process.env.TMDB_API_KEY;
const IMG_BASE = 'https://image.tmdb.org/t/p/w300';

// 임시 업로드 디렉토리
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// multer 설정: 이미지만 허용, 5MB 제한
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('이미지 파일만 업로드 가능합니다'));
  },
});

/** TMDB 검색 */
async function searchTmdb(title, type = 'movie') {
  try {
    const qs = new URLSearchParams({ query: title, language: 'ko-KR', api_key: TMDB_KEY });
    const res = await fetch(`${TMDB_BASE}/search/${type}?${qs}`);
    const data = await res.json();
    return data?.results?.[0] || null;
  } catch { return null; }
}

/**
 * POST /api/import/screenshot
 * 이미지 업로드 → Claude Vision으로 작품명 추출 → TMDB 검색 → 결과 반환
 * 처리 완료 후 임시 파일 삭제
 */
router.post('/', auth, upload.single('image'), async (req, res) => {
  const filePath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '이미지를 업로드해주세요' });
    }

    // 이미지를 base64로 읽기
    const imageData = fs.readFileSync(filePath);
    const base64Image = imageData.toString('base64');
    const mediaType = req.file.mimetype; // 'image/jpeg', 'image/png' 등

    // Claude Vision API — 작품명 추출
    const message = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Image },
          },
          {
            type: 'text',
            text: `이 이미지는 OTT 서비스(넷플릭스, 왓챠, 웨이브 등)의 화면이거나 영화/드라마 관련 이미지입니다.
이미지에서 영화, 드라마, 애니메이션 제목을 모두 찾아주세요.

다음 JSON 형식으로만 응답하세요 (설명 없이):
{"titles": ["제목1", "제목2", "제목3"]}

작품 제목이 없으면: {"titles": []}`,
          },
        ],
      }],
    });

    // 응답 파싱
    let titles = [];
    try {
      const text = message.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      titles = (parsed.titles || []).filter(t => t && t.trim());
    } catch {
      titles = [];
    }

    if (titles.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: '이미지에서 작품 제목을 찾지 못했습니다. OTT 화면이나 작품 목록 이미지를 사용해보세요.',
      });
    }

    // 이미 내 목록에 있는 tmdb_id 집합
    const { rows: myItems } = await pool.query(
      'SELECT tmdb_id, title, year FROM user_media WHERE user_id = $1',
      [req.user.id]
    );
    const myTmdbIds = new Set(myItems.map(i => i.tmdb_id).filter(Boolean));
    const myTitles = new Set(myItems.map(i => i.title.toLowerCase()));

    // 각 제목 TMDB 검색 (영화/TV 병렬)
    const results = await Promise.all(
      titles.map(async (title) => {
        const [movie, tv] = await Promise.all([
          searchTmdb(title, 'movie'),
          searchTmdb(title, 'tv'),
        ]);
        // 포스터 있는 결과 우선
        const best = (movie?.poster_path ? movie : null) || (tv?.poster_path ? tv : null) || movie || tv;
        if (!best) return { inputTitle: title, result: null };

        const tmdbTitle = best.title || best.name || title;
        const year = parseInt((best.release_date || best.first_air_date || '').slice(0, 4)) || 0;
        const inMyList = myTmdbIds.has(best.id) || myTitles.has(tmdbTitle.toLowerCase());

        return {
          inputTitle: title,
          result: {
            tmdb_id: best.id,
            title: tmdbTitle,
            year,
            type: best.title ? 'movie' : 'drama',
            poster_url: best.poster_path ? IMG_BASE + best.poster_path : '',
            overview: best.overview || '',
            vote_average: best.vote_average || 0,
            in_my_list: inMyList,
          },
        };
      })
    );

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    // 처리 완료 후 임시 파일 반드시 삭제
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

module.exports = router;
