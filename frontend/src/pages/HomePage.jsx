/**
 * @file HomePage.jsx
 * 메인 미디어 다이어리 페이지 - 탭/그리드/모달/리뷰 기능 통합
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import {
  fetchUserMedia,
  bulkSaveMedia,
  saveMediaItem,
  updateMediaItem,
  deleteMediaItem,
} from '../api/userMedia';
import { DEFAULT_MOVIE, DEFAULT_ANIME, DEFAULT_DRAMA } from '../data/defaultMedia';

// ─── 상수 ───────────────────────────────────────────────────────────────────
const TMDB_KEY = '96e3477ef8bb1c718fea3be0b7f5f0a2';
const IMG_BASE = 'https://image.tmdb.org/t/p/w300';
const IMG_ORIG = 'https://image.tmdb.org/t/p/original';

const AWARDS = {
  '기생충_2019': '아카데미 작품상·감독상·각본상·국제영화상',
  '오펜하이머_2023': '아카데미 작품상·감독상·남우주연상',
  '에브리씽 에브리웨어 올 앳 원스_2022': '아카데미 작품상·감독상·여우주연상',
  '글래디에이터_2000': '아카데미 작품상·남우주연상',
  '반지의 제왕: 왕의 귀환_2003': '아카데미 11개 부문 석권',
  '추락의 해부_2023': '칸 황금종려상',
  '헤어질 결심_2022': '칸 감독상',
  '라라랜드_2016': '아카데미 감독상·여우주연상',
  '위플래쉬_2014': '아카데미 편집·음향·조연남우상',
  '쇼생크 탈출_1994': '아카데미 7개 부문 후보',
  '이미테이션게임_2014': '아카데미 각색상',
  '1917_2019': '아카데미 촬영·시각효과·음향편집상',
  '서부전선이상없다_2022': '아카데미 국제영화상',
  '허트로커_2008': '아카데미 작품상·감독상',
  '레버넌트_2015': '아카데미 남우주연상·감독상',
  '더 퍼스트 슬램덩크_2022': '일본 아카데미 우수 애니메이션상',
  '센과 치히로의 행방불명_2001': '아카데미 장편애니메이션상·베를린 황금곰상',
  '기예르모 델토로의 피노키오_2022': '아카데미 장편애니메이션상',
  '폭삭 속았수다_2025': '베를린 국제영화제 황금곰상',
};

// ─── TMDB 유틸 ──────────────────────────────────────────────────────────────

/** TMDB에서 세부정보(런타임, OTT, 장르 등) 조회 */
async function fetchTmdbDetail(tmdbId, type) {
  try {
    const [detailRes, providerRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=ko-KR`),
      fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/watch/providers?api_key=${TMDB_KEY}`),
    ]);
    if (!detailRes.ok) return null;
    const d = await detailRes.json();
    const pd = providerRes.ok ? await providerRes.json() : {};
    const kr = pd.results?.KR || {};
    const runtime =
      type === 'movie'
        ? d.runtime ? `${Math.floor(d.runtime / 60)}h ${d.runtime % 60}m` : null
        : d.episode_run_time?.[0] ? `회당 ${d.episode_run_time[0]}m` : null;
    return {
      tmdbTitle: d.title || d.name || null,
      runtime,
      overview: d.overview || null,
      score: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
      genres: (d.genres || []).map(g => g.name).slice(0, 3),
      providers: {
        flatrate: (kr.flatrate || []).map(p => ({ name: p.provider_name, logo: p.logo_path })),
        rent: (kr.rent || []).map(p => ({ name: p.provider_name, logo: p.logo_path })),
        buy: (kr.buy || []).map(p => ({ name: p.provider_name, logo: p.logo_path })),
        link: kr.link || null,
      },
    };
  } catch {
    return null;
  }
}

