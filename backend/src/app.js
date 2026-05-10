require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const authRouter = require('./routes/auth');
const userMediaRouter = require('./routes/userMedia');
const tmdbRouter = require('./routes/tmdb');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/user-media', userMediaRouter);
app.use('/api/tmdb', tmdbRouter);

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
