/**
 * @file AiSearchModal.jsx
 * AI 자연어 검색 모달 — Claude API로 의도 파악 후 TMDB 검색
 * "우주 배경의 잔잔한 SF 영화" 같은 자유로운 표현으로 검색 가능
 */

import { useState } from 'react';
import axios from 'axios';

const BASE = 'http://localhost:4000/api';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

/**
 * @param {{
 *   onClose: Function,
 *   onAdd: Function,
 *   existingItems: Array,
 * }} props
 */
export default function AiSearchModal({ onClose, onAdd, existingItems }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [remaining, setRemaining] = useState(null);
  const [error, setError] = useState('');
  const [addedIds, setAddedIds] = useState(new Set());

  const existingTmdbIds = new Set(existingItems.map(i => i.tmdb_id).filter(Boolean));

  const handleSearch = async () => {
    if (!query.trim() || searching) return;
    setSearching(true);
    setError('');
    setResults([]);
    setExplanation('');

    try {
      const res = await axios.post(
        `${BASE}/search/natural`,
        { query },
        { headers: headers() }
      );
      setResults(res.data.data || []);
      setExplanation(res.data.meta?.explanation || '');
      setRemaining(res.data.meta?.remaining_calls ?? null);
    } catch (err) {
      const msg = err.response?.data?.message || 'AI 검색 중 오류가 발생했습니다';
      setError(msg);
    }
    setSearching(false);
  };

  const handleAdd = async (r) => {
    const saved = await onAdd({
      type: r.type,
      title: r.title,
      year: r.year,
      director: '',
      cast_info: '',
      poster_url: r.poster_url,
      tmdb_id: r.tmdb_id,
    });
    if (saved) setAddedIds(prev => new Set([...prev, r.tmdb_id]));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="add-modal" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 16 }}>✨</span>
          <h2 style={{ margin: 0 }}>AI 검색</h2>
          {remaining !== null && (
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#aaa' }}>
              오늘 {remaining}회 남음
            </span>
          )}
        </div>

        <p style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>
          찾고 싶은 작품을 자유롭게 설명해보세요
        </p>

        {/* 검색 입력 */}
        <div className="add-row">
          <input
            className="add-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="예: 우주 배경의 잔잔한 SF 영화, 90년대 홍콩 느와르, 성장 다루는 일본 애니"
            autoFocus
          />
          <button
            className="btn btn-primary"
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            style={{ whiteSpace: 'nowrap' }}
          >
            {searching ? '분석 중...' : '검색'}
          </button>
        </div>

        {/* 검색 해석 */}
        {explanation && (
          <div style={{
            fontSize: 12, color: '#888', marginBottom: 12, padding: '6px 10px',
            background: '#f8f8f6', borderRadius: 8, border: '1px solid #eee',
          }}>
            ✨ AI 해석: <strong>{explanation}</strong>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div style={{
            fontSize: 13, color: '#c0392b', marginBottom: 12, padding: '8px 12px',
            background: '#fdf0ef', borderRadius: 8, border: '1px solid #e0b4b0',
          }}>
            {error}
          </div>
        )}

        {/* 로딩 */}
        {searching && (
          <div className="searching" style={{ padding: '2rem' }}>
            Claude가 검색어를 분석하고 있어요...
          </div>
        )}

        {/* 결과 목록 */}
        <div className="result-list">
          {!searching && results.length === 0 && query && !error && (
            <div className="searching">결과가 없습니다</div>
          )}
          {results.map(r => {
            const inList = existingTmdbIds.has(r.tmdb_id) || addedIds.has(r.tmdb_id);
            return (
              <div key={r.tmdb_id} className="result-item">
                <div className="result-thumb">
                  {r.poster_url
                    ? <img src={r.poster_url} alt={r.title} />
                    : '🎬'
                  }
                </div>
                <div className="result-info">
                  <div className="result-title">{r.title}</div>
                  <div className="result-sub">
                    {r.year || ''}
                    {r.vote_average > 0 ? ` · ★${r.vote_average.toFixed(1)}` : ''}
                  </div>
                  {r.overview && (
                    <div style={{
                      fontSize: 11, color: '#aaa', marginTop: 2,
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {r.overview}
                    </div>
                  )}
                </div>
                <button
                  className={`result-add-btn ${inList ? 'added' : ''}`}
                  onClick={() => !inList && handleAdd(r)}
                >
                  {inList ? '추가됨' : '추가'}
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: 'right', marginTop: 12 }}>
          <button className="btn" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
