/**
 * @file fill-tmdb-ids.js
 * 큐레이션 JSON 파일에서 tmdb_id: 0 항목을 TMDB API로 검색해 ID를 채우는 스크립트
 * 실행: node backend/scripts/fill-tmdb-ids.js
 * 완료 후 seed-curation.js 재실행 권장
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const https = require('https');

const TMDB_KEY = process.env.TMDB_API_KEY;
const SEED_DIR = path.resolve(__dirname, '../seed/curation');
// TMDB 요청 간격 (Rate Limit 방지, 초당 4건 이하)
const DELAY_MS = 260;

if (!TMDB_KEY) {
  console.error('TMDB_API_KEY가 .env에 없습니다.');
  process.exit(1);
}

/** TMDB API GET 요청 래퍼 */
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

/**
 * 제목+연도로 TMDB 검색, 가장 유사한 결과의 id 반환
 * tmdb_type: 'movie' | 'tv'
 */
async function searchTmdb(title, year, tmdbType) {
  const endpoint = tmdbType === 'tv' ? '/search/tv' : '/search/movie';
  const yearParam = tmdbType === 'tv'
    ? `&first_air_date_year=${year}`
    : `&year=${year}`;

  const query = encodeURIComponent(title);
  const data = await tmdbGet(`${endpoint}?query=${query}${yearParam}&language=ko-KR`);

  if (data.results && data.results.length > 0) {
    return data.results[0].id;
  }

  // 연도 없이 재시도 (연도가 틀렸을 경우 대비)
  const data2 = await tmdbGet(`${endpoint}?query=${query}&language=ko-KR`);
  if (data2.results && data2.results.length > 0) {
    return data2.results[0].id;
  }

  return null;
}

async function fillTmdbIds() {
  const files = fs.readdirSync(SEED_DIR).filter(f => f.endsWith('.json'));
  let filled = 0;
  let notFound = 0;

  for (const file of files) {
    const filePath = path.join(SEED_DIR, file);
    const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    let modified = false;

    for (const list of json.lists) {
      for (const item of list.items) {
        if (item.tmdb_id !== 0) continue; // 이미 ID 있으면 스킵

        await sleep(DELAY_MS);
        const id = await searchTmdb(item.title, item.year, item.tmdb_type);

        if (id) {
          console.log(`  ✓ [${item.year}] "${item.title}" → tmdb_id: ${id}`);
          item.tmdb_id = id;
          filled++;
          modified = true;
        } else {
          console.warn(`  ✗ 미매칭: [${item.year}] "${item.title}"`);
          notFound++;
        }
      }
    }

    // 변경 사항이 있으면 JSON 파일 업데이트
    if (modified) {
      fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf-8');
      console.log(`파일 업데이트: ${file}`);
    }
  }

  console.log(`\n완료: ${filled}개 매칭, ${notFound}개 미매칭`);
  if (notFound > 0) {
    console.log('미매칭 항목은 JSON 파일에서 수동으로 tmdb_id를 입력하세요.');
  }
}

fillTmdbIds().catch(err => {
  console.error('fill 실패:', err.message);
  process.exit(1);
});
