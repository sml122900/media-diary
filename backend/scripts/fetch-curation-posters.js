/**
 * @file fetch-curation-posters.js
 * curation_items에서 poster_path가 없는 항목을 TMDB API로 조회해 채우는 스크립트
 * 실행: node backend/scripts/fetch-curation-posters.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db');
const https = require('https');

const TMDB_KEY = process.env.TMDB_API_KEY;
const DELAY_MS = 260; // Rate Limit 방지

function tmdbGet(path) {
  return new Promise((resolve, reject) => {
    const url = `https://api.themoviedb.org/3${path}&api_key=${TMDB_KEY}`;
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchPosters() {
  // poster_path가 없고 tmdb_id > 0인 항목 조회
  const { rows } = await pool.query(
    `SELECT id, tmdb_id, tmdb_type FROM curation_items
     WHERE (poster_path IS NULL OR poster_path = '') AND tmdb_id > 0
     ORDER BY id`
  );

  console.log(`포스터 업데이트 대상: ${rows.length}개`);
  let success = 0;
  let fail = 0;

  for (const row of rows) {
    await sleep(DELAY_MS);
    try {
      const endpoint = row.tmdb_type === 'tv'
        ? `/tv/${row.tmdb_id}?language=ko-KR`
        : `/movie/${row.tmdb_id}?language=ko-KR`;
      const data = await tmdbGet(endpoint);

      if (data.poster_path) {
        await pool.query(
          'UPDATE curation_items SET poster_path = $1 WHERE id = $2',
          [data.poster_path, row.id]
        );
        process.stdout.write('.');
        success++;
      } else {
        process.stdout.write('x');
        fail++;
      }
    } catch (e) {
      process.stdout.write('E');
      fail++;
    }
  }

  console.log(`\n완료: ${success}개 업데이트, ${fail}개 실패`);
  await pool.end();
}

fetchPosters().catch(err => {
  console.error('실패:', err.message);
  process.exit(1);
});
