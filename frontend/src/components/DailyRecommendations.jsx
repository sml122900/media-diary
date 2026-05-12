/**
 * @file DailyRecommendations.jsx
 * 홈 상단 "오늘의 추천" 위젯 — 취향 프로필 기반 3개 카드
 * "다른 추천 보기" 버튼으로 캐시된 12개 후보 중 3개씩 순환
 */

import { useState, useEffect } from 'react';
import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL}/api`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

/**
 * @param {{
 *   onAdd: Function,
 *   existingItems: Array,
 * }} props
 */
export default function DailyRecommendations({ onAdd, existingItems }) {
  const [candidates, setCandidates] = useState([]); // 서버에서 받은 최대 12개
  const [offset, setOffset] = useState(0);           // 3개씩 순환할 인덱스
  const [loading, setLoading] = useState(true);
  const [addedIds, setAddedIds] = useState(new Set());

  useEffect(() => {
    axios.get(`${BASE}/recommend/daily`, { headers: headers() })
      .then(res => {
        setCandidates(res.data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // 3개 단위로 순환
  const displayed = candidates.slice(offset, offset + 3);
  const hasMore = candidates.length > 3;

  const handleRefresh = () => {
    // 다음 3개로 이동 (끝에 도달하면 처음으로)
    setOffset(prev => (prev + 3) % Math.max(candidates.length, 1));
  };

  const handleAdd = async (rec) => {
    const saved = await onAdd({
      type: rec.type,
      title: rec.title,
      year: rec.year,
      director: '',
      cast_info: '',
      poster_url: rec.poster_url,
      tmdb_id: rec.tmdb_id,
    });
    if (saved) setAddedIds(prev => new Set([...prev, rec.tmdb_id]));
  };

  const existingTmdbIds = new Set(existingItems.map(i => i.tmdb_id).filter(Boolean));

  // 로딩 중이면 스켈레톤 (구조 유지)
  if (loading) return (
    <div className="daily-rec-section">
      <div className="daily-rec-header">
        <span className="daily-rec-title">오늘의 추천</span>
      </div>
      <div className="daily-rec-grid">
        {[1, 2, 3].map(i => (
          <div key={i} className="daily-rec-card skeleton" />
        ))}
      </div>
    </div>
  );

  // 추천이 없으면 (별점 기록 없거나 추천 불가) 렌더링 생략
  if (!candidates.length) return null;

  return (
    <div className="daily-rec-section">
      <div className="daily-rec-header">
        <span className="daily-rec-title">오늘의 추천</span>
        {hasMore && (
          <button className="btn" style={{ fontSize: 12, padding: '3px 10px' }} onClick={handleRefresh}>
            다른 추천 보기
          </button>
        )}
      </div>

      <div className="daily-rec-grid">
        {displayed.map(rec => {
          const inList = existingTmdbIds.has(rec.tmdb_id) || addedIds.has(rec.tmdb_id);
          return (
            <div key={rec.tmdb_id} className="daily-rec-card">
              {/* 포스터 */}
              <div className="daily-rec-poster">
                {rec.poster_url
                  ? <img src={rec.poster_url} alt={rec.title} onError={e => { e.target.style.display = 'none'; }} />
                  : <span style={{ fontSize: 32, opacity: .25 }}>🎬</span>
                }
              </div>

              {/* 정보 */}
              <div className="daily-rec-info">
                <div className="daily-rec-item-title" title={rec.title}>{rec.title}</div>
                <div className="daily-rec-year">{rec.year || ''}</div>

                {/* 추천 이유 */}
                {rec.reason && (
                  <div className="daily-rec-reason">{rec.reason}</div>
                )}

                {/* 장르 태그 (최대 2개) */}
                {rec.genres?.length > 0 && (
                  <div className="daily-rec-genres">
                    {rec.genres.slice(0, 2).map(g => (
                      <span key={g} className="daily-rec-genre-tag">{g}</span>
                    ))}
                  </div>
                )}

                {/* 추가 버튼 */}
                <button
                  className={`similar-add-btn ${inList ? 'added' : ''}`}
                  style={{ marginTop: 8 }}
                  onClick={() => !inList && handleAdd(rec)}
                  disabled={inList}
                >
                  {inList ? '추가됨' : '+ 내 목록에 추가'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
