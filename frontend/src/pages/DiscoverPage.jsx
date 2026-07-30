/**
 * @file DiscoverPage.jsx
 * 작품 발견 페이지 (/discover) — Phase 10.4
 * 취향 기반 추천 + AI 채팅 추천 진입점 + 큐레이션 탐색
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import TokenIcon from '../components/TokenIcon';

const BASE = import.meta.env.VITE_API_URL;
const h = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const TYPE_LABEL = { movie: '영화', anime: '애니', drama: '드라마' };

/** 추천 카드 한 장 */
function RecCard({ rec, onAddToList, onAddToWishlist }) {
  const [listState, setListState]     = useState('idle'); // 'idle'|'adding'|'done'
  const [wishState, setWishState]     = useState('idle');

  const handleList = async () => {
    if (listState !== 'idle') return;
    setListState('adding');
    try {
      await axios.post(`${BASE}/api/user-media`, {
        type: rec.type || 'movie',
        title: rec.title,
        year: rec.year,
        tmdb_id: rec.tmdb_id,
        poster_url: rec.poster_url,
        director: '',
        cast_info: '',
      }, { headers: h() });
      setListState('done');
      onAddToList?.(rec.tmdb_id);
    } catch {
      setListState('idle');
    }
  };

  const handleWish = async () => {
    if (wishState !== 'idle') return;
    setWishState('adding');
    try {
      await axios.post(`${BASE}/api/me/watchlist`, {
        type: rec.type || 'movie',
        title: rec.title,
        year: rec.year,
        tmdb_id: rec.tmdb_id,
        poster_url: rec.poster_url,
      }, { headers: h() });
      setWishState('done');
    } catch {
      setWishState('idle');
    }
  };

  return (
    <div className="discover-card">
      {/* 포스터 */}
      <div className="discover-card-poster">
        {rec.poster_url
          ? <img src={rec.poster_url} alt={rec.title} loading="lazy" />
          : <span style={{ fontSize: 40, opacity: .2 }}>🎬</span>
        }
        <span className="discover-type-badge">{TYPE_LABEL[rec.type] || rec.type}</span>
      </div>

      {/* 정보 */}
      <div className="discover-card-info">
        <div className="discover-card-title">{rec.title}</div>
        <div className="discover-card-year">{rec.year || ''}</div>

        {/* 추천 이유 */}
        {rec.reason && (
          <div className="discover-card-reason">✨ {rec.reason}</div>
        )}

        {/* 장르 태그 */}
        {rec.genres?.length > 0 && (
          <div className="discover-card-genres">
            {rec.genres.slice(0, 3).map(g => (
              <span key={g} className="discover-genre-tag">{g}</span>
            ))}
          </div>
        )}

        {/* 줄거리 미리보기 */}
        {rec.overview && (
          <div className="discover-card-overview">{rec.overview.slice(0, 70)}...</div>
        )}

        {/* 액션 버튼 */}
        <div className="discover-card-actions">
          <button
            className={`discover-btn-list ${listState === 'done' ? 'done' : ''}`}
            onClick={handleList}
            disabled={listState !== 'idle'}
          >
            {listState === 'done' ? '✓ 추가됨' : listState === 'adding' ? '...' : '+ 내 목록'}
          </button>
          <button
            className={`discover-btn-wish ${wishState === 'done' ? 'done' : ''}`}
            onClick={handleWish}
            disabled={wishState !== 'idle'}
          >
            {wishState === 'done' ? '✓ 저장됨' : '🔖 나중에'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  const navigate = useNavigate();
  const [recs, setRecs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [offset, setOffset]     = useState(0);   // 6개씩 순환
  const PAGE_SIZE = 6;

  useEffect(() => {
    axios.get(`${BASE}/api/recommend/daily`, { headers: h() })
      .then(res => setRecs(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const displayed  = recs.slice(offset, offset + PAGE_SIZE);
  const hasMore    = recs.length > PAGE_SIZE;

  const handleRefresh = () =>
    setOffset(prev => (prev + PAGE_SIZE) % Math.max(recs.length, 1));

  return (
    <div className="discover-page">
      {/* 헤더 */}
      <div className="discover-header">
        <button className="btn" onClick={() => navigate('/')}>← 돌아가기</button>
        <h2 className="discover-title">🎬 발견하기</h2>
      </div>

      {/* AI 채팅 추천 진입 카드 */}
      <div className="discover-ai-card" onClick={() => navigate('/discover/chat')}>
        <div className="discover-ai-icon">🤖</div>
        <div className="discover-ai-body">
          <div className="discover-ai-title">AI에게 추천받기</div>
          <div className="discover-ai-sub">
            "오늘 기분에 맞는 영화" "넷플릭스 볼 거 추천" —
            대화하며 딱 맞는 작품을 찾아보세요
          </div>
          <div className="discover-ai-cost"><TokenIcon size={12} /> 2토큰/회</div>
        </div>
        <span className="discover-ai-arrow">→</span>
      </div>

      {/* 내 취향 기반 추천 */}
      <section className="discover-section">
        <div className="discover-section-header">
          <h3 className="discover-section-title">📊 내 취향 기반 추천</h3>
          {hasMore && (
            <button className="btn" style={{ fontSize: 12 }} onClick={handleRefresh}>
              다른 추천
            </button>
          )}
        </div>

        {loading ? (
          <div className="discover-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="discover-card skeleton" />
            ))}
          </div>
        ) : recs.length === 0 ? (
          <div className="discover-empty">
            <p>별점 4점 이상 작품을 기록하면 취향 기반 추천이 생성됩니다.</p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              작품 기록하기
            </button>
          </div>
        ) : (
          <div className="discover-grid">
            {displayed.map(rec => (
              <RecCard key={rec.tmdb_id} rec={rec} />
            ))}
          </div>
        )}
      </section>

      {/* 큐레이션 탐색 */}
      <section className="discover-section">
        <h3 className="discover-section-title">🗂 큐레이션 둘러보기</h3>
        <div
          className="discover-curation-banner"
          onClick={() => navigate('/restore')}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              77개 큐레이션 리스트 탐색
            </div>
            <div style={{ fontSize: 13, color: '#aaa' }}>
              감독별 · 수상작 · 국가별 · 장르별 · 프랜차이즈 · 드라마
            </div>
          </div>
          <span style={{ fontSize: 20, color: '#a78bfa' }}>→</span>
        </div>
      </section>
    </div>
  );
}
