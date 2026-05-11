/**
 * @file WishlistPage.jsx
 * 개인 위시리스트 페이지 (/wishlist) — Phase 5.2
 * "나중에 보기" 목록 관리 + TMDB 검색으로 추가
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { searchTmdb } from '../api/tmdb';
import { IMG_BASE } from '../utils/constants';
import { useTheme } from '../hooks/useTheme';

const BASE = 'http://localhost:4000/api/me';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const TYPE_LABEL = { movie: '영화', anime: '애니메이션', drama: '드라마' };
const PLATFORMS = ['넷플릭스', '왓챠', '웨이브', '시즌', '디즈니+', '극장', '기타'];

/** 별 우선순위 표시 컴포넌트 */
function PriorityStars({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3].map(n => (
        <button
          key={n}
          onClick={() => onChange(value === n ? 0 : n)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 0,
            color: n <= value ? '#f0a500' : '#ccc' }}
          title={n === 1 ? '보통' : n === 2 ? '보고 싶음' : '꼭 봐야 함'}
        >★</button>
      ))}
    </div>
  );
}

/** 시청 완료 미니 폼 */
function WatchedForm({ item, onSubmit, onCancel }) {
  const [rating, setRating] = useState(0);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    await onSubmit(item.id, rating);
    setSaving(false);
  };

  return (
    <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,.03)', borderTop: '1px solid #eee' }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>별점을 선택하고 저장하세요</div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, justifyContent: 'center' }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={() => setRating(r => r === n ? 0 : n)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22,
              color: n <= rating ? '#f0a500' : '#ccc', padding: 0 }}
          >★</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn" onClick={onCancel} style={{ flex: 1, fontSize: 12 }}>취소</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving} style={{ flex: 1, fontSize: 12 }}>
          {saving ? '저장 중...' : '기록 저장'}
        </button>
      </div>
    </div>
  );
}

