/**
 * @file seed-curation.js
 * 큐레이션 JSON 파일을 읽어 DB에 일괄 삽입하는 시드 스크립트
 * 실행: node backend/scripts/seed-curation.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

const SEED_DIR = path.resolve(__dirname, '../seed/curation');

async function seedCuration() {
  const files = fs.readdirSync(SEED_DIR).filter(f => f.endsWith('.json'));
  let totalLists = 0;
  let totalItems = 0;

  for (const file of files) {
    const filePath = path.join(SEED_DIR, file);
    const { lists } = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    for (const list of lists) {
      // curation_lists 삽입 — slug 충돌 시 메타정보 업데이트
      const { rows } = await pool.query(
        `INSERT INTO curation_lists
           (slug, title, category, description, region, media_type, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (slug) DO UPDATE SET
           title        = EXCLUDED.title,
           category     = EXCLUDED.category,
           description  = EXCLUDED.description,
           region       = EXCLUDED.region,
           media_type   = EXCLUDED.media_type,
           display_order = EXCLUDED.display_order
         RETURNING id`,
        [list.slug, list.title, list.category, list.description ?? null,
         list.region ?? null, list.media_type ?? null, list.display_order ?? 0]
      );
      const listId = rows[0].id;
      totalLists++;

      // curation_items 삽입 — (list_id, tmdb_id) 중복 시 스킵
      for (const item of list.items) {
        await pool.query(
          `INSERT INTO curation_items
             (list_id, tmdb_id, tmdb_type, title, year, poster_path, display_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (list_id, tmdb_id) DO NOTHING`,
          [listId, item.tmdb_id, item.tmdb_type, item.title,
           item.year ?? null, item.poster_path ?? null, item.display_order ?? 0]
        );
        totalItems++;
      }

      console.log(`✓ [${file}] "${list.title}" — ${list.items.length}개 아이템`);
    }
  }

  console.log(`\n완료: 총 ${totalLists}개 리스트, ${totalItems}개 아이템 처리`);
  await pool.end();
}

seedCuration().catch(err => {
  console.error('시드 실패:', err.message);
  process.exit(1);
});
