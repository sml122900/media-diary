/**
 * @file PosterPicker.jsx
 * 포스터 교체 모달 — TMDB 검색 결과를 그리드로 표시, 클릭으로 선택
 */

import { useState, useEffect } from 'react';
import { searchTmdbPosters } from '../api/tmdb';
import { IMG_BASE } from '../utils/constants';

/**
 * @param {{ item: object, onClose: Function, onApply: Function }} props
 * onApply(posterUrl) — 선택한 포스터 URL 전달
 */
export default function PosterPicker({ item, onClose, onApply }) {
  const [query, setQuery] = useState(item.title);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const tmdbType = item.type === 'movie' ? 'movie' : 'tv';

  const search = async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    const data = await searchTmdbPosters(q, tmdbType);
    setResults(data);
    setSearching(false);
  };

  // 마운트 시 현재 제목으로 자동 검색
  useEffect(() => { search(item.title); }, []);

  // 입력 400ms 디바운스 검색
  useEffect(() => {
    const timer = setTimeout(() => search(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="add-modal" style={{ maxWidth: 520 }}>
        <h2>포스터 변경</h2>
        <div className="add-row" style={{ marginBottom: 12 }}>
          <input
            className="add-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="제목으로 검색..."
            autoFocus
          />
        </div>

        {searching && <div className="searching">검색 중...</div>}

        {!searching && results.length === 0 && (
          <div className="searching">포스터를 찾을 수 없습니다</div>
        )}

        <div className="picker-grid">
          {results.map(r => (
            <div
              key={r.id}
              className="picker-item"
              onClick={() => onApply(IMG_BASE + r.poster_path)}
              title={r.title || r.name}
            >
              <img
                src={IMG_BASE + r.poster_path}
                alt={r.title || r.name}
                loading="lazy"
                onError={e => { e.target.style.display = 'none'; }}
              />
              <div className="picker-item-title">{r.title || r.name}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'right', marginTop: 12 }}>
          <button className="btn" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