export default function WishlistPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // 검색 상태
  const [searchQ, setSearchQ] = useState('');
  const [searchType, setSearchType] = useState('movie');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addedIds, setAddedIds] = useState(new Set());

  // 시청 완료 폼
  const [watchedFormId, setWatchedFormId] = useState(null);

  // 노트 편집
  const [editNoteId, setEditNoteId] = useState(null);
  const [editNote, setEditNote] = useState('');

  // 위시리스트 로드
  const loadWishlist = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE}/watchlist`, { headers: headers() });
      setItems(res.data.data || []);
    } catch { /* 에러 무시 */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadWishlist(); }, [loadWishlist]);

  // TMDB 검색 디바운스
  useEffect(() => {
    const tmdbType = searchType === 'movie' ? 'movie' : 'tv';
    const timer = setTimeout(async () => {
      if (!searchQ.trim()) { setSearchResults([]); return; }
      setSearching(true);
      const results = await searchTmdb(searchQ, tmdbType);
      setSearchResults(results);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQ, searchType]);

  // 위시리스트에 추가
  const handleAdd = async (r) => {
    const title = r.title || r.name || '';
    const year = parseInt((r.release_date || r.first_air_date || '').slice(0, 4)) || 0;
    const type = searchType === 'movie' ? 'movie' : 'drama';
    try {
      await axios.post(`${BASE}/watchlist`, {
        type, title, year, tmdb_id: r.id,
        poster_url: r.poster_path ? IMG_BASE + r.poster_path : '',
      }, { headers: headers() });
      setAddedIds(s => new Set([...s, r.id]));
      loadWishlist();
    } catch { /* 이미 있을 수 있음 */ }
  };

  // 우선순위 변경
  const handlePriority = async (id, priority) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, priority } : i));
    await axios.patch(`${BASE}/watchlist/${id}`, { priority }, { headers: headers() });
  };

  // 노트 저장
  const handleSaveNote = async (id) => {
    await axios.patch(`${BASE}/watchlist/${id}`, { note: editNote }, { headers: headers() });
    setItems(prev => prev.map(i => i.id === id ? { ...i, note: editNote } : i));
    setEditNoteId(null);
  };

  // 삭제
  const handleDelete = async (id) => {
    if (!window.confirm('위시리스트에서 제거할까요?')) return;
    await axios.delete(`${BASE}/watchlist/${id}`, { headers: headers() });
    setItems(prev => prev.filter(i => i.id !== id));
  };

  // 시청 완료 처리
  const handleWatched = async (id, rating) => {
    await axios.post(`${BASE}/watchlist/${id}/watched`, { rating }, { headers: headers() });
    setItems(prev => prev.filter(i => i.id !== id));
    setWatchedFormId(null);
  };

  const wishedTmdbIds = new Set(items.map(i => i.tmdb_id).filter(Boolean));

  return (
    <div className="mdb-container">
      {/* 헤더 */}
      <div className="mdb-header">
        <h1 className="mdb-title">나중에 보기</h1>
        <div className="mdb-controls">
          <button className="btn" onClick={toggleTheme}>{theme === 'dark' ? '라이트' : '다크'}</button>
          <button className="btn" onClick={() => navigate('/')}>← 돌아가기</button>
        </div>
      </div>

      {/* TMDB 검색 */}
      <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #e8e8e8)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>작품 검색해서 추가하기</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {[['movie', '영화'], ['tv', '드라마 / 애니']].map(([t, label]) => (
            <button key={t} className={searchType === t ? 'tab-btn active' : 'tab-btn'} onClick={() => setSearchType(t)}>{label}</button>
          ))}
        </div>
        <input
          className="search-input"
          style={{ width: '100%', marginBottom: 8 }}
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          placeholder="제목으로 검색..."
        />
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          {searching && <div style={{ padding: '8px 0', fontSize: 13, color: '#888' }}>검색 중...</div>}
          {!searching && searchQ && searchResults.length === 0 && <div style={{ padding: '8px 0', fontSize: 13, color: '#aaa' }}>결과 없음</div>}
          {searchResults.map(r => {
            const title = r.title || r.name || '';
            const year = (r.release_date || r.first_air_date || '').slice(0, 4);
            const alreadyAdded = wishedTmdbIds.has(r.id) || addedIds.has(r.id);
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
                  className={`result-add-btn ${alreadyAdded ? 'added' : ''}`}
                  onClick={() => !alreadyAdded && handleAdd(r)}
                >
                  {alreadyAdded ? '추가됨' : '+ 추가'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 위시리스트 목록 */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>불러오는 중...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#aaa', padding: 60 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15 }}>아직 위시리스트가 비어있어요</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>위에서 작품을 검색해 추가해보세요!</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>총 {items.length}편</div>
          <div className="wishlist-grid">
            {items.map(item => (
              <div key={item.id} className="wishlist-card">
                {/* 포스터 */}
                <div className="wishlist-poster">
                  {item.poster_url
                    ? <img src={item.poster_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 24, opacity: .3 }}>🎬</div>
                  }
                </div>

                {/* 정보 */}
                <div className="wishlist-info">
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
                    {item.year > 0 ? item.year + ' · ' : ''}{TYPE_LABEL[item.type] || item.type}
                  </div>

                  {/* 우선순위 */}
                  <PriorityStars value={item.priority} onChange={v => handlePriority(item.id, v)} />

                  {/* 플랫폼 */}
                  {item.intended_platform && (
                    <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>📺 {item.intended_platform}</div>
                  )}

                  {/* 노트 */}
                  {editNoteId === item.id ? (
                    <div style={{ marginTop: 6 }}>
                      <input
                        style={{ width: '100%', fontSize: 12, padding: '4px 6px', border: '1px solid #ddd', borderRadius: 6, marginBottom: 4 }}
                        value={editNote}
                        onChange={e => setEditNote(e.target.value)}
                        placeholder="메모..."
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveNote(item.id); if (e.key === 'Escape') setEditNoteId(null); }}
                      />
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setEditNoteId(null)}>취소</button>
                        <button className="btn btn-primary" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => handleSaveNote(item.id)}>저장</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{ fontSize: 11, color: item.note ? '#666' : '#bbb', marginTop: 4, cursor: 'pointer' }}
                      onClick={() => { setEditNoteId(item.id); setEditNote(item.note || ''); }}
                    >
                      {item.note || '+ 메모 추가'}
                    </div>
                  )}
                </div>

                {/* 액션 버튼 */}
                <div className="wishlist-actions">
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => setWatchedFormId(watchedFormId === item.id ? null : item.id)}
                  >
                    봤어요!
                  </button>
                  <button
                    className="btn"
                    style={{ fontSize: 12, padding: '4px 8px' }}
                    onClick={() => handleDelete(item.id)}
                    title="위시리스트에서 제거"
                  >
                    ✕
                  </button>
                </div>

                {/* 시청 완료 폼 */}
                {watchedFormId === item.id && (
                  <WatchedForm item={item} onSubmit={handleWatched} onCancel={() => setWatchedFormId(null)} />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
