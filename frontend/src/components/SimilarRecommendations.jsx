/**
 * @file SimilarRecommendations.jsx
 * "이 작품을 좋아하셨다면" 추천 섹션 — 가로 스크롤 카드 리스트
 * DetailModal 하단에 삽입됨
 */

import { useState, useEffect } from 'react';
import { fetchSimilarRecs } from '../api/recommend';
import { findExistingMedia } from '../utils/mediaMatch';

/**
 * @param {{
 *   mediaId: number,
 *   onAdd: Function,
 *   existingItems: Array,
 * }} props
 */
export default function SimilarRecommendations({ mediaId, onAdd, existingItems }) {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addedIds, setAddedIds] = useState(new Set());

  // 모달 열릴 때 추천 조회
  useEffect(() => {
    setLoading(true);
    fetchSimilarRecs(mediaId).then(data => {
      setRecs(data);
      setLoading(false);
    });
  }, [mediaId]);

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

  // 로딩 중이거나 결과 없으면 렌더링 생략
  if (loading) return (
    <div className="similar-section">
      <div className="similar-title">이 작품을 좋아하셨다면</div>
      <div style={{ fontSize: 13, color: '#aaa', padding: '12px 0' }}>추천 로딩 중...</div>
    </div>
  );
  if (!recs.length) return null;

  return (
    <div className="similar-section">
      <div className="similar-title">이 작품을 좋아하셨다면</div>
      <div className="similar-scroll">
        {recs.map(rec => {
          const inList = !!findExistingMedia(existingItems, rec) || addedIds.has(rec.tmdb_id);
          return (
            <div key={rec.tmdb_id} className="similar-card">
              {/* 포스터 */}
              <div className="similar-poster">
                {rec.poster_url
                  ? <img src={rec.poster_url} alt={rec.title} onError={e => { e.target.style.display = 'none'; }} />
                  : <span style={{ fontSize: 22, opacity: .3 }}>🎬</span>
                }
              </div>

              {/* 정보 */}
              <div className="similar-card-title" title={rec.title}>{rec.title}</div>
              {rec.year > 0 && <div className="similar-card-year">{rec.year}</div>}

              {/* 장르 (최대 2개) */}
              {rec.genres?.length > 0 && (
                <div className="similar-card-genres">
                  {rec.genres.slice(0, 2).map(g => (
                    <span key={g} className="similar-genre-tag">{g}</span>
                  ))}
                </div>
              )}

              {/* 추가 버튼 */}
              <button
                className={`similar-add-btn ${inList ? 'added' : ''}`}
                onClick={() => !inList && handleAdd(rec)}
                disabled={inList}
              >
                {inList ? '추가됨' : '+ 추가'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
