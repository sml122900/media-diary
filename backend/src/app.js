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
