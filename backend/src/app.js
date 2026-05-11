require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const authRouter = require('./routes/auth');
const userMediaRouter = require('./routes/userMedia');
const tmdbRouter = require('./routes/tmdb');
const meRouter = require('./routes/me');
const recommendRouter = require('./routes/recommend');
const searchRouter = require('./routes/search');
const reportsRouter = require('./routes/reports');
const importScreenshotRouter = require('./routes/importScreenshot');
const profileRouter = require('./routes/profile');
const listsRouter = require('./routes/lists');
const socialRouter = require('./routes/social');
const watchlistsRouter = require('./routes/watchlists');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/user-media', userMediaRouter);
app.use('/api/tmdb', tmdbRouter);
app.use('/api/me', meRouter);
app.use('/api/recommend', recommendRouter);
app.use('/api/search', searchRouter);
app.use('/api/me/reports', reportsRouter);
app.use('/api/import/screenshot', importScreenshotRouter);
app.use('/api/profile', profileRouter);
app.use('/api/lists', listsRouter);
// social.js는 여러 경로 처리 (follow, feed, compare, search/users, media/friends)
app.use('/api', socialRouter);
app.use('/api/watchlists', watchlistsRouter);

app.get('/', (req, res) => {
  res.json({ message: 'Media Diary API is running' });
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

  // TMDB 추천 캐시 테이블 (Phase 3.2, 24h TTL)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS recommendations (
      tmdb_id    INTEGER      NOT NULL,
      tmdb_type  VARCHAR(10)  NOT NULL,
      results    JSONB        DEFAULT '[]',
      created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (tmdb_id, tmdb_type)
    )
  `);

  // 오늘의 추천 캐시 테이블 (Phase 3.3, 사용자별 24h TTL)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_recommendations (
      user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      results    JSONB       DEFAULT '[]',
      created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
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
