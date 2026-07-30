/**
 * @file AddModal.jsx
 * 미디어 추가 모달 — 단건 TMDB 검색 / 일괄 추가
 */

import { useState, useEffect } from 'react';
import { searchTmdb } from '../api/tmdb';
import { IMG_BASE } from '../utils/constants';
import { findExistingMedia } from '../utils/mediaMatch';

/**
 * @param {{ onClose: Function, onAdd: Function, existingItems: Array, currentTab: string }} props
 */
export default function AddModal({ onClose, onAdd, existingItems, currentTab }) {
  const [addMode, setAddMode] = useState('single');
  const [addType, setAddType] = useState('movie');
  const [singleQ, setSingleQ] = useState('');
  const [singleResults, setSingleResults] = useState([]);
  const [singleSearching, setSingleSearching] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [bulkItems, setBulkItems] = useState([]);
  const [bulkSearching, setBulkSearching] = useState(false);
  const [bulkProgress, setBulkProgress] = useState('');
  const [addedIds, setAddedIds] = useState(new Set());

  const tmdbType = addType === 'movie' ? 'movie' : 'tv';

  // 단건 검색 — 400ms 디바운스
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!singleQ.trim()) { setSingleResults([]); return; }
      setSingleSearching(true);
      const results = await searchTmdb(singleQ, tmdbType);
      setSingleResults(results);
      setSingleSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [singleQ, addType]);

  const handleAddSingle = async (r) => {
    const tmdbItemType = r.title ? 'movie' : 'tv';
    const title = r.title || r.name || '';
    const year = parseInt((r.release_date || r.first_air_date || '').slice(0, 4)) || 0;
    const type = addType === 'movie' ? 'movie' : (currentTab === 'drama' ? 'drama' : 'anime');
    const saved = await onAdd({
      type, title, year,
      director: '', cast_info: '',
      poster_url: r.poster_path ? IMG_BASE + r.poster_path : '',
      tmdb_id: r.id,
    });
    if (saved) setAddedIds(s => new Set([...s, r.id]));
  };

  const searchBulk = async () => {
    const titles = bulkInput.trim().split(/[\n,]+/).map(t => t.trim()).filter(Boolean);
    if (!titles.length) return;
    setBulkSearching(true);
    setBulkItems([]);
    const items = [];
    for (let i = 0; i < titles.length; i++) {
      const title = titles[i];
      setBulkProgress(`${i + 1} / ${titles.length} 검색 중... "${title}"`);
      let result = null;
      try {
        // 영화와 TV 동시 검색
        const [r1, r2] = await Promise.all([
          searchTmdb(title, 'movie'),
          searchTmdb(title, 'tv'),
        ]);
        const all = [...r1, ...r2];
        const match = all.find(x => x.poster_path) || all[0];
        if (match) {
          const tmdbItemType = match.title ? 'movie' : 'tv';
          const tmdbTitle = match.title || match.name || '';
          const year = parseInt((match.release_date || match.first_air_date || '').slice(0, 4)) || 0;
          const alreadyIn = !!findExistingMedia(existingItems, { tmdb_id: match.id, title: tmdbTitle, year });
          result = {
            tmdb_id: match.id,
            title: tmdbTitle, year,
            poster: match.poster_path ? IMG_BASE + match.poster_path : '',
            type: tmdbItemType === 'movie' ? 'movie' : (currentTab === 'drama' ? 'drama' : 'anime'),
            tmdbType: tmdbItemType, alreadyIn,
          };
        }
      } catch { /* 검색 실패 */ }
      items.push({ inputTitle: title, result, selected: !!result && !result?.alreadyIn });
      setBulkItems([...items]);
      await new Promise(r => setTimeout(r, 100));
    }
    setBulkSearching(false);
    setBulkProgress('');
  };

  const toggleBulk = (i) => {
    if (bulkItems[i].result?.alreadyIn) return;
    setBulkItems(prev => prev.map((it, idx) => idx === i ? { ...it, selected: !it.selected } : it));
  };

  const bulkSelectAll = () => {
    const avail = bulkItems.filter(i => i.result && !i.result.alreadyIn);
    const allSel = avail.every(i => i.selected);
    setBulkItems(prev => prev.map(it =>
      it.result && !it.result.alreadyIn ? { ...it, selected: !allSel } : it
    ));
  };

  const bulkAddSelected = async () => {
    for (const item of bulkItems.filter(i => i.selected && i.result)) {
      const r = item.result;
      await onAdd({ type: r.type, title: r.title, year: r.year, director: '', cast_info: '', poster_url: r.poster || '', tmdb_id: r.tmdb_id });
    }
    onClose();
  };

  const selectedCount = bulkItems.filter(i => i.selected).length;
  const availCount = bulkItems.filter(i => i.result && !i.result.alreadyIn).length;

  return (
    <div className="backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="add-modal" style={{ maxWidth: 560 }}>
        <h2>작품 추가</h2>
        <div className="tab-sel" style={{ marginBottom: 14 }}>
          {['single', 'bulk'].map(mode => (
            <button key={mode} className={addMode === mode ? 'active' : ''} onClick={() => setAddMode(mode)}>
              {mode === 'single' ? '단일 검색' : '일괄 추가'}
            </button>
          ))}
        </div>

        {addMode === 'single' && (
          <>
            <div className="tab-sel">
              {[['movie', '영화'], ['tv', '드라마 / 애니']].map(([t, label]) => (
                <button key={t} className={addType === t ? 'active' : ''} onClick={() => setAddType(t)}>{label}</button>
              ))}
            </div>
            <div className="add-row">
              <input
                className="add-input"
                value={singleQ}
                onChange={e => setSingleQ(e.target.value)}
                placeholder="제목으로 검색..."
                autoFocus
              />
            </div>
            <div className="result-list">
              {singleSearching && <div className="searching">검색 중...</div>}
              {!singleSearching && singleResults.length === 0 && singleQ && (
                <div className="searching">
                  결과 없음
                  {!singleQ.includes(' ') && /^[가-힣]{2,12}$/.test(singleQ.trim()) && (
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                      💡 띄어쓰기를 다르게 시도해보세요 (예: "다크 나이트")
                    </div>
                  )}
                </div>
              )}
              {singleResults.map(r => {
                const title = r.title || r.name || '';
                const year = (r.release_date || r.first_air_date || '').slice(0, 4);
                const added = !!findExistingMedia(existingItems, { tmdb_id: r.id, title, year: parseInt(year) || 0 }) || addedIds.has(r.id);
                return (
                  <div key={r.id} className="result-item">
                    <div className="result-thumb">
                      {r.poster_path ? <img src={IMG_BASE + r.poster_path} alt={title} /> : '🎬'}
                    </div>
                    <div className="result-info">
                      <div className="result-title">{title}</div>
                      <div className="result-sub">{year}{r.vote_average ? ` · ★${r.vote_average.toFixed(1)}` : ''}</div>
                    </div>
                    <button
                      className={`result-add-btn ${added ? 'added' : ''}`}
                      onClick={() => !added && handleAddSingle(r)}
                    >
                      {added ? '추가됨' : '추가'}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {addMode === 'bulk' && (
          <>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>제목을 줄바꿈 또는 쉼표로 구분해서 입력하세요</p>
            <textarea
              style={{ width: '100%', height: 120, padding: 10, fontSize: 14, border: '1px solid #ddd', borderRadius: 8, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
              value={bulkInput}
              onChange={e => setBulkInput(e.target.value)}
              placeholder={'그린북\n파이트클럽\n라이언일병구하기'}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8, marginBottom: 12 }}>
              <button className="btn btn-primary" onClick={searchBulk} disabled={bulkSearching}>
                {bulkSearching ? bulkProgress : '검색'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto', padding: 2 }}>
              {bulkItems.map((item, i) => {
                if (!item.result) return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid #eee', borderRadius: 8, opacity: .5 }}>
                    <div style={{ width: 32, height: 48, background: '#f0f0ee', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>?</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#999' }}>{item.inputTitle}</div>
                      <div style={{ fontSize: 11, color: '#bbb' }}>검색 결과 없음</div>
                    </div>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#f5f5f5', color: '#bbb' }}>미발견</span>
                  </div>
                );
                const r = item.result;
                const chk = item.selected;
                const dupl = r.alreadyIn;
                return (
                  <div key={i}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: `1px solid ${chk ? '#1a1a1a' : '#eee'}`, borderRadius: 8, cursor: dupl ? 'default' : 'pointer', opacity: dupl ? .6 : 1 }}
                    onClick={() => toggleBulk(i)}
                  >
                    <div style={{ width: 32, height: 48, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: '#f0f0ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, position: 'relative' }}>
                      {r.poster ? <img src={r.poster} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.remove()} alt={r.title} /> : '🎬'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: '#999' }}>{r.year} · {r.tmdbType === 'movie' ? '영화' : '드라마/애니'}</div>
                      {r.title !== item.inputTitle && <div style={{ fontSize: 11, color: '#aaa' }}>"{item.inputTitle}" 검색결과</div>}
                    </div>
                    {dupl
                      ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#e8f5e9', color: '#2e7d32', flexShrink: 0 }}>이미 추가됨</span>
                      : <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${chk ? '#1a1a1a' : '#ccc'}`, background: chk ? '#1a1a1a' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {chk && <span style={{ color: '#fff', fontSize: 12, lineHeight: 1 }}>✓</span>}
                        </div>
                    }
                  </div>
                );
              })}
            </div>

            {bulkItems.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <span style={{ fontSize: 13, color: '#888' }}>{selectedCount} / {availCount}개 선택됨</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={bulkSelectAll}>전체 선택</button>
                  <button className="btn btn-primary" onClick={bulkAddSelected} disabled={selectedCount === 0}>
                    선택 추가 ({selectedCount})
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ textAlign: 'right', marginTop: 12 }}>
          <button className="btn" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
