/**
 * @file fix-curation-ids-round2.js
 * 포스터 검증에서 추가 발견된 18개 잘못된 TMDB ID 수정
 * 실행: node backend/scripts/fix-curation-ids-round2.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('../src/db');

async function getListId(slug) {
  const { rows } = await pool.query('SELECT id FROM curation_lists WHERE slug = $1', [slug]);
  if (!rows[0]) { console.warn(`  ⚠ 리스트 없음: ${slug}`); return null; }
  return rows[0].id;
}

async function fix(slug, wrongId, correctId, title) {
  const listId = await getListId(slug);
  if (!listId) return;

  const { rows: existing } = await pool.query(
    'SELECT id FROM curation_items WHERE list_id = $1 AND tmdb_id = $2',
    [listId, correctId]
  );
  if (existing.length > 0) {
    const { rowCount } = await pool.query(
      'DELETE FROM curation_items WHERE list_id = $1 AND tmdb_id = $2',
      [listId, wrongId]
    );
    console.log(`  ✓ [${slug}] ${title}: ${wrongId} 삭제 (${correctId} 이미 존재, ${rowCount}행)`);
    return;
  }

  const { rowCount } = await pool.query(
    'UPDATE curation_items SET tmdb_id = $1 WHERE list_id = $2 AND tmdb_id = $3',
    [correctId, listId, wrongId]
  );
  const mark = rowCount > 0 ? '✓' : '–';
  console.log(`  ${mark} [${slug}] ${title}: ${wrongId} → ${correctId} (${rowCount}행)`);
}

async function main() {
  console.log('2차 TMDB ID 수정 시작...\n');

  // 애니 — anime-classics-adult, hosoda-mamoru, shinkai-makoto
  await fix('anime-classics-adult', 672886, 776305, '용과 주근깨 공주');
  await fix('anime-classics-adult', 571362, 568160, '날씨의 아이');
  await fix('hosoda-mamoru', 672886, 776305, '용과 주근깨 공주');
  await fix('shinkai-makoto', 571362, 568160, '날씨의 아이');

  // 드라마 리스트
  await fix('baeksang-drama-winners', 66423, 64010, '응답하라 1988');
  await fix('korean-drama-ratings-top', 66423, 64010, '응답하라 1988');
  await fix('korean-drama-ratings-top', 70483, 67915, '도깨비');
  await fix('korean-drama-ratings-top', 199521, 126485, '무빙');
  await fix('netflix-kr-original', 120885, 99966, '지금 우리 학교는');

  // 봉준호
  await fix('bong-joon-ho', 21558, 30018, '마더');
  await fix('bong-joon-ho', 109919, 110415, '설국열차');

  // 박찬욱 (스토커: 2013년 박찬욱 감독작 = 86825)
  await fix('park-chan-wook', 23662, 22536, '박쥐');
  await fix('park-chan-wook', 116448, 86825, '스토커');

  // 리들리 스콧
  await fix('ridley-scott', 1007, 855, '블랙 호크 다운');

  // 지브리
  await fix('studio-ghibli', 361653, 337703, '붉은 거북');

  // 칸 황금종려상 — 3개 잘못된 ID
  await fix('cannes-palme-dor', 44116, 38368, '엉클 분미');
  await fix('cannes-palme-dor', 242625, 265169, '윈터 슬립');
  // 가장 따뜻한 색, 블루: 129575(잘못)→152584(정상) — cannes도 수정
  await fix('cannes-palme-dor', 129575, 152584, '가장 따뜻한 색, 블루');

  // french-cinema: 앞서 152584→129575로 잘못 바꾼 것 복구
  // 현재 DB: 129575(에 이전 포스터 있을 수 있음), 152584 없음
  // 두 경우 모두 처리
  await fix('french-cinema', 129575, 152584, '가장 따뜻한 색, 블루');

  // 포스터 초기화 — 새로 삽입된 항목들
  console.log('\n  포스터 초기화 (새 ID들)...');
  const newIds = [776305, 568160, 64010, 67915, 126485, 99966, 30018, 110415, 22536, 86825, 855, 337703, 38368, 265169, 152584];
  const { rowCount } = await pool.query(
    `UPDATE curation_items SET poster_path = NULL WHERE tmdb_id = ANY($1) AND poster_path IS NOT NULL
       AND id IN (
         SELECT ci.id FROM curation_items ci
         JOIN curation_lists cl ON ci.list_id = cl.id
         WHERE ci.tmdb_id = ANY($1)
       )`,
    [newIds]
  );
  console.log(`  ${rowCount}개 포스터 초기화`);

  console.log('\n완료!');
  await pool.end();
}

main().catch(err => {
  console.error('실패:', err.message);
  process.exit(1);
});
