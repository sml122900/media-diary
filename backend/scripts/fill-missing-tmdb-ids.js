/**
 * @file fill-missing-tmdb-ids.js
 * user_media 테이블의 tmdb_id 정합성 검증 스크립트 (읽기 전용, DB 변경 없음)
 * 1) tmdb_id가 있는 항목: TMDB 상세 조회로 title이 실제로 일치하는지 확인 (오염된 ID 탐지)
 * 2) tmdb_id가 없거나(0/NULL) 불일치로 판정된 항목: title+year+type으로 재검색해 후보 제시
 * anime 타입은 극장판(movie)/시리즈(tv) 둘 다일 수 있어 두 엔드포인트 모두 시도
 * 실행: node backend/scripts/fill-missing-tmdb-ids.js
 * 결과는 콘솔 출력 + backend/tmdb_id_audit.json 저장. UPDATE는 별도 승인 후 진행.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const https = require('https');
const pool = require('../src/db');

const TMDB_KEY = process.env.TMDB_API_KEY;
const DELAY_MS = 260;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function tmdbGet(p) {
  return new Promise((resolve, reject) => {
    https.get(`https://api.themoviedb.org/3${p}&api_key=${TMDB_KEY}`, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

/** 'movie' → [movie], 'drama' → [tv], 'anime' → [movie, tv] (극장판/시리즈 모두 가능) */
const candidateTypes = type => {
  if (type === 'movie') return ['movie'];
  if (type === 'anime') return ['movie', 'tv'];
  return ['tv'];
};

/** 비교용 정규화: 소문자화 + 공백만 제거 (콜론/대시 등 구분자는 boundary 판단에 써야 하므로 유지) */
const norm = s => (s || '').toLowerCase().replace(/\s+/g, '');

/** "메인 제목: 부제"에서 콜론 뒤 부분만 뽑은 버전도 비교 후보에 포함 (TMDB가 부제만 반환하는 경우 대비) */
function titleVariants(s) {
  const full = norm(s);
  const idx = (s || '').indexOf(':');
  const afterColon = idx >= 0 ? norm(s.slice(idx + 1)) : null;
  return afterColon ? [full, afterColon] : [full];
}

/**
 * 두 제목이 같은 작품으로 볼 수 있는지 판단
 * - 정규화(공백 무시) 후 완전히 같으면 매치 ("스파이더맨2" ↔ "스파이더맨 2")
 * - "메인:부제" 형태면 부제만 있는 쪽과도 비교 ("캡틴 아메리카: 퍼스트 어벤져" ↔ "퍼스트 어벤져")
 * - 한쪽이 다른 쪽의 접두어이고, 그 경계가 콜론/대시/괄호 등 구분자일 때만 매치
 *   "소울"↔"소울메이트"처럼 구분자 없이 단어 중간에서 이어지는 경우는 불일치로 처리
 */
