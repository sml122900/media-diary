require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const authRouter = require('./routes/auth');
const userMediaRouter = require('./routes/userMedia');
const tmdbRouter = require('./routes/tmdb');
const meRouter = require('./routes/me');
const searchRouter = require('./routes/search');
const reportsRouter = require('./routes/reports');
const importScreenshotRouter = require('./routes/importScreenshot');
const profileRouter = require('./routes/profile');
const listsRouter = require('./routes/lists');
const socialRouter = require('./routes/social');
const watchlistsRouter = require('./routes/watchlists');
const yearInReviewRouter = require('./routes/yearInReview');
const curationRouter = require('./routes/curation');
const restoreRouter = require('./routes/restore');
const onboardingRouter = require('./routes/onboarding');
const billingRouter  = require('./routes/billing');
const discoverRouter        = require('./routes/discover');
const healthRouter = require('./routes/health');
const epithetsRouter = require('./routes/epithets');
const ratingAxesRouter = require('./routes/ratingAxes');
const { router: reportTemplatesRouter } = require('./routes/reportTemplates');
// wishlistRouter는 meRouter 내부에서 /watchlist로 마운트 (me.js 참고)

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/user-media', userMediaRouter);
app.use('/api/tmdb', tmdbRouter);
app.use('/api/me', meRouter);
app.use('/api/search', searchRouter);
app.use('/api/me/reports', reportsRouter);
app.use('/api/import/screenshot', importScreenshotRouter);
app.use('/api/profile', profileRouter);
app.use('/api/lists', listsRouter);
// social.js는 여러 경로 처리 (follow, feed, compare, search/users, media/friends)
app.use('/api', socialRouter);
app.use('/api/watchlists', watchlistsRouter);
app.use('/api/year-in-review', yearInReviewRouter);
app.use('/api/curation', curationRouter);
app.use('/api/restore', restoreRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/billing',  billingRouter);
app.use('/api/discover', discoverRouter);
app.use('/api/reports',  reportTemplatesRouter);
app.use('/api/health', healthRouter);
app.use('/api/epithets', epithetsRouter);
app.use('/api/rating-axes', ratingAxesRouter);

app.get('/', (req, res) => {
  res.json({ message: 'Media Diary API is running' });
});

/**
 * TMDB 이미지 프록시 — html2canvas CORS 우회용 (Phase 10.1)
 * TMDB URL만 허용 (SSRF 방지), 1주일 캐시
 * GET /api/proxy/poster?url=https://image.tmdb.org/t/p/w500/abc.jpg
 */
app.get('/api/proxy/poster', async (req, res) => {
  const { url } = req.query;

  // SSRF 방지 — TMDB 이미지 도메인만 허용
  if (!url || !url.startsWith('https://image.tmdb.org/')) {
    return res.status(400).json({ error: 'TMDB 이미지 URL만 허용됩니다' });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).end();

    res.set('Cache-Control', 'public, max-age=604800'); // 1주일 캐시
    res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    res.set('Access-Control-Allow-Origin', '*'); // html2canvas CORS 허용

    // 스트림으로 전달
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch {
    res.status(502).end();
  }
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_media (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(20) NOT NULL DEFAULT 'movie',
      title VARCHAR(500) NOT NULL,
      year INTEGER DEFAULT 0,
      director VARCHAR(500) DEFAULT '',
      cast_info VARCHAR(500) DEFAULT '',
      tmdb_id INTEGER DEFAULT 0,
      poster_url TEXT DEFAULT '',
      rating INTEGER DEFAULT 0,
      review_text TEXT DEFAULT '',
      review_date VARCHAR(50) DEFAULT '',
      watched_at TIMESTAMP DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, title, year)
    )
  `);
  // 기존 테이블에 watched_at 컬럼이 없으면 추가
  await pool.query(`
    ALTER TABLE user_media ADD COLUMN IF NOT EXISTS watched_at TIMESTAMP DEFAULT NULL
  `);

  // AI 검색 일일 사용량 컬럼 (Phase 3.4)
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_ai_calls   INTEGER   DEFAULT 0
  `);
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ai_reset_at TIMESTAMP DEFAULT NULL
  `);

  // 공개 프로필 컬럼 (Phase 4.1)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username          VARCHAR(50)`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio               TEXT      DEFAULT ''`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url        TEXT      DEFAULT ''`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_profile_public BOOLEAN   DEFAULT false`);

  // 기존 유저 username 자동 생성 (email 앞부분 + id, 영숫자만)
  await pool.query(`
    UPDATE users
    SET username = lower(regexp_replace(split_part(email,'@',1),'[^a-z0-9]','','g')) || id::text
    WHERE username IS NULL
  `);

  // username UNIQUE 인덱스 (IF NOT EXISTS)
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`);

  // 리뷰 공개/비공개 컬럼 (Phase 4.2, 선행 마이그레이션)
  await pool.query(`ALTER TABLE user_media ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false`);

  // 친구(팔로우) 테이블 (Phase 4.4)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS follows (
      follower_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (follower_id, following_id)
    )
  `);

  // 공유 워치리스트 테이블 (Phase 4.7)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shared_watchlists (
      id         SERIAL  PRIMARY KEY,
      creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title      VARCHAR(200) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shared_watchlist_members (
      watchlist_id INTEGER NOT NULL REFERENCES shared_watchlists(id) ON DELETE CASCADE,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role         VARCHAR(20) DEFAULT 'member',
      PRIMARY KEY (watchlist_id, user_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shared_watchlist_items (
      id                 SERIAL  PRIMARY KEY,
      watchlist_id       INTEGER NOT NULL REFERENCES shared_watchlists(id) ON DELETE CASCADE,
      media_id           INTEGER NOT NULL REFERENCES user_media(id) ON DELETE CASCADE,
      added_by           INTEGER NOT NULL REFERENCES users(id),
      watched_by_creator BOOLEAN DEFAULT false,
      watched_by_member  BOOLEAN DEFAULT false,
      UNIQUE(watchlist_id, media_id)
    )
  `);

  // 베스트 리스트 테이블 (Phase 4.3)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lists (
      id          SERIAL    PRIMARY KEY,
      user_id     INTEGER   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title       VARCHAR(200) NOT NULL,
      description TEXT      DEFAULT '',
      is_public   BOOLEAN   DEFAULT false,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS list_items (
      id       SERIAL  PRIMARY KEY,
      list_id  INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
      media_id INTEGER NOT NULL REFERENCES user_media(id) ON DELETE CASCADE,
      position INTEGER DEFAULT 0,
      comment  TEXT    DEFAULT '',
      UNIQUE(list_id, media_id)
    )
  `);

  // 취향 프로필 테이블 (Phase 3.1)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_taste_profile (
      user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      genres      JSONB    DEFAULT '{}',
      directors   JSONB    DEFAULT '{}',
      decades     JSONB    DEFAULT '{}',
      avg_rating  FLOAT    DEFAULT 0,
      total_count INTEGER  DEFAULT 0,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 월간 AI 리포트 테이블 (Phase 3.5)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_reports (
      id         SERIAL    PRIMARY KEY,
      user_id    INTEGER   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      period     VARCHAR(7) NOT NULL,
      content    TEXT      NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, period)
    )
  `);
  // 개인 위시리스트 테이블 (Phase 5.2)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wishlist (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(20) NOT NULL DEFAULT 'movie',
      title VARCHAR(500) NOT NULL,
      year INTEGER DEFAULT 0,
      tmdb_id INTEGER DEFAULT 0,
      poster_url TEXT DEFAULT '',
      priority INTEGER DEFAULT 0,
      intended_platform TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, tmdb_id, type)
    )
  `);

  // 연말 결산 캐시 테이블 (Phase 5.1)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS year_in_review_cache (
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      year         INTEGER NOT NULL,
      data         JSONB   NOT NULL DEFAULT '{}',
      generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, year)
    )
  `);

  // 시청 시간 합산용 컬럼 (Phase 5.1/5.3 — NULL 허용, 기존 데이터 영향 없음)
  await pool.query(`
    ALTER TABLE user_media ADD COLUMN IF NOT EXISTS runtime_minutes INTEGER DEFAULT NULL
  `);

  // 재시청 추적 컬럼 (Phase 5.4)
  await pool.query(`ALTER TABLE user_media ADD COLUMN IF NOT EXISTS rewatch_count INTEGER DEFAULT 1`);
  // 기존 행에 rewatch_count = 1 설정
  await pool.query(`UPDATE user_media SET rewatch_count = 1 WHERE rewatch_count IS NULL`);
  // 기존 UNIQUE(user_id, title, year) 제약 제거 후 rewatch_count 포함 복합 UNIQUE로 교체
  await pool.query(`ALTER TABLE user_media DROP CONSTRAINT IF EXISTS user_media_user_id_title_year_key`);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_media_rewatch
    ON user_media(user_id, title, year, rewatch_count)
  `);

  // 시청 컨텍스트 컬럼 (Phase 5.6 — 모두 NULL 허용)
  await pool.query(`ALTER TABLE user_media ADD COLUMN IF NOT EXISTS watched_with TEXT DEFAULT NULL`);
  await pool.query(`ALTER TABLE user_media ADD COLUMN IF NOT EXISTS watched_at_place TEXT DEFAULT NULL`);
  await pool.query(`ALTER TABLE user_media ADD COLUMN IF NOT EXISTS mood TEXT DEFAULT NULL`);
  await pool.query(`ALTER TABLE user_media ADD COLUMN IF NOT EXISTS companion_names TEXT DEFAULT NULL`);

  // 시청 시기 태그 컬럼 (Phase 6.5.1 — NULL 허용, 자유 텍스트)
  await pool.query(`ALTER TABLE user_media ADD COLUMN IF NOT EXISTS life_period TEXT DEFAULT NULL`);

  // 수식어 테이블 (Phase 13.1) — 유저가 직접 만드는 "어떻게 좋았나" 부문
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_epithets (
      id         SERIAL      PRIMARY KEY,
      user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label      TEXT        NOT NULL,
      emoji      TEXT        DEFAULT NULL,
      sort_order INTEGER     DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(user_id, label)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_epithet_items (
      id            SERIAL      PRIMARY KEY,
      epithet_id    INTEGER     NOT NULL REFERENCES user_epithets(id) ON DELETE CASCADE,
      user_media_id INTEGER     NOT NULL REFERENCES user_media(id) ON DELETE CASCADE,
      sort_order    INTEGER     DEFAULT 0,
      created_at    TIMESTAMPTZ DEFAULT now(),
      UNIQUE(epithet_id, user_media_id)
    )
  `);

  // 다면 별점 테이블 (Phase 13.3) — user_media.rating(대표 축)과 완전 독립, 유저가 만드는 추가 평가 축
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_rating_axes (
      id         SERIAL      PRIMARY KEY,
      user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label      TEXT        NOT NULL,
      emoji      TEXT        DEFAULT NULL,
      sort_order INTEGER     DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(user_id, label)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_media_axis_ratings (
      id            SERIAL      PRIMARY KEY,
      user_media_id INTEGER     NOT NULL REFERENCES user_media(id) ON DELETE CASCADE,
      axis_id       INTEGER     NOT NULL REFERENCES user_rating_axes(id) ON DELETE CASCADE,
      rating        INTEGER     NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT now(),
      UNIQUE(user_media_id, axis_id)
    )
  `);

  console.log('Database tables ready');
}

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  try {
    await pool.query('SELECT 1');
    console.log('Database connected successfully');
    await initDB();
  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
});
