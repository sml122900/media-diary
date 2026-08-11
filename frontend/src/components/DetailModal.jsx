/**
 * @file DetailModal.jsx
 * 미디어 상세 모달 — 리뷰 작성, 항목 편집, 포스터 교체, 삭제
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import TmdbInfoPanel from './TmdbInfoPanel';
import StarRating from './StarRating';
import PosterPicker from './PosterPicker';
import EpithetPicker from './EpithetPicker';
import AxisRatingPicker from './AxisRatingPicker';
import { fetchTmdbDetail, searchTmdbPoster } from '../api/tmdb';
import { AWARDS } from '../utils/constants';

const BASE = `${import.meta.env.VITE_API_URL}/api`;

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
  // 기본 정보 / 보러가기 탭
  const [activeTab, setActiveTab] = useState('info');
  // 다른 사람들의 공개 리뷰
  const [publicReviews, setPublicReviews] = useState([]);
  const [publicReviewsLoaded, setPublicReviewsLoaded] = useState(false);
  // 재시청 상태
  const [rewatchHistory, setRewatchHistory] = useState([]);
  const [rewatchFormOpen, setRewatchFormOpen] = useState(false);
  const [rewatchRating, setRewatchRating] = useState(0);
  const [rewatchNote, setRewatchNote] = useState('');
  const [rewatchDate, setRewatchDate] = useState(new Date().toISOString().slice(0, 10)); // 오늘 날짜 기본값
  const [rewatchDateUnknown, setRewatchDateUnknown] = useState(false); // "기억이 안 나요" 상태
  const [rewatchSaving, setRewatchSaving] = useState(false);
  // 컨텍스트 섹션
  const [contextOpen, setContextOpen] = useState(false);
  const [ctxWith, setCtxWith] = useState(item.watched_with || '');
  const [ctxPlace, setCtxPlace] = useState(item.watched_at_place || '');
  const [ctxMood, setCtxMood] = useState(item.mood || '');
  // 시청 날짜 — 기존 watched_at 있으면 YYYY-MM-DD로 초기화
  const [watchedDate, setWatchedDate] = useState(
    item.watched_at ? new Date(item.watched_at).toISOString().slice(0, 10) : ''
  );
  // "기억이 안 나요" — watched_at 없고 life_period 있으면 true로 초기화
  const [dateUnknown, setDateUnknown] = useState(!item.watched_at && !!item.life_period);
  // 시청 시기 자유 텍스트 (기억이 안 나요 클릭 시 노출)
  const [lifePeriod, setLifePeriod] = useState(item.life_period || '');

  const cacheKey = `${item.title}_${item.year}`;
  // anime/drama는 tv 타입으로 조회
  const tmdbType = item.type === 'movie' ? 'movie' : 'tv';

  // 친구 활동 상태
  const [friendsActivity, setFriendsActivity] = useState(null);
  // 수식어 (Phase 13.1)
  const [epithets, setEpithets] = useState([]);
  const [epithetPickerOpen, setEpithetPickerOpen] = useState(false);
  // 다면 별점 (Phase 13.3) — 내 별점(rating)과 완전 독립된 부가 평가 축
  const [axes, setAxes] = useState([]);
  const [axisPickerOpen, setAxisPickerOpen] = useState(false);

  // 다른 사람들의 공개 리뷰 + 친구 활동 로드 (TMDB 매칭된 작품만)
  useEffect(() => {
    if (!item.tmdb_id) return;
    const auth = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    Promise.all([
      axios.get(`${BASE}/user-media/public/${item.tmdb_id}`, { headers: auth }),
      axios.get(`${BASE}/media/${item.tmdb_id}/friends-activity`, { headers: auth }),
    ]).then(([pubRes, friendRes]) => {
      setPublicReviews(pubRes.data.data || []);
      setFriendsActivity(friendRes.data.data);
      setPublicReviewsLoaded(true);
    }).catch(() => setPublicReviewsLoaded(true));
  }, [item.tmdb_id]);

  // 시청 이력 로드 — tmdb_id 미매칭(수동 입력) 작품도 대상
  useEffect(() => {
    const auth = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    axios.get(`${BASE}/user-media/${item.id}/history`, { headers: auth })
      .then(res => setRewatchHistory(res.data.data || []))
      .catch(() => {});
  }, [item.id]);

  // 수식어 목록 로드
  useEffect(() => {
    const auth = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    axios.get(`${BASE}/epithets`, { headers: auth })
      .then(res => setEpithets(res.data.data || []))
      .catch(() => {});
  }, []);

  // 다면 별점 축 목록 로드
  useEffect(() => {
    const auth = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    axios.get(`${BASE}/rating-axes`, { headers: auth })
      .then(res => setAxes(res.data.data || []))
      .catch(() => {});
  }, []);

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
    // 컨텍스트 필드도 함께 저장
    await onSave(item, rating, reviewText, isPublic, {
      watched_with: ctxWith || null,
      watched_at_place: ctxPlace || null,
      mood: ctxMood || null,
      // dateUnknown: watched_at 명시적 NULL, 아니면 입력된 날짜 전달
      clear_watched_at: dateUnknown || false,
      watched_at_custom: dateUnknown ? null : (watchedDate || null),
      life_period: lifePeriod || null,
    });
    setSaving(false);
    onClose();
  };

  const handleRewatch = async () => {
    setRewatchSaving(true);
    try {
      const auth = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      // 날짜 미기록이면 null, 아니면 입력된 날짜 ISO 문자열
      const watched_at = rewatchDateUnknown ? null : (rewatchDate ? new Date(rewatchDate).toISOString() : null);
      await axios.post(
        `${BASE}/user-media/${item.id}/rewatch`,
        { rating: rewatchRating, review_text: rewatchNote, watched_at },
        { headers: auth }
      );
      setRewatchFormOpen(false);
      setRewatchRating(0);
      setRewatchNote('');
      setRewatchDate(new Date().toISOString().slice(0, 10));
      setRewatchDateUnknown(false);
      // 이력 새로고침
      const histRes = await axios.get(
        `${BASE}/user-media/${item.id}/history`,
        { headers: auth }
      );
      setRewatchHistory(histRes.data.data || []);
    } catch { /* 에러 무시 */ }
    setRewatchSaving(false);
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

  const handleApplyPoster = async (url, title) => {
    await onUpdatePoster(item.id, url, title);
    setCurrentPosterUrl(url);
    if (title) setEditFields(prev => ({ ...prev, title }));
    setPosterPickerOpen(false);
  };

  /** 다면 별점 축 하나에 점수 부여/수정 — 이미 매긴 별을 다시 탭하면 0점(해제) */
  const rateAxis = async (axisId, currentRating, n) => {
    const auth = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    const next = currentRating === n ? 0 : n;
    try {
      if (next === 0) {
        await axios.delete(`${BASE}/user-media/${item.id}/axis-ratings/${axisId}`, { headers: auth });
        setAxes(prev => prev.map(ax => ax.id === axisId
          ? { ...ax, items: ax.items.filter(i => i.user_media_id !== item.id) }
          : ax));
      } else {
        const res = await axios.put(`${BASE}/user-media/${item.id}/axis-ratings/${axisId}`, { rating: next }, { headers: auth });
        setAxes(prev => prev.map(ax => {
          if (ax.id !== axisId) return ax;
          const exists = ax.items.some(i => i.user_media_id === item.id);
          return { ...ax, items: exists ? ax.items.map(i => i.user_media_id === item.id ? res.data.data : i) : [...ax.items, res.data.data] };
        }));
      }
    } catch { /* 네트워크 오류 시 조용히 무시 — 목록이 그대로면 사용자가 다시 탭 가능 */ }
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
                  loading="eager"
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
                      style={{ width: '100%', padding: '5px 8px', fontSize: key === 'title' ? 14 : 13, border: '1px solid #ddd', borderRadius: 6, marginBottom: 6, fontFamily: 'inherit', background: 'transparent', color: 'inherit' }}
                    />
                  ))}
                  <select
                    value={editFields.type}
                    onChange={e => setEditFields(f => ({ ...f, type: e.target.value }))}
                    style={{ width: '100%', padding: '5px 8px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, marginBottom: 6, fontFamily: 'inherit', background: 'transparent', color: 'inherit' }}
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
              {/* 기본 정보 / 보러가기 탭 */}
              <div className="mtab-nav">
                <button
                  className={`mtab-btn${activeTab === 'info' ? ' active' : ''}`}
                  onClick={() => setActiveTab('info')}
                >기본 정보</button>
                <button
                  className={`mtab-btn${activeTab === 'ott' ? ' active' : ''}`}
                  onClick={() => setActiveTab('ott')}
                >보러가기</button>
              </div>
              <TmdbInfoPanel detail={tmdbDetail} tab={activeTab} />

              {/* 친구 활동 (팔로잉 중 이 작품을 본 사람) */}
              {friendsActivity && friendsActivity.count > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                  <span style={{ fontWeight: 600 }}>친구 {friendsActivity.count}명</span>이 봤어요
                  {friendsActivity.avg_rating && ` · 평균 ★${friendsActivity.avg_rating}`}
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    {friendsActivity.friends.slice(0, 5).map((f, i) => (
                      <span key={i} className="chip-neutral" style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10 }}>
                        {f.username || f.name} {f.rating > 0 ? '★'.repeat(f.rating) : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mbody">
            {hasReview && (
              <div className="prev-review">
                <div className="prev-stars">{'★'.repeat(item.rating || 0)}{'☆'.repeat(5 - (item.rating || 0))}</div>
                {item.review_text || '(메모 없음)'}
                {/* watched_at 있으면 날짜 표시, 없고 life_period 있으면 시기 텍스트 표시 */}
                {item.watched_at
                  ? <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>
                      {new Date(item.watched_at).toLocaleDateString('ko-KR')}
                      {item.life_period && <span style={{ marginLeft: 6, color: '#bbb' }}>· {item.life_period}</span>}
                    </div>
                  : item.life_period
                    ? <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>{item.life_period}</div>
                    : item.review_date
                      ? <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>{item.review_date}</div>
                      : null
                }
              </div>
            )}

            <label>별점</label>
            <StarRating value={rating} onChange={setRating} />

            {/* 다면 별점 (Phase 13.3) — 내 별점과 별개로 여러 기준으로 평가 */}
            <div style={{ marginTop: 10, marginBottom: 14 }}>
              {axes
                .filter(ax => ax.items.some(i => i.user_media_id === item.id))
                .map(ax => {
                  const ir = ax.items.find(i => i.user_media_id === item.id);
                  return (
                    <div key={ax.id} className="axis-row">
                      <span className="axis-row-label">{ax.emoji} {ax.label}</span>
                      <StarRating value={ir.rating} onChange={n => rateAxis(ax.id, ir.rating, n)} />
                    </div>
                  );
                })}
              <button className="epithet-add-btn" onClick={() => setAxisPickerOpen(true)}>
                + 다른 기준 별점
              </button>
            </div>

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

            {/* 시청 컨텍스트 (Phase 5.6) */}
            <div style={{ marginTop: 12 }}>
              <button
                style={{ fontSize: 12, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', minHeight: 44, display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={() => setContextOpen(v => !v)}
              >
                {contextOpen ? '▾' : '▸'} 시청 컨텍스트 {(ctxWith || ctxPlace || ctxMood) ? '✓' : '(선택)'}
              </button>
              {contextOpen && (
                <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,.03)', borderRadius: 8, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>누구와 봤어요?</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {['혼자', '가족', '친구', '연인'].map(v => (
                        <button
                          key={v}
                          onClick={() => setCtxWith(ctxWith === v ? '' : v)}
                          style={{ padding: '3px 10px', borderRadius: 12, border: `1px solid ${ctxWith === v ? '#1a1a1a' : '#ddd'}`, background: ctxWith === v ? '#1a1a1a' : 'transparent', color: ctxWith === v ? '#fff' : 'inherit', fontSize: 12, cursor: 'pointer' }}
                        >{v}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>어디서 봤어요?</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {['집', '극장', '이동 중', '기타'].map(v => (
                        <button
                          key={v}
                          onClick={() => setCtxPlace(ctxPlace === v ? '' : v)}
                          style={{ padding: '3px 10px', borderRadius: 12, border: `1px solid ${ctxPlace === v ? '#1a1a1a' : '#ddd'}`, background: ctxPlace === v ? '#1a1a1a' : 'transparent', color: ctxPlace === v ? '#fff' : 'inherit', fontSize: 12, cursor: 'pointer' }}
                        >{v}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>어떤 기분이었어요?</div>
                    <input
                      style={{ width: '100%', padding: '5px 8px', fontSize: 12, border: '1px solid #ddd', borderRadius: 6, background: 'transparent', color: 'inherit' }}
                      value={ctxMood}
                      onChange={e => setCtxMood(e.target.value)}
                      placeholder="감상 당시 무드를 자유롭게..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 수식어 (Phase 13.1) — 별점과 별개로 "어떻게 좋았나" */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>수식어</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {epithets
                  .filter(ep => ep.items.some(i => i.user_media_id === item.id))
                  .map(ep => (
                    <span key={ep.id} className="epithet-chip">
                      {ep.emoji && <span>{ep.emoji}</span>}{ep.label}
                    </span>
                  ))}
                <button className="epithet-add-btn" onClick={() => setEpithetPickerOpen(true)}>
                  + 수식어
                </button>
              </div>
            </div>

            {/* 시청 날짜 + 기억이 안 나요 (통합 섹션) */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>시청 날짜</div>

              {!dateUnknown ? (
                /* 날짜 입력 모드 */
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="date"
                    value={watchedDate}
                    onChange={e => setWatchedDate(e.target.value)}
                    style={{ flex: 1, padding: '5px 8px', minHeight: 44, fontSize: 13, border: '1px solid #ddd',
                      borderRadius: 6, fontFamily: 'inherit', background: 'transparent', color: 'inherit', boxSizing: 'border-box' }}
                  />
                  <button
                    className="mghost-btn"
                    onClick={() => setWatchedDate(new Date().toISOString().slice(0, 10))}
                    style={{ fontSize: 12, padding: '5px 10px', background: 'none', border: '1px solid #ddd',
                      borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >오늘</button>
                  <button
                    onClick={() => { setDateUnknown(true); setWatchedDate(''); }}
                    style={{ fontSize: 12, padding: '5px 10px', minHeight: 44, background: 'none', border: '1px solid #ddd',
                      borderRadius: 6, cursor: 'pointer', color: '#999', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}
                  >기억이 안 나요</button>
                </div>
              ) : (
                /* 기억이 안 나요 모드 — 자유 텍스트 입력 */
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#999', flex: 1 }}>날짜 미기록</span>
                    <button
                      className="mghost-btn"
                      onClick={() => setDateUnknown(false)}
                      style={{ fontSize: 12, padding: '4px 10px', background: 'none', border: '1px solid #ddd',
                        borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >날짜 입력하기</button>
                  </div>
                  <input
                    value={lifePeriod}
                    onChange={e => setLifePeriod(e.target.value)}
                    placeholder="정확한 날짜가 기억나지 않는다면 자유롭게 남겨보세요 (예: 고등학생 때, 군대에서, 2010년쯤)"
                    style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #ddd',
                      borderRadius: 6, background: 'transparent', color: 'inherit',
                      fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>
              )}
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

            {/* 재시청 이력 (Phase 5.4) */}
            {rewatchHistory.length > 1 && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f0f0ee' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>🔁 시청 이력</div>
                {rewatchHistory.map((h) => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                    <span style={{ color: '#888', minWidth: 20 }}>{h.rewatch_count}회</span>
                    {h.rating > 0 && <span style={{ color: '#f0a500' }}>{'★'.repeat(h.rating)}</span>}
                    <span style={{ color: '#aaa', fontSize: 11 }}>
                      {h.watched_at ? new Date(h.watched_at).toLocaleDateString('ko-KR') : '날짜 미기록'}
                    </span>
                    {h.review_text && <span style={{ color: '#666', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.review_text}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* 다시 봤어요 버튼 */}
            <div style={{ marginTop: 12 }}>
              {!rewatchFormOpen ? (
                <button
                  className="btn"
                  style={{ fontSize: 12 }}
                  onClick={() => setRewatchFormOpen(true)}
                >🔁 다시 봤어요</button>
              ) : (
                <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,.03)', borderRadius: 8, border: '1px solid #e8e8e8' }}>
                  {/* 별점 */}
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>별점</div>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setRewatchRating(r => r === n ? 0 : n)}
                        style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: n <= rewatchRating ? '#f0a500' : '#ccc', padding: 0 }}>★</button>
                    ))}
                  </div>

                  {/* 시청 날짜 */}
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>시청 날짜</div>
                  {!rewatchDateUnknown ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <input
                        type="date"
                        value={rewatchDate}
                        onChange={e => setRewatchDate(e.target.value)}
                        style={{ fontSize: 12, padding: '4px 8px', minHeight: 44, border: '1px solid #ddd', borderRadius: 6,
                          background: 'transparent', color: 'inherit', flex: 1, boxSizing: 'border-box' }}
                      />
                      <button
                        className="mghost-btn"
                        onClick={() => setRewatchDate(new Date().toISOString().slice(0, 10))}
                        style={{ fontSize: 11, padding: '4px 8px', background: 'none', border: '1px solid #ddd',
                          borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >오늘</button>
                      <button
                        onClick={() => setRewatchDateUnknown(true)}
                        style={{ fontSize: 11, padding: '4px 8px', minHeight: 44, background: 'none', border: '1px solid #ddd',
                          borderRadius: 6, cursor: 'pointer', color: '#999', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}
                      >기억 안 나요</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: '#999', flex: 1 }}>날짜 미기록</span>
                      <button
                        className="mghost-btn"
                        onClick={() => setRewatchDateUnknown(false)}
                        style={{ fontSize: 11, padding: '4px 8px', background: 'none', border: '1px solid #ddd',
                          borderRadius: 6, cursor: 'pointer' }}
                      >날짜 입력</button>
                    </div>
                  )}

                  {/* 메모 */}
                  <textarea
                    style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6, resize: 'none', height: 56, fontFamily: 'inherit', background: 'transparent', color: 'inherit' }}
                    value={rewatchNote}
                    onChange={e => setRewatchNote(e.target.value)}
                    placeholder="재시청 감상 메모 (선택)"
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button className="btn" style={{ fontSize: 12 }} onClick={() => { setRewatchFormOpen(false); setRewatchDateUnknown(false); }}>취소</button>
                    <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={handleRewatch} disabled={rewatchSaving}>
                      {rewatchSaving ? '저장 중...' : '재시청 기록 저장'}
                    </button>
                  </div>
                </div>
              )}
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

      {/* 수식어 피커 */}
      {epithetPickerOpen && (
        <EpithetPicker
          mediaId={item.id}
          epithets={epithets}
          onClose={() => setEpithetPickerOpen(false)}
          onChange={setEpithets}
        />
      )}

      {/* 다면 별점 피커 */}
      {axisPickerOpen && (
        <AxisRatingPicker
          mediaId={item.id}
          axes={axes}
          onClose={() => setAxisPickerOpen(false)}
          onChange={setAxes}
          onRate={rateAxis}
        />
      )}
    </>
  );
}
