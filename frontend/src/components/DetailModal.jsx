/**
 * @file DetailModal.jsx
 * 미디어 상세 모달 — 리뷰 작성, 항목 편집, 포스터 교체, 삭제
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import TmdbInfoPanel from './TmdbInfoPanel';
import StarRating from './StarRating';
import PosterPicker from './PosterPicker';
import SimilarRecommendations from './SimilarRecommendations';
import { fetchTmdbDetail, searchTmdbPoster } from '../api/tmdb';
import { AWARDS } from '../utils/constants';

/**
 * @param {{
 *   item: object,
 *   posterUrl: string,
 *   tmdbUrlCache: React.MutableRefObject,
 *   tmdbIdCache: React.MutableRefObject,
 *   tmdbDetailCache: React.MutableRefObject,
 *   onClose: Function,
 *   onSave: Function,
 *   onDeleteReview: Function,
 *   onDeleteItem: Function,
 *   onEditItem: Function,
 *   onUpdatePoster: Function,
 * }} props
 */
export default function DetailModal({
  item, posterUrl, tmdbUrlCache, tmdbIdCache, tmdbDetailCache,
  onClose, onSave, onDeleteReview, onDeleteItem, onEditItem, onUpdatePoster,
  onAdd, existingItems,
}) {
  const [rating, setRating] = useState(item.rating || 0);
  const [reviewText, setReviewText] = useState(item.review_text || '');
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState({
    title: item.title, year: item.year,
    director: item.director, cast_info: item.cast_info, type: item.type,
  });
  const [tmdbDetail, setTmdbDetail] = useState(null);
  const [tmdbUrl, setTmdbUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [posterPickerOpen, setPosterPickerOpen] = useState(false);
  const [currentPosterUrl, setCurrentPosterUrl] = useState(posterUrl);
  // 리뷰 공개/비공개
  const [isPublic, setIsPublic] = useState(item.is_public || false);
  // 다른 사람들의 공개 리뷰
  const [publicReviews, setPublicReviews] = useState([]);
  const [publicReviewsLoaded, setPublicReviewsLoaded] = useState(false);

  const cacheKey = `${item.title}_${item.year}`;
  // anime/drama는 tv 타입으로 조회
  const tmdbType = item.type === 'movie' ? 'movie' : 'tv';

  // 다른 사람들의 공개 리뷰 로드 (tmdb_id 있는 작품만)
  useEffect(() => {
    if (!item.tmdb_id) return;
    axios.get(`http://localhost:4000/api/user-media/public/${item.tmdb_id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    }).then(res => {
      setPublicReviews(res.data.data || []);
      setPublicReviewsLoaded(true);
    }).catch(() => setPublicReviewsLoaded(true));
  }, [item.tmdb_id]);

  useEffect(() => {
    setTmdbUrl(tmdbUrlCache.current[cacheKey] || null);

    const loadDetail = async () => {
      if (tmdbDetailCache.current[cacheKey]) {
        setTmdbDetail(tmdbDetailCache.current[cacheKey]);
        return;
      }
      let idInfo = tmdbIdCache.current[cacheKey];
      if (!idInfo && item.tmdb_id) {
        idInfo = { id: item.tmdb_id, type: tmdbType };
        tmdbIdCache.current[cacheKey] = idInfo;
      }
      if (!idInfo) {
        const res = await searchTmdbPoster(item.title, item.year, tmdbType);
        if (res) {
          idInfo = { id: res.tmdbId, type: res.tmdbType };
          tmdbIdCache.current[cacheKey] = idInfo;
          if (!tmdbUrlCache.current[cacheKey]) {
            const slug = res.tmdbTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            tmdbUrlCache.current[cacheKey] = `https://www.themoviedb.org/${res.tmdbType}/${res.tmdbId}${slug ? '-' + slug : ''}`;
            setTmdbUrl(tmdbUrlCache.current[cacheKey]);
          }
        }
      }
      if (!idInfo) return;
      const detail = await fetchTmdbDetail(idInfo.id, idInfo.type);
      if (detail) {
        tmdbDetailCache.current[cacheKey] = detail;
        setTmdbDetail(detail);
      }
    };
    loadDetail();
  }, [item.id]);

  const hasReview = item.rating > 0 || item.review_text;
  const awardKey = `${item.title}_${item.year}`;

  const handleSave = async () => {
    setSaving(true);
    await onSave(item, rating, reviewText, isPublic);
    setSaving(false);
    onClose();
  };

  const handleDeleteReview = async () => {
    if (!window.confirm('감상을 삭제할까요?')) return;
    await onDeleteReview(item);
    onClose();
  };

  const handleDeleteItem = async () => {
    if (!window.confirm(`"${item.title}"을(를) 목록에서 제거할까요?\n감상 기록도 함께 삭제됩니다.`)) return;
    await onDeleteItem(item.id);
    onClose();
  };

  const handleApplyEdit = async () => {
    if (!editFields.title.trim()) { alert('제목을 입력해주세요'); return; }
    await onEditItem(item, editFields);
    setEditMode(false);
  };

  const handleApplyPoster = async (url) => {
    await onUpdatePoster(item.id, url);
    setCurrentPosterUrl(url);
    setPosterPickerOpen(false);
  };

  return (
    <>
      <div className="backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal">
          <div className="mhead">
            <div className="mposter">
              <span style={{ fontSize: 30, opacity: .3, zIndex: 0 }}>🎬</span>
              {currentPosterUrl && (
                <img
                  src={currentPosterUrl}
                  alt={item.title}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1, borderRadius: 10 }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
              <button
                onClick={() => setPosterPickerOpen(true)}
                className="poster-change-btn"
                title="포스터 변경"
              >
                🖼
              </button>
            </div>

            <div className="minfo">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div className="mtitle" style={{ flex: 1 }}>
                  {tmdbUrl ? (
                    <a href={tmdbUrl} target="_blank" rel="noopener noreferrer"
                      style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1.5px solid rgba(128,128,128,.4)', paddingBottom: 1 }}>
                      {item.title} <span style={{ fontSize: 13, opacity: .5 }}>↗</span>
                    </a>
                  ) : item.title}
                </div>
                <button
                  className="btn"
                  onClick={() => {
                    if (!editMode) {
                      setEditFields({ title: item.title, year: item.year, director: item.director || '', cast_info: item.cast_info || '', type: item.type });
                    }
                    setEditMode(v => !v);
                  }}
                  style={{ padding: '3px 9px', fontSize: 12, flexShrink: 0 }}
                >
                  {editMode ? '닫기' : '편집'}
                </button>
              </div>

              {editMode && (
                <div style={{ marginBottom: 8 }}>
                  {[
                    { key: 'title', placeholder: '제목' },
                    { key: 'director', placeholder: '감독' },
                    { key: 'cast_info', placeholder: '출연' },
                    { key: 'year', placeholder: '연도', type: 'number' },
                  ].map(({ key, placeholder, type }) => (
                    <input
                      key={key}
                      type={type || 'text'}
                      value={editFields[key]}
                      onChange={e => setEditFields(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      style={{ width: '100%', padding: '5px 8px', fontSize: key === 'title' ? 14 : 13, border: '1px solid #ddd', borderRadius: 6, marginBottom: 6, fontFamily: 'inherit', background: '#fff', color: 'inherit' }}
                    />
                  ))}
                  <select
                    value={editFields.type}
                    onChange={e => setEditFields(f => ({ ...f, type: e.target.value }))}
                    style={{ width: '100%', padding: '5px 8px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, marginBottom: 6, fontFamily: 'inherit', background: '#fff', color: 'inherit' }}
                  >
                    <option value="movie">영화</option>
                    <option value="anime">애니메이션</option>
                    <option value="drama">드라마</option>
                  </select>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
                    <button className="btn" onClick={() => setEditMode(false)} style={{ fontSize: 12, padding: '4px 10px' }}>취소</button>
                    <button className="btn btn-primary" onClick={handleApplyEdit} style={{ fontSize: 12, padding: '4px 10px' }}>적용</button>
                  </div>
                </div>
              )}

              <div className="mmeta">{item.year}{item.director ? ' · ' + item.director : ''}</div>
              <div className="mcast">{item.cast_info ? '출연: ' + item.cast_info : ''}</div>
              {AWARDS[awardKey] && <div><span className="award">🏆 {AWARDS[awardKey]}</span></div>}
              <TmdbInfoPanel detail={tmdbDetail} />
            </div>
          </div>

          <div className="mbody">
            {hasReview && (
              <div className="prev-review">
                <div className="prev-stars">{'★'.repeat(item.rating || 0)}{'☆'.repeat(5 - (item.rating || 0))}</div>
                {item.review_text || '(메모 없음)'}
                {item.review_date && <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>{item.review_date}</div>}
              </div>
            )}

            <label>별점</label>
            <StarRating value={rating} onChange={setRating} />

            <label>감상 메모</label>
            <textarea
              className="review-ta"
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              placeholder="자유롭게 감상을 적어보세요..."
            />

            {/* 리뷰 공개/비공개 토글 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 4 }}>
              <div
                className={`settings-toggle ${isPublic ? 'on' : ''}`}
                style={{ width: 36, height: 20 }}
                onClick={() => setIsPublic(v => !v)}
              >
                <div className="settings-toggle-knob" style={{ width: 14, height: 14, top: 3, left: isPublic ? 19 : 3 }} />
              </div>
              <span style={{ fontSize: 12, color: '#888' }}>
                {isPublic ? '리뷰 공개 — 다른 사용자가 볼 수 있습니다' : '리뷰 비공개'}
              </span>
            </div>

            <div className="mactions">
              <div style={{ display: 'flex', gap: 8 }}>
                {hasReview && (
                  <button className="btn btn-danger" onClick={handleDeleteReview}>감상 삭제</button>
                )}
                <button className="btn btn-danger" onClick={handleDeleteItem}>목록에서 제거</button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                <button className="btn" onClick={onClose}>닫기</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>

            {/* 다른 사람들의 공개 리뷰 */}
            {publicReviewsLoaded && publicReviews.length > 0 && (
              <div className="public-reviews-section">
                <div className="similar-title">다른 사람들의 리뷰</div>
                {publicReviews.map((r, i) => (
                  <div key={i} className="public-review-item">
                    <div className="public-review-header">
                      <div className="public-review-user">
                        {r.avatar_url ? (
                          <img src={r.avatar_url} alt={r.name} className="public-review-avatar" />
                        ) : (
                          <div className="public-review-avatar-ph">👤</div>
                        )}
                        <span className="public-review-name">{r.username || r.name}</span>
                      </div>
                      {r.rating > 0 && (
                        <span className="public-review-stars">{'★'.repeat(r.rating)}</span>
                      )}
                    </div>
                    {r.review_text && (
                      <div className="public-review-text">{r.review_text}</div>
                    )}
                    {r.review_date && (
                      <div className="public-review-date">{r.review_date}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 비슷한 작품 추천 (tmdb_id 있는 작품만) */}
            {item.tmdb_id > 0 && onAdd && (
              <SimilarRecommendations
                mediaId={item.id}
                onAdd={onAdd}
                existingItems={existingItems || []}
              />
            )}
          </div>
        </div>
      </div>

      {/* 포스터 교체 모달 */}
      {posterPickerOpen && (
        <PosterPicker
          item={item}
          onClose={() => setPosterPickerOpen(false)}
          onApply={handleApplyPoster}
        />
      )}
    </>
  );
}