function titleMatches(a, b) {
  const boundaryPrefix = (long, short) =>
    long.startsWith(short) && /^[:\-–(（,.]/.test(long.slice(short.length));
  for (const x of titleVariants(a)) {
    for (const y of titleVariants(b)) {
      if (!x || !y) continue;
      if (x === y || boundaryPrefix(x, y) || boundaryPrefix(y, x)) return true;
    }
  }
  return false;
}

/** 저장된 tmdb_id로 movie/tv 상세 조회 시도 (해당 없으면 빈 배열) */
async function fetchDetailCandidates(tmdbId, type) {
  const results = [];
  for (const t of candidateTypes(type)) {
    await sleep(DELAY_MS);
    const data = await tmdbGet(`/${t}/${tmdbId}?language=ko-KR`);
    if (!data.status_code) {
      results.push({
        title: data.title || data.name || '',
        year: (data.release_date || data.first_air_date || '').slice(0, 4),
        matchedType: t,
      });
    }
  }
  return results;
}

/** title+year로 재검색해 확신 있는 후보(±1년 + 제목 일치) 탐색 */
async function searchCandidate(title, year, type) {
  let fallbackCandidates = [];
  for (const t of candidateTypes(type)) {
    await sleep(DELAY_MS);
    const data = await tmdbGet(`/search/${t}?query=${encodeURIComponent(title)}&language=ko-KR`);
    const results = data.results || [];
    const withYear = results.find(r => {
      const y = parseInt((r.release_date || r.first_air_date || '').slice(0, 4)) || 0;
      return Math.abs(y - (year || 0)) <= 1 && titleMatches(r.title || r.name, title);
    });
    if (withYear) {
      return {
        confident: true,
        id: withYear.id,
        title: withYear.title || withYear.name,
        year: (withYear.release_date || withYear.first_air_date || '').slice(0, 4),
        matchedType: t,
      };
    }
    fallbackCandidates = fallbackCandidates.concat(
      results.slice(0, 3).map(r => ({
        id: r.id, title: r.title || r.name,
        year: (r.release_date || r.first_air_date || '').slice(0, 4),
        matchedType: t,
      }))
    );
  }
  return { confident: false, candidates: fallbackCandidates.slice(0, 5) };
}

async function main() {
  const { rows } = await pool.query(
    'SELECT id, user_id, type, title, year, tmdb_id FROM user_media ORDER BY id'
  );
  console.log(`검증 대상: ${rows.length}건\n`);

  const mismatches = [];   // tmdb_id 있지만 실제 제목과 다름 (오염)
  const missing = [];      // tmdb_id 없음 (0/NULL)
  const confirmed = [];    // 자동 수정 확신 있는 항목 (mismatch/missing 중 재검색으로 확실히 찾은 것)
  const unresolved = [];   // 재검색해도 확신 없는 항목

  for (const row of rows) {
    const hasId = row.tmdb_id && row.tmdb_id !== 0;
    let needsResearch = false;
    let reason = '';

    if (hasId) {
      const details = await fetchDetailCandidates(row.tmdb_id, row.type);
      const goodMatch = details.find(d => titleMatches(d.title, row.title));
      if (!goodMatch) {
        mismatches.push({
          ...row,
          actualTmdbTitle: details.length ? details.map(d => `${d.title}(${d.matchedType})`).join(' / ') : '(404/조회실패)',
        });
        needsResearch = true;
        reason = 'mismatch';
      }
    } else {
      missing.push(row);
      needsResearch = true;
      reason = 'missing';
    }

    if (needsResearch) {
      const cand = await searchCandidate(row.title, row.year, row.type);
      if (cand.confident) {
        confirmed.push({
          id: row.id, title: row.title, year: row.year, type: row.type,
          oldTmdbId: row.tmdb_id, newTmdbId: cand.id,
          matchedTitle: cand.title, matchedYear: cand.year, matchedType: cand.matchedType, reason,
        });
        console.log(`  ✓ [${reason}] id=${row.id} "${row.title}"(${row.year}) : ${row.tmdb_id} → ${cand.id} ("${cand.title}" ${cand.year}, ${cand.matchedType})`);
      } else {
        unresolved.push({
          id: row.id, title: row.title, year: row.year, type: row.type,
          oldTmdbId: row.tmdb_id, reason, candidates: cand.candidates,
        });
        console.log(`  ? [${reason}] id=${row.id} "${row.title}"(${row.year}) : 확신 있는 후보 없음`);
      }
    }
  }

  const outPath = path.resolve(__dirname, '../tmdb_id_audit.json');
  fs.writeFileSync(outPath, JSON.stringify({ mismatches, missing, confirmed, unresolved }, null, 2), 'utf-8');

  console.log(`\n=== 요약 ===`);
  console.log(`오염된 tmdb_id (제목 불일치): ${mismatches.length}건`);
  console.log(`tmdb_id 없음: ${missing.length}건`);
  console.log(`자동 수정 확신 있음: ${confirmed.length}건`);
  console.log(`확신 없음 (수동 확인 필요): ${unresolved.length}건`);
  console.log(`\n결과 저장: ${outPath}`);

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