/** TMDB 제목 검색 → poster path + id + type 반환 */
async function searchTmdbPoster(title, year, preferType) {
  const types = preferType === 'tv' ? ['tv', 'movie'] : ['movie', 'tv'];
  for (const type of types) {
    try {
      const [r1, r2] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&language=ko-KR`).then(r => r.json()),
        fetch(`https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&language=en-US`).then(r => r.json()),
      ]);
      const results = [...(r1.results || []), ...(r2.results || [])];
      const match =
        results.find(x => {
          const y = parseInt((x.release_date || x.first_air_date || '').slice(0, 4));
          return Math.abs(y - year) <= 1 && x.poster_path;
        }) || results.find(x => x.poster_path);
      if (match) {
        return {
          posterPath: match.poster_path,
          posterUrl: IMG_BASE + match.poster_path,
          tmdbId: match.id,
          tmdbType: match.title ? 'movie' : 'tv',
          tmdbTitle: match.title || match.name || '',
        };
      }
    } catch { /* 다음 타입으로 */ }
  }
  return null;
}

// ─── OTT 정보 컴포넌트 ────────────────────────────────────────────────────

function TmdbInfoPanel({ detail }) {
  if (!detail) return null;
  const p = detail.providers || {};
  const hasProviders = p.flatrate?.length || p.rent?.length || p.buy?.length;

  const ProviderRow = ({ list, label }) =>
    list.length === 0 ? null : (
      <div style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: '#aaa', fontWeight: 500, marginRight: 6 }}>{label}</span>
        {list.map(pr => (
          <img
            key={pr.name}
            src={IMG_ORIG + pr.logo}
            alt={pr.name}
            title={pr.name}
            style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', marginRight: 4, verticalAlign: 'middle' }}
            onError={e => e.target.remove()}
          />
        ))}
      </div>
    );

  return (
    <>
      {(detail.runtime || detail.score || detail.genres?.length > 0) && (
        <div className="tmdb-info">
          {detail.runtime && <span className="tmdb-badge">⏱ {detail.runtime}</span>}
          {detail.score && <span className="tmdb-score">★ {detail.score}</span>}
          {(detail.genres || []).map(g => <span key={g} className="tmdb-badge">{g}</span>)}
        </div>
      )}
      {hasProviders ? (
        <div className="ott-box">
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            📺 한국에서 보기
            {p.link && (
              <a href={p.link} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, fontWeight: 400, color: '#888', textDecoration: 'none' }}>
                TMDB에서 보기 ↗
              </a>
            )}
          </div>
          <ProviderRow list={p.flatrate || []} label="구독" />
          <ProviderRow list={p.rent || []} label="대여" />
          <ProviderRow list={p.buy || []} label="구매" />
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#bbb', marginBottom: 8 }}>🚫 한국 OTT 정보 없음</div>
      )}
      {detail.overview && (
        <div className="tmdb-overview">{detail.overview}</div>
      )}
    </>
  );
}

// ─── 별점 컴포넌트 ──────────────────────────────────────────────────────────

function StarRating({ value, onChange, readonly }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="stars-row">
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          className={`star ${n <= (hovered || value) ? 'on' : ''}`}
          onClick={() => !readonly && onChange(n)}
          onMouseEnter={() => !readonly && setHovered(n)}
          onMouseLeave={() => !readonly && setHovered(0)}
          style={{ cursor: readonly ? 'default' : 'pointer' }}
        >★</span>
      ))}
    </div>
  );
}

// ─── 상세 모달 ──────────────────────────────────────────────────────────────

function DetailModal({ item, posterUrl, tmdbUrlCache, tmdbIdCache, tmdbDetailCache, onClose, onSave, onDeleteReview, onDeleteItem, onEditItem, onOpenPicker }) {
  const [rating, setRating] = useState(item.rating || 0);
  const [reviewText, setReviewText] = useState(item.review_text || '');
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState({ title: item.title, year: item.year, director: item.director, cast_info: item.cast_info });
  const [tmdbDetail, setTmdbDetail] = useState(null);
  const [tmdbUrl, setTmdbUrl] = useState(null);
  const [saving, setSaving] = useState(false);

  const cacheKey = `${item.title}_${item.year}`;

  useEffect(() => {
    // TMDB URL 설정
    setTmdbUrl(tmdbUrlCache.current[cacheKey] || null);

    // TMDB 세부정보 로드
    const loadDetail = async () => {
      if (tmdbDetailCache.current[cacheKey]) {
        setTmdbDetail(tmdbDetailCache.current[cacheKey]);
        return;
      }
      let idInfo = tmdbIdCache.current[cacheKey];
      if (!idInfo && item.tmdb_id) {
        const type = ['drama'].includes(item.type) ? 'tv' : 'movie';
        idInfo = { id: item.tmdb_id, type };
        tmdbIdCache.current[cacheKey] = idInfo;
      }
      if (!idInfo) {
        // poster 검색으로 ID 확보
        const res = await searchTmdbPoster(item.title, item.year, item.type === 'drama' ? 'tv' : 'movie');
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
    await onSave(item, rating, reviewText);
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

  return (
    <div className="backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="mhead">
          <div className="mposter">
            <span style={{ fontSize: 30, opacity: .3, zIndex: 0, position: 'relative' }}>🎬</span>
            {posterUrl && (
              <img src={posterUrl} alt={item.title}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 }}
                onError={e => { e.target.style.display = 'none'; }} />
            )}
          </div>
          <div className="minfo">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div className="mtitle" style={{ flex: 1 }}>
                {tmdbUrl ? (
                  <a href={tmdbUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1.5px solid rgba(128,128,128,.4)', paddingBottom: 1 }}>
                    {item.title} <span style={{ fontSize: 13, opacity: .5 }}>↗</span>
                  </a>
                ) : item.title}
              </div>
              <button
                className="btn"
                onClick={() => {
                  if (!editMode) {
                    setEditFields({ title: item.title, year: item.year, director: item.director || '', cast_info: item.cast_info || '' });
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
        </div>
      </div>
    </div>
  );
}

// ─── 포스터 피커 모달 ────────────────────────────────────────────────────────

function PosterPickerModal({ item, onClose, onApply }) {
  const [query, setQuery] = useState(item.title);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [searching, setSearching] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => { handleSearch(); }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=ko-KR`).then(r => r.json()),
        fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=ko-KR`).then(r => r.json()),
      ]);
      const all = [...(r1.results || []), ...(r2.results || [])].filter(r => r.poster_path);
      setResults(all.slice(0, 16));
    } catch { setResults([]); }
    setSearching(false);
  };

  const handleApply = async () => {
    if (!selected) return;
    setApplying(true);
    const posterUrl = IMG_BASE + selected.path;
    const tmdbType = selected.tmdbType;
    const slug = selected.tmdbTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const tmdbUrl = `https://www.themoviedb.org/${tmdbType}/${selected.tmdbId}${slug ? '-' + slug : ''}`;
    await onApply(item, posterUrl, tmdbUrl, selected.tmdbId, tmdbType);
    setApplying(false);
    onClose();
  };

  return (
    <div className="backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="picker-modal">
        <h2>포스터 변경 — {item.title}</h2>
        <div className="picker-search-row">
          <input
            className="add-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="다른 제목으로 검색..."
          />
          <button className="btn btn-primary" onClick={handleSearch}>검색</button>
        </div>
        <div className="picker-grid">
          {searching && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: 13 }}>검색 중...</div>}
          {!searching && results.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: 13 }}>결과 없음</div>}
          {results.map(r => {
            const title = r.title || r.name || '';
            const tmdbType = r.title ? 'movie' : 'tv';
            const isSelected = selected?.path === r.poster_path;
            return (
              <div
                key={r.id}
                className={`picker-item ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelected({ path: r.poster_path, tmdbId: r.id, tmdbType, tmdbTitle: title })}
                title={`${title} (${(r.release_date || r.first_air_date || '').slice(0, 4)})`}
              >
                🎬
                <img src={IMG_BASE + r.poster_path} alt={title} onError={e => e.target.remove()} />
              </div>
            );
          })}
        </div>
        <div className="picker-actions">
          <button className="btn" onClick={onClose}>취소</button>
          <button className="btn btn-primary" onClick={handleApply} disabled={!selected || applying}>
            {applying ? '저장 중...' : '적용'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 추가 모달 ──────────────────────────────────────────────────────────────

function AddModal({ onClose, onAdd, existingItems, currentTab }) {
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

  const existingTmdbIds = useMemo(() => new Set(existingItems.map(i => i.tmdb_id).filter(Boolean)), [existingItems]);

  const searchSingle = async () => {
    if (!singleQ.trim()) return;
    setSingleSearching(true);
    const type = addType === 'movie' ? 'movie' : 'tv';
    try {
      const r = await fetch(`https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_KEY}&query=${encodeURIComponent(singleQ)}&language=ko-KR`).then(r => r.json());
      setSingleResults(r.results?.slice(0, 8) || []);
    } catch { setSingleResults([]); }
    setSingleSearching(false);
  };

  const handleAddSingle = async (r) => {
    const tmdbType = r.title ? 'movie' : 'tv';
    const title = r.title || r.name || '';
    const year = parseInt((r.release_date || r.first_air_date || '').slice(0, 4)) || 0;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const tmdbUrl = `https://www.themoviedb.org/${tmdbType}/${r.id}${slug ? '-' + slug : ''}`;
    const type = addType === 'movie' ? 'movie' : (currentTab === 'drama' ? 'drama' : 'anime');
    const item = {
      type,
      title,
      year,
      director: '',
      cast_info: '',
      poster_url: r.poster_path ? IMG_BASE + r.poster_path : '',
      tmdb_id: r.id,
    };
    const saved = await onAdd(item);
    if (saved) setAddedIds(s => new Set([...s, r.id]));
  };

  const searchBulk = async () => {
    const raw = bulkInput.trim();
    if (!raw) return;
    const titles = raw.split(/[\n,]+/).map(t => t.trim()).filter(Boolean);
    setBulkSearching(true);
    setBulkItems([]);
    const items = [];
    for (let i = 0; i < titles.length; i++) {
      const title = titles[i];
      setBulkProgress(`${i + 1} / ${titles.length} 검색 중... "${title}"`);
      let result = null;
      try {
        const [r1, r2] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&language=ko-KR`).then(r => r.json()),
          fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}&language=ko-KR`).then(r => r.json()),
        ]);
        const results = [...(r1.results || []), ...(r2.results || [])];
        const match = results.find(x => x.poster_path) || results[0];
        if (match) {
          const tmdbType = match.title ? 'movie' : 'tv';
          const tmdbTitle = match.title || match.name || '';
          const year = parseInt((match.release_date || match.first_air_date || '').slice(0, 4)) || 0;
          const alreadyIn = existingItems.some(i => i.title === tmdbTitle && i.year === year);
          result = {
            tmdb_id: match.id,
            title: tmdbTitle,
            year,
            poster: match.poster_path ? IMG_BASE + match.poster_path : '',
            type: tmdbType === 'movie' ? 'movie' : (currentTab === 'drama' ? 'drama' : 'anime'),
            tmdbType,
            alreadyIn,
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
    const toAdd = bulkItems.filter(i => i.selected && i.result);
    for (const item of toAdd) {
      const r = item.result;
      await onAdd({
        type: r.type,
        title: r.title,
        year: r.year,
        director: '',
        cast_info: '',
        poster_url: r.poster || '',
        tmdb_id: r.tmdb_id,
      });
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
                onKeyDown={e => e.key === 'Enter' && searchSingle()}
                placeholder="제목으로 검색..."
              />
              <button className="btn btn-primary" onClick={searchSingle}>검색</button>
            </div>
            <div className="result-list">
              {singleSearching && <div className="searching">검색 중...</div>}
              {!singleSearching && singleResults.length === 0 && singleQ && <div className="searching">결과 없음</div>}
              {singleResults.map(r => {
                const title = r.title || r.name || '';
                const year = (r.release_date || r.first_air_date || '').slice(0, 4);
                const added = existingTmdbIds.has(r.id) || addedIds.has(r.id);
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

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────

/**
 * 홈 페이지 컴포넌트
 * 로그인한 사용자의 미디어 다이어리 메인 화면
 */
function HomePage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seedingMsg, setSeedingMsg] = useState('');
  const [tab, setTab] = useState('movie');
  const [searchQ, setSearchQ] = useState('');
  const [sortBy, setSortBy] = useState('year');
  const [detailItem, setDetailItem] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [pickerItem, setPickerItem] = useState(null);
  const [posters, setPosters] = useState({});

  // 세션 캐시 (TMDB URL/ID/Detail)
  const tmdbUrlCache = useRef({});
  const tmdbIdCache = useRef({});
  const tmdbDetailCache = useRef({});

  // localStorage 포스터 캐시
  const posterCache = useRef((() => {
    try { return JSON.parse(localStorage.getItem('mdb_poster_url') || '{}'); } catch { return {}; }
  })());

  const savePosterCache = useCallback(() => {
    try { localStorage.setItem('mdb_poster_url', JSON.stringify(posterCache.current)); } catch { }
  }, []);

  // 포스터 URL 결정 (DB > 로컬캐시 > 빈값)
  const getPosterUrl = useCallback((item) => {
    if (item.poster_url) return item.poster_url;
    const key = `${item.title}_${item.year}`;
    return posterCache.current[key] || posters[key] || '';
  }, [posters]);

  // 데이터 로드 및 첫 방문 시 씨드
  useEffect(() => {
    const doLoad = async () => {
      setLoading(true);
      const seedKey = `media_diary_seeded_${user?.id}`;
      try {
        let data = await fetchUserMedia();
        if (!localStorage.getItem(seedKey)) {
          setSeedingMsg('처음 방문이시네요! 기본 작품 목록을 불러오는 중...');
          const allDefaults = [
            ...DEFAULT_MOVIE.map(m => ({ ...m, type: 'movie' })),
            ...DEFAULT_ANIME.map(m => ({ ...m, type: 'anime' })),
            ...DEFAULT_DRAMA.map(m => ({ ...m, type: 'drama' })),
          ];
          await bulkSaveMedia(allDefaults);
          localStorage.setItem(seedKey, '1');
          data = await fetchUserMedia();
          setSeedingMsg('');
        }
        setItems(data);
      } catch (err) {
        console.error('데이터 로드 실패:', err);
      }
      setLoading(false);
    };
    doLoad();
  }, [user?.id]);

  // 포스터 백그라운드 프리페치
  useEffect(() => {
    if (!items.length) return;
    const missing = items.filter(i => {
      if (i.poster_url) return false;
      const key = `${i.title}_${i.year}`;
      return !posterCache.current[key];
    });
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      for (const item of missing) {
        if (cancelled) break;
        const key = `${item.title}_${item.year}`;
        if (posterCache.current[key]) continue;
        const res = await searchTmdbPoster(item.title, item.year, item.type === 'drama' ? 'tv' : 'movie');
        if (res?.posterUrl && !cancelled) {
          posterCache.current[key] = res.posterUrl;
          if (res.tmdbId && !tmdbIdCache.current[key]) {
            tmdbIdCache.current[key] = { id: res.tmdbId, type: res.tmdbType };
          }
          setPosters(p => ({ ...p, [key]: res.posterUrl }));
        }
        await new Promise(r => setTimeout(r, 80));
      }
      savePosterCache();
    })();
    return () => { cancelled = true; };
  }, [items]);

  // 로그아웃 핸들러
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // 현재 탭 항목 필터/정렬
  const displayItems = useMemo(() => {
    let result = items.filter(i => i.type === tab);
    if (searchQ) {
      const q = searchQ.toLowerCase();
      result = result.filter(i => i.title.toLowerCase().includes(q) || String(i.year).includes(q));
    }
    if (sortBy === 'year') result = [...result].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title, 'ko'));
    else if (sortBy === 'title') result = [...result].sort((a, b) => a.title.localeCompare(b.title, 'ko'));
    else if (sortBy === 'rated') result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sortBy === 'reviewed') result = result.filter(i => i.rating > 0 || i.review_text);
    return result;
  }, [items, tab, searchQ, sortBy]);

  // 통계
  const stats = useMemo(() => {
    const tabItems = items.filter(i => i.type === tab);
    const ratings = tabItems.filter(i => i.rating > 0).map(i => i.rating);
    const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '-';
    return {
      total: tabItems.length,
      reviewed: tabItems.filter(i => i.rating > 0 || i.review_text).length,
      avg,
    };
  }, [items, tab]);

  // 리뷰 저장
  const handleSave = async (item, rating, reviewText) => {
    const date = rating > 0 || reviewText ? new Date().toLocaleDateString('ko-KR') : '';
    const updated = await updateMediaItem(item.id, {
      title: item.title, year: item.year, director: item.director,
      cast_info: item.cast_info, poster_url: item.poster_url,
      rating, review_text: reviewText, review_date: date,
    });
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
  };

  // 감상 삭제
  const handleDeleteReview = async (item) => {
    const updated = await updateMediaItem(item.id, {
      title: item.title, year: item.year, director: item.director,
      cast_info: item.cast_info, poster_url: item.poster_url,
      rating: 0, review_text: '', review_date: '',
    });
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
  };

  // 항목 삭제
  const handleDeleteItem = async (id) => {
    await deleteMediaItem(id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  // 항목 정보 편집
  const handleEditItem = async (item, fields) => {
    const updated = await updateMediaItem(item.id, {
      title: fields.title,
      year: parseInt(fields.year) || item.year,
      director: fields.director,
      cast_info: fields.cast_info,
      poster_url: item.poster_url,
      rating: item.rating,
      review_text: item.review_text,
      review_date: item.review_date,
    });
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    // 모달 item도 최신 상태 반영
    setDetailItem(updated);
  };

  // 포스터 변경
  const handleApplyPoster = async (item, posterUrl, tmdbUrl, tmdbId, tmdbType) => {
    const key = `${item.title}_${item.year}`;
    tmdbUrlCache.current[key] = tmdbUrl;
    tmdbIdCache.current[key] = { id: tmdbId, type: tmdbType };
    const updated = await updateMediaItem(item.id, {
      title: item.title, year: item.year, director: item.director,
      cast_info: item.cast_info, poster_url: posterUrl,
      rating: item.rating, review_text: item.review_text, review_date: item.review_date,
    });
    posterCache.current[key] = posterUrl;
    savePosterCache();
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
  };

  // 항목 추가
  const handleAdd = async (itemData) => {
    const already = items.some(i => i.title === itemData.title && i.year === itemData.year);
    if (already) { alert('이미 목록에 있어요!'); return null; }
    const saved = await saveMediaItem(itemData);
    if (saved) {
      setItems(prev => [...prev, saved]);
      setTab(itemData.type);
    }
    return saved;
  };

  const tabLabels = { movie: '영화', anime: '애니메이션', drama: '드라마' };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 12, color: '#888' }}>
        <div style={{ fontSize: 32 }}>📽️</div>
        <div style={{ fontSize: 15 }}>{seedingMsg || '불러오는 중...'}</div>
      </div>
    );
  }

  return (
    <div className="mdb-container">
      {/* 헤더 */}
      <div className="mdb-header">
        <h1 className="mdb-title">내 미디어 일기</h1>
        <div className="mdb-controls">
          <input
            className="search-input"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="제목 검색..."
          />
          <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="year">연도순</option>
            <option value="title">제목순</option>
            <option value="rated">별점 높은순</option>
            <option value="reviewed">감상 있는 것</option>
          </select>
          <button className="btn btn-primary" onClick={() => setAddModalOpen(true)}>+ 추가</button>
          <div className="mdb-user">
            <span>안녕하세요 <strong>{user?.name}</strong>님</span>
            <button className="btn" onClick={handleLogout}>로그아웃</button>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="tab-bar">
        {Object.entries(tabLabels).map(([key, label]) => (
          <button
            key={key}
            className={`tab ${tab === key ? 'active' : ''}`}
            onClick={() => { setTab(key); setSearchQ(''); }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 통계 */}
      <div className="stats-bar">
        <span className="stat">전체 <strong>{stats.total}</strong>편</span>
        <span className="stat">감상 기록 <strong>{stats.reviewed}</strong>편</span>
        <span className="stat">평균 별점 <strong>{stats.avg}</strong></span>
      </div>

      {/* 그리드 */}
      {displayItems.length === 0 ? (
        <div className="empty">검색 결과가 없습니다</div>
      ) : (
        <div className="grid">
          {displayItems.map(item => {
            const posterUrl = getPosterUrl(item);
            const hasReview = item.rating > 0 || item.review_text;
            return (
              <div key={item.id} className="card" onClick={() => setDetailItem(item)}>
                <div className="poster">
                  {posterUrl && (
                    <img
                      src={posterUrl}
                      alt={item.title}
                      loading="lazy"
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <span className="poster-ph">🎬</span>
                  {hasReview && <div className="badge-dot" />}
                  <button
                    className="poster-btn"
                    onClick={e => { e.stopPropagation(); setPickerItem(item); }}
                  >
                    🖼 포스터 변경
                  </button>
                </div>
                <div className="card-body">
                  <div className="card-title">{item.title}</div>
                  <div className="card-sub">{item.year}{item.director ? ' · ' + item.director : ''}</div>
                  {item.rating > 0 && (
                    <div className="card-stars">{'★'.repeat(item.rating)}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 상세 모달 */}
      {detailItem && (
        <DetailModal
          key={detailItem.id}
          item={detailItem}
          posterUrl={getPosterUrl(detailItem)}
          tmdbUrlCache={tmdbUrlCache}
          tmdbIdCache={tmdbIdCache}
          tmdbDetailCache={tmdbDetailCache}
          onClose={() => setDetailItem(null)}
          onSave={handleSave}
          onDeleteReview={handleDeleteReview}
          onDeleteItem={handleDeleteItem}
          onEditItem={handleEditItem}
          onOpenPicker={setPickerItem}
        />
      )}

      {/* 포스터 피커 */}
      {pickerItem && (
        <PosterPickerModal
          item={pickerItem}
          onClose={() => setPickerItem(null)}
          onApply={handleApplyPoster}
        />
      )}

      {/* 추가 모달 */}
      {addModalOpen && (
        <AddModal
          onClose={() => setAddModalOpen(false)}
          onAdd={handleAdd}
          existingItems={items}
          currentTab={tab}
        />
      )}
    </div>
  );
}

export default HomePage;
