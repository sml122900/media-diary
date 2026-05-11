/**
 * @file HomePage.jsx
 * 메인 미디어 다이어리 페이지 (리팩토링 버전)
 * 탭/그리드/필터/홈위젯/모달 통합 — 상세 로직은 hooks/components로 분리
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import MediaCard from '../components/MediaCard';
import DetailModal from '../components/DetailModal';
import AddModal from '../components/AddModal';
import CsvImportModal from '../components/CsvImportModal';
import DailyRecommendations from '../components/DailyRecommendations';
import AiSearchModal from '../components/AiSearchModal';
import { useMediaList } from '../hooks/useMediaList';
import { usePosterCache } from '../hooks/usePosterCache';
import { useTheme } from '../hooks/useTheme';

export default function HomePage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  // 미디어 데이터 + CRUD 훅
  const {
    items, loading, seedingMsg,
    handleSave, handleDeleteReview, handleDeleteItem,
    handleEditItem, handleAdd, handleUpdatePoster, reloadItems,
  } = useMediaList(user);

  // 포스터 캐시 훅
  const { getPosterUrl, updateCacheKey } = usePosterCache(items);

  // TMDB 세션 캐시 (페이지 새로고침 전까지 유지)
  const tmdbUrlCache = useRef({});
  const tmdbIdCache = useRef({});
  const tmdbDetailCache = useRef({});

  // ── UI 상태 ────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState('movie');
  const [searchQ, setSearchQ] = useState('');
  const [sortBy, setSortBy] = useState('year');
  const [detailItem, setDetailItem] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [aiSearchOpen, setAiSearchOpen] = useState(false);

  // ── 필터 상태 ──────────────────────────────────────────────────────────────
  const [filterOpen, setFilterOpen] = useState(false);
  const [directorFilter, setDirectorFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState(0);
  const [yearMin, setYearMin] = useState(1900);
  const [yearMax, setYearMax] = useState(2030);
  const [showDirSuggestions, setShowDirSuggestions] = useState(false);

  // items 로드 완료 후 연도 범위 초기화
  const yearInitRef = useRef(false);
  useEffect(() => {
    if (yearInitRef.current || !items.length) return;
    const years = items.map(i => i.year).filter(y => y > 0);
    if (years.length) {
      setYearMin(Math.min(...years));
      setYearMax(Math.max(...years));
      yearInitRef.current = true;
    }
  }, [items]);

  // 감독 자동완성 목록
  const directorSuggestions = useMemo(() => {
    if (!directorFilter.trim()) return [];
    const q = directorFilter.toLowerCase();
    return [...new Set(items.map(i => i.director).filter(d => d?.toLowerCase().includes(q)))].slice(0, 5);
  }, [items, directorFilter]);

  // ── 표시 목록 (필터 + 정렬) ───────────────────────────────────────────────
  const displayItems = useMemo(() => {
    let result = items.filter(i => i.type === tab);
    if (searchQ) {
      const q = searchQ.toLowerCase();
      result = result.filter(i => i.title.toLowerCase().includes(q) || String(i.year).includes(q));
    }
    if (directorFilter.trim()) {
      const q = directorFilter.toLowerCase();
      result = result.filter(i => i.director?.toLowerCase().includes(q));
    }
    if (ratingFilter > 0) result = result.filter(i => i.rating >= ratingFilter);
    result = result.filter(i => !i.year || (i.year >= yearMin && i.year <= yearMax));
    if (sortBy === 'year') result = [...result].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title, 'ko'));
    else if (sortBy === 'title') result = [...result].sort((a, b) => a.title.localeCompare(b.title, 'ko'));
    else if (sortBy === 'rated') result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sortBy === 'reviewed') result = result.filter(i => i.rating > 0 || i.review_text);
    return result;
  }, [items, tab, searchQ, directorFilter, ratingFilter, yearMin, yearMax, sortBy]);

  // ── 탭 통계 ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const tabItems = items.filter(i => i.type === tab);
    const ratings = tabItems.filter(i => i.rating > 0).map(i => i.rating);
    return {
      total: tabItems.length,
      reviewed: tabItems.filter(i => i.rating > 0 || i.review_text).length,
      avg: ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '-',
    };
  }, [items, tab]);

  // ── 홈 위젯 (watched_at 기반) ─────────────────────────────────────────────
  const widgetData = useMemo(() => {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = now.getMonth();
    const watched = items.filter(i => i.watched_at);
    const thisMonth = watched.filter(i => {
      const d = new Date(i.watched_at);
      return d.getFullYear() === yr && d.getMonth() === mo;
    });
    const lastYearSameMonth = watched.filter(i => {
      const d = new Date(i.watched_at);
      return d.getFullYear() === yr - 1 && d.getMonth() === mo;
    });
    const thisYear = watched.filter(i => new Date(i.watched_at).getFullYear() === yr);
    const recent = [...watched].sort((a, b) => new Date(b.watched_at) - new Date(a.watched_at)).slice(0, 5);
    const trend = thisMonth.length > lastYearSameMonth.length ? '↑'
      : thisMonth.length < lastYearSameMonth.length ? '↓' : null;
    return { thisMonth: thisMonth.length, thisYear: thisYear.length, trend, lastYear: lastYearSameMonth.length, recent };
  }, [items]);

  // ── 핸들러 ────────────────────────────────────────────────────────────────

  // 편집 후 모달의 item도 최신화
  const handleEditItemAndUpdate = async (item, fields) => {
    const updated = await handleEditItem(item, fields);
    if (updated) setDetailItem(updated);
    return updated;
  };

  // 포스터 업데이트 후 캐시 갱신
  const handleUpdatePosterAndCache = async (id, posterUrl) => {
    const updated = await handleUpdatePoster(id, posterUrl);
    if (updated) updateCacheKey(`${updated.title}_${updated.year}`, posterUrl);
  };

  // CSV 내보내기
  const handleCsvExport = () => {
    const header = 'title,year,type,director,cast_info,rating,review_text,review_date';
    const rows = items.map(i =>
      [i.title, i.year, i.type, i.director, i.cast_info, i.rating, i.review_text, i.review_date]
        .map(v => `"${String(v || '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `미디어다이어리_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = () => { logout(); navigate('/login'); };
  const tabLabels = { movie: '영화', anime: '애니메이션', drama: '드라마' };

  // ── 로딩 화면 ─────────────────────────────────────────────────────────────
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
      {/* ── 헤더 ── */}
      <div className="mdb-header">
        <h1 className="mdb-title">내 미디어 일기</h1>
        <div className="mdb-controls">
          <input
            className="search-input"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="제목 검색..."
          />
          <button
            className={`btn ${filterOpen ? 'btn-primary' : ''}`}
            onClick={() => setFilterOpen(v => !v)}
          >
            필터{filterOpen ? ' ▲' : ' ▼'}
          </button>
          <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="year">연도순</option>
            <option value="title">제목순</option>
            <option value="rated">별점 높은순</option>
            <option value="reviewed">감상 있는 것</option>
          </select>
          <button className="btn" onClick={() => setAiSearchOpen(true)} title="AI 자연어 검색">✨ AI 검색</button>
          <button className="btn btn-primary" onClick={() => setAddModalOpen(true)}>+ 추가</button>
          <div className="mdb-user">
            <Link to="/stats" className="btn">통계</Link>
            <button className="btn" onClick={handleCsvExport} title="CSV 내보내기">내보내기</button>
            <button className="btn" onClick={() => setCsvImportOpen(true)} title="CSV 가져오기">가져오기</button>
            <span className="mdb-greeting">안녕하세요 <strong>{user?.name}</strong>님</span>
            <button className="btn" onClick={toggleTheme}>{theme === 'dark' ? '라이트' : '다크'}</button>
            <button className="btn" onClick={handleLogout}>로그아웃</button>
          </div>
        </div>
      </div>

      {/* ── 필터 패널 ── */}
      {filterOpen && (
        <div className="filter-panel">
          {/* 감독 자동완성 */}
          <div className="filter-item" style={{ position: 'relative' }}>
            <label className="filter-label">감독</label>
            <input
              className="search-input"
              value={directorFilter}
              onChange={e => { setDirectorFilter(e.target.value); setShowDirSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowDirSuggestions(false), 150)}
              placeholder="감독 이름..."
              style={{ width: 160 }}
            />
            {showDirSuggestions && directorSuggestions.length > 0 && (
              <div className="dir-suggestions">
                {directorSuggestions.map(d => (
                  <div key={d} className="dir-suggestion-item" onMouseDown={() => { setDirectorFilter(d); setShowDirSuggestions(false); }}>
                    {d}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 별점 프리셋 */}
          <div className="filter-item">
            <label className="filter-label">별점</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[[0, '전체'], [3, '★3+'], [4, '★4+'], [5, '★5만']].map(([v, label]) => (
                <button
                  key={v}
                  className={`btn ${ratingFilter === v ? 'btn-primary' : ''}`}
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => setRatingFilter(v)}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* 연도 범위 */}
          <div className="filter-item">
            <label className="filter-label">연도</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                value={yearMin}
                onChange={e => setYearMin(Number(e.target.value))}
                style={{ width: 72, padding: '4px 8px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, fontFamily: 'inherit' }}
              />
              <span style={{ color: '#888', fontSize: 13 }}>~</span>
              <input
                type="number"
                value={yearMax}
                onChange={e => setYearMax(Number(e.target.value))}
                style={{ width: 72, padding: '4px 8px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, fontFamily: 'inherit' }}
              />
            </div>
          </div>

          <button
            className="btn"
            style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => {
              setDirectorFilter('');
              setRatingFilter(0);
              const years = items.map(i => i.year).filter(y => y > 0);
              if (years.length) { setYearMin(Math.min(...years)); setYearMax(Math.max(...years)); }
            }}
          >
            초기화
          </button>
        </div>
      )}

      {/* ── 오늘의 추천 위젯 ── */}
      <DailyRecommendations onAdd={handleAdd} existingItems={items} />

      {/* ── 홈 위젯 ── */}
      <div className="widget-bar">
        <div className="widget-card">
          <div className="widget-value">
            {widgetData.thisMonth}
            {widgetData.trend && <span className={`widget-trend ${widgetData.trend === '↑' ? 'up' : 'down'}`}>{widgetData.trend}</span>}
          </div>
          <div className="widget-label">이번 달 감상</div>
          {widgetData.lastYear > 0 && (
            <div className="widget-sub">작년 동월 {widgetData.lastYear}편</div>
          )}
        </div>
        <div className="widget-card">
          <div className="widget-value">{widgetData.thisYear}</div>
          <div className="widget-label">올해 감상</div>
        </div>
        <div className="widget-card">
          <div className="widget-value">{items.filter(i => i.rating > 0 || i.review_text).length}</div>
          <div className="widget-label">총 감상 기록</div>
        </div>
      </div>

      {/* 최근 감상 작품 가로 스크롤 */}
      {widgetData.recent.length > 0 && (
        <div className="recent-section">
          <div className="recent-title">최근 감상</div>
          <div className="recent-scroll">
            {widgetData.recent.map(item => (
              <div
                key={item.id}
                className="recent-card"
                onClick={() => { setTab(item.type); setDetailItem(item); }}
              >
                <div className="recent-poster">
                  {getPosterUrl(item) ? (
                    <img src={getPosterUrl(item)} alt={item.title} />
                  ) : <span>🎬</span>}
                </div>
                <div className="recent-card-title">{item.title}</div>
                {item.rating > 0 && <div className="recent-card-stars">{'★'.repeat(item.rating)}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 탭 ── */}
      <div className="tab-bar">
        {Object.entries(tabLabels).map(([key, label]) => (
          <button
            key={key}
            className={`tab ${tab === key ? 'active' : ''}`}
            onClick={() => { setTab(key); setSearchQ(''); }}
          >{label}</button>
        ))}
      </div>

      {/* ── 탭 통계 ── */}
      <div className="stats-bar">
        <span className="stat">전체 <strong>{stats.total}</strong>편</span>
        <span className="stat">감상 기록 <strong>{stats.reviewed}</strong>편</span>
        <span className="stat">평균 별점 <strong>{stats.avg}</strong></span>
      </div>

      {/* ── 그리드 ── */}
      {displayItems.length === 0 ? (
        <div className="empty">검색 결과가 없습니다</div>
      ) : sortBy === 'year' && !searchQ && !directorFilter && !ratingFilter ? (
        // 연도순 + 필터 없을 때만 10년 단위 섹션 그룹핑
        Object.entries(
          displayItems.reduce((acc, item) => {
            const decade = item.year ? Math.floor(item.year / 10) * 10 : null;
            const key = decade != null ? `${decade}~${decade + 9}` : '미상';
            (acc[key] = acc[key] || []).push(item);
            return acc;
          }, {})
        )
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([decade, yearItems]) => (
            <div key={decade} className="year-section">
              <div className="year-header">{decade}</div>
              <div className="grid">
                {yearItems.map(item => (
                  <MediaCard key={item.id} item={item} posterUrl={getPosterUrl(item)} onClick={() => setDetailItem(item)} />
                ))}
              </div>
            </div>
          ))
      ) : (
        <div className="grid">
          {displayItems.map(item => (
            <MediaCard key={item.id} item={item} posterUrl={getPosterUrl(item)} onClick={() => setDetailItem(item)} />
          ))}
        </div>
      )}

      {/* ── 상세 모달 ── */}
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
          onEditItem={handleEditItemAndUpdate}
          onUpdatePoster={handleUpdatePosterAndCache}
          onAdd={handleAdd}
          existingItems={items}
        />
      )}

      {/* ── 추가 모달 ── */}
      {addModalOpen && (
        <AddModal
          onClose={() => setAddModalOpen(false)}
          onAdd={handleAdd}
          existingItems={items}
          currentTab={tab}
        />
      )}

      {/* ── AI 자연어 검색 모달 ── */}
      {aiSearchOpen && (
        <AiSearchModal
          onClose={() => setAiSearchOpen(false)}
          onAdd={handleAdd}
          existingItems={items}
        />
      )}

      {/* ── CSV 가져오기 모달 ── */}
      {csvImportOpen && (
        <CsvImportModal
          onClose={() => setCsvImportOpen(false)}
          onAdd={handleAdd}
          existingItems={items}
          onImportDone={reloadItems}
        />
      )}
    </div>
  );
}
