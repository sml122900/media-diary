/**
 * @file fix-curation-ids.js
 * 큐레이션 TMDB ID 오류 일괄 수정 — 2026-05-14 전수 검증 결과
 * 실행: node backend/scripts/fix-curation-ids.js
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

  // 정상 ID가 이미 존재하면 오류 항목만 삭제
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
  console.log('큐레이션 ID 수정 시작...\n');

  // awards.json
  await fix('academy-best-picture', 748783, 581734, '노매드랜드');
  await fix('academy-best-picture', 1084736, 1064213, '아노라');
  await fix('cannes-palme-dor', 1084736, 1064213, '아노라');

  // awards-extended.json
  await fix('venice-golden-lion', 748783, 581734, '노매드랜드');

  // foreign-directors.json (놀란)
  await fix('christopher-nolan', 11677, 11660, '팔로잉');
  await fix('christopher-nolan', 6972, 320, '인썸니아');
  await fix('christopher-nolan', 1267, 1124, '프레스티지');

  // foreign-directors-extended.json (스필버그)
  await fix('steven-spielberg', 5765, 640, '캐치 미 이프 유 캔');
  await fix('steven-spielberg', 9522, 612, '뮌헨');
  await fix('steven-spielberg', 96721, 72976, '링컨');

  // 스코세이지
  await fix('martin-scorsese', 1373, 1578, '성난 황소');
  await fix('martin-scorsese', 83666, 44826, '휴고');

  // 타란티노
  await fix('quentin-tarantino', 2397, 184, '재키 브라운');

  // 코엔
  await fix('coen-brothers', 16154, 134, '오 형제여 어디 있는가?');
  await fix('coen-brothers', 12618, 4944, '번 애프터 리딩');
  await fix('coen-brothers', 45243, 44264, '트루 그릿');
  await fix('coen-brothers', 142012, 86829, '인사이드 르윈 데이비스');

  // 핀처
  await fix('david-fincher', 10918, 1949, '조디악');
  await fix('david-fincher', 694919, 614560, '맨크');

  // 리들리 스콧
  await fix('ridley-scott', 1542, 1495, '킹덤 오브 헤븐');
  await fix('ridley-scott', 522437, 617653, '라스트 듀얼');

  // 셔젤
  await fix('damien-chazelle', 399379, 369972, '퍼스트 맨');

  // 웨스 앤더슨
  await fix('wes-anderson', 9587, 9428, '로열 테넌바움');
  await fix('wes-anderson', 14, 421, '스티브 지소와의 해저생활');
  await fix('wes-anderson', 11328, 4538, '다즐링 주식회사');
  await fix('wes-anderson', 10090, 10315, '판타스틱 Mr. 폭스');
  await fix('wes-anderson', 72279, 81413, '문라이즈 킹덤');

  // 카메론
  await fix('james-cameron', 9260, 36955, '트루 라이즈');

  // korean-directors.json (봉준호)
  await fix('bong-joon-ho', 19552, 11423, '살인의 추억');
  await fix('bong-joon-ho', 429351, 387426, '옥자');

  // 박찬욱
  await fix('park-chan-wook', 3072, 4550, '친절한 금자씨');
  await fix('park-chan-wook', 357390, 290098, '아가씨');

  // franchises.json (MCU 순환 swap — 임시값 경유)
  console.log('\n  MCU 순환 swap 처리...');
  const mcuId = await getListId('marvel-mcu');
  if (mcuId) {
    // BP(284052) → 임시(999999)
    await pool.query('UPDATE curation_items SET tmdb_id = 999999 WHERE list_id = $1 AND tmdb_id = 284052', [mcuId]);
    // DS(284053) → 284052
    await pool.query('UPDATE curation_items SET tmdb_id = 284052 WHERE list_id = $1 AND tmdb_id = 284053', [mcuId]);
    // Thor(284054) → 284053
    await pool.query('UPDATE curation_items SET tmdb_id = 284053 WHERE list_id = $1 AND tmdb_id = 284054', [mcuId]);
    // 임시(999999) → 284054
    await pool.query('UPDATE curation_items SET tmdb_id = 284054 WHERE list_id = $1 AND tmdb_id = 999999', [mcuId]);
    console.log('  ✓ MCU: 닥터스트레인지→284052, 토르라그나로크→284053, 블랙팬서→284054');
  }

  // franchises-series.json
  await fix('indiana-jones', 285, 335977, '인디아나 존스: 운명의 다이얼');
  await fix('ip-man-series', 24494, 14756, '엽문');

  // decade-classics.json
  await fix('80s-classics', 1373, 1578, '성난 황소');
  await fix('2000s-classics', 19552, 11423, '살인의 추억');
  await fix('2000s-classics', 9529, 6977, '노인을 위한 나라는 없다');

  // world-cinema.json
  await fix('french-cinema', 152584, 129575, '가장 따뜻한 색, 블루');
  await fix('french-cinema', 314402, 293110, '디판');

  // 기생충 ID 오염 복구 (530915=1917로 잘못 들어간 경우)
  console.log('\n  기생충 ID 오염 복구...');
  // 같은 리스트에 496243이 이미 있으면 530915 항목만 삭제
  const { rows: parasiteRows } = await pool.query(
    "SELECT id, list_id FROM curation_items WHERE tmdb_id = 530915 AND title = '기생충'"
  );
  let fixed = 0, deleted = 0;
  for (const row of parasiteRows) {
    const { rows: already } = await pool.query(
      'SELECT id FROM curation_items WHERE list_id = $1 AND tmdb_id = 496243', [row.list_id]
    );
    if (already.length > 0) {
      await pool.query('DELETE FROM curation_items WHERE id = $1', [row.id]);
      deleted++;
    } else {
      await pool.query('UPDATE curation_items SET tmdb_id = 496243 WHERE id = $1', [row.id]);
      fixed++;
    }
  }
  console.log(`  ✓ 기생충: 530915 → 496243 (수정: ${fixed}행, 중복삭제: ${deleted}행)`);

  console.log('\n완료!');
  await pool.end();
}

main().catch(err => {
  console.error('실패:', err.message);
  process.exit(1);
});
