/**
 * @file HomePage.jsx
 * 메인 미디어 다이어리 페이지 (리팩토링 버전)
 * 탭/그리드/필터/홈위젯/모달 통합 — 상세 로직은 hooks/components로 분리
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import MediaCard from '../components/MediaCard';
import DetailModal from '../components/DetailModal';
import AddModal from '../components/AddModal';
import CsvImportModal from '../components/CsvImportModal';
import DailyRecommendations from '../components/DailyRecommendations';
import AiSearchModal from '../components/AiSearchModal';
import ScreenshotImportModal from '../components/ScreenshotImportModal';
import QuickInputModal from '../components/QuickInputModal';
import { useMediaList } from '../hooks/useMediaList';
import { usePosterCache } from '../hooks/usePosterCache';
import { useTheme } from '../hooks/useTheme';
import { deleteAccount } from '../api/auth';
import useTokenStore from '../store/tokenStore';

export default function HomePage() {
  const { user, token, logout } = useAuthStore();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { balance, fetchBalance } = useTokenStore();

  // 미디어 데이터 + CRUD 훅
  const {
    items, loading,
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
  const [screenshotOpen, setScreenshotOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [toast, setToast] = useState(null); // { text: string }
  const menuRef = useRef(null);

  // 토큰 잔액 초기 로딩
  useEffect(() => {
    if (token) fetchBalance(token);
  }, [token]);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cmd/Ctrl+K — 빠른 입력 단축키
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setQuickOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // 토스트 자동 제거 (3초)
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

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
  const RUNTIME_EST = { movie: 110, drama: 60, anime: 24 };

  // 분 → 간결한 시간 문자열 (60분 미만: "N분", 이상: "Nh Nm")
  const formatMins = (m) => {
    if (m <= 0) return null;
    if (m < 60) return `${m}분`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0 ? `${h}시간 ${rem}분` : `${h}시간`;
  };

  const widgetData = useMemo(() => {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = now.getMonth();
    const watched = items.filter(i => i.watched_at);
    const thisMonthItems = watched.filter(i => {
      const d = new Date(i.watched_at);
      return d.getFullYear() === yr && d.getMonth() === mo;
    });
    const lastYearSameMonth = watched.filter(i => {
      const d = new Date(i.watched_at);
      return d.getFullYear() === yr - 1 && d.getMonth() === mo;
    });
    const thisYearItems = watched.filter(i => new Date(i.watched_at).getFullYear() === yr);
    const recent = [...watched].sort((a, b) => new Date(b.watched_at) - new Date(a.watched_at)).slice(0, 5);
    const trend = thisMonthItems.length > lastYearSameMonth.length ? '↑'
      : thisMonthItems.length < lastYearSameMonth.length ? '↓' : null;

    // 시청 시간 합산 (runtime_minutes 없으면 타입별 추정값 사용)
    const sumMins = (arr) => arr.reduce((s, i) => s + (i.runtime_minutes || RUNTIME_EST[i.type] || 90), 0);

    return {
      thisMonth: thisMonthItems.length,
      thisYear: thisYearItems.length,
      monthMins: sumMins(thisMonthItems),
      yearMins: sumMins(thisYearItems),
      trend,
      lastYear: lastYearSameMonth.length,
      recent,
    };
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

  const handleDeleteAccount = async () => {
    if (!window.confirm('정말로 탈퇴하시겠습니까?\n모든 기록이 영구 삭제되며 복구할 수 없습니다.')) return;
    try {
      await deleteAccount(token);
      logout();
      navigate('/login');
    } catch {
      alert('탈퇴 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
    }
  };
  const tabLabels = { movie: '영화', anime: '애니메이션', drama: '드라마' };

  // ── 로딩 화면 ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 12, color: '#888' }}>
        <div style={{ fontSize: 32 }}>📽️</div>
        <div style={{ fontSize: 15 }}>불러오는 중...</div>
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
          <button className="btn btn-primary" onClick={() => setAddModalOpen(true)}>+ 추가</button>

          {/* 토큰 잔액 칩 */}
          <button
            className="token-chip"
            onClick={() => navigate('/billing/charge')}
            title="토큰 충전하기"
          >
            🪙 {balance !== null ? `${balance}` : '···'}
          </button>

          {/* ── 드롭다운 메뉴 ── */}
          <div className="menu-wrap" ref={menuRef}>
            <button
              className={`btn menu-toggle ${menuOpen ? 'btn-primary' : ''}`}
              onClick={() => setMenuOpen(v => !v)}
              aria-haspopup="true"
              aria-expanded={menuOpen}
            >
              ≡ 메뉴
            </button>

            {menuOpen && (
              <div className="menu-dropdown" role="menu">
                {/* 사용자 정보 */}
                <div className="menu-user">
                  <strong>{user?.name}</strong>
                  <span className="menu-username">
                    {/* username은 settings에서 확인 */}
                  </span>
                </div>

                <div className="menu-divider" />

                {/* 탐색 */}
                <div className="menu-section-title">탐색</div>
                <Link to="/stats" className="menu-item" onClick={closeMenu}>통계</Link>
                <Link to="/reports" className="menu-item" onClick={closeMenu}>리포트</Link>
                <Link to="/feed" className="menu-item" onClick={closeMenu}>피드</Link>
                <Link to="/wishlist" className="menu-item" onClick={closeMenu}>나중에 보기</Link>
                <Link to="/watchlists" className="menu-item" onClick={closeMenu}>같이보기</Link>
                <Link to="/lists" className="menu-item" onClick={closeMenu}>리스트</Link>
                {/* 과거 기록 복원 (Phase 6.1~6.3) */}
                <Link to="/restore" className="menu-item" onClick={closeMenu}>📚 과거 기록 복원</Link>
                <Link to="/onboarding" className="menu-item" onClick={closeMenu}>🔄 온보딩 다시 하기</Link>

                <div className="menu-divider" />

                {/* 토큰 */}
                <div className="menu-section-title">토큰</div>
                <Link to="/billing/charge" className="menu-item" onClick={closeMenu}>
                  🪙 충전하기 {balance !== null && <span className="menu-token-balance">{balance}토큰</span>}
                </Link>
                <Link to="/billing/history" className="menu-item" onClick={closeMenu}>결제 이력</Link>
                <Link to="/billing/usage" className="menu-item" onClick={closeMenu}>사용량 통계</Link>

                <div className="menu-divider" />

                {/* 도구 */}
                <div className="menu-section-title">도구</div>
                <button className="menu-item" onClick={() => { setAiSearchOpen(true); closeMenu(); }}>
                  ✨ AI 검색
                </button>
                <button className="menu-item" onClick={() => { setScreenshotOpen(true); closeMenu(); }}>
                  📸 스크린샷
                </button>
                <button className="menu-item" onClick={() => { handleCsvExport(); closeMenu(); }}>
                  CSV 내보내기
                </button>
                <button className="menu-item" onClick={() => { setCsvImportOpen(true); closeMenu(); }}>
                  CSV 가져오기
                </button>

                <div className="menu-divider" />

                {/* 계정 */}
                <div className="menu-section-title">계정</div>
                <Link to="/settings" className="menu-item" onClick={closeMenu}>⚙ 화면 모드 설정</Link>
                <Link to="/settings" className="menu-item" onClick={closeMenu}>설정</Link>
                <button className="menu-item menu-item-danger" onClick={handleLogout}>
                  로그아웃
                </button>
                <button className="menu-item menu-item-delete" onClick={handleDeleteAccount}>
                  회원 탈퇴
                </button>
              </div>
            )}
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
          {formatMins(widgetData.monthMins) && (
            <div className="widget-sub">{formatMins(widgetData.monthMins)}</div>
          )}
          {widgetData.lastYear > 0 && !widgetData.monthMins && (
            <div className="widget-sub">작년 동월 {widgetData.lastYear}편</div>
          )}
        </div>
        <div className="widget-card">
          <div className="widget-value">{widgetData.thisYear}</div>
          <div className="widget-label">올해 감상</div>
          {formatMins(widgetData.yearMins) && (
            <div className="widget-sub">{formatMins(widgetData.yearMins)}</div>
          )}
        </div>
        <div className="widget-card">
          <div className="widget-value">{items.filter(i => i.rating > 0 || i.review_text).length}</div>
          <div className="widget-label">총 감상 기록</div>
        </div>
      </div>

      {/* 연말 결산 배너 (11월~3월 노출) */}
      {(() => {
        const m = new Date().getMonth(); // 0-indexed
        if (m < 10 && m > 2) return null; // 4~9월 숨김
        const yr = new Date().getFullYear();
        const reviewYear = m <= 2 ? yr - 1 : yr;
        return (
          <div className="yir-banner" onClick={() => navigate(`/year-in-review/${reviewYear}`)}>
            <div>
              <div className="yir-banner-text">🎬 {reviewYear}년 감상 결산 보기</div>
              <div className="yir-banner-sub">Spotify Wrapped 스타일로 한 해를 돌아보세요</div>
            </div>
            <div className="yir-banner-arrow">›</div>
          </div>
        );
      })()}

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

      {/* ── 스크린샷 가져오기 모달 ── */}
      {screenshotOpen && (
        <ScreenshotImportModal
          onClose={() => setScreenshotOpen(false)}
          onAdd={handleAdd}
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

      {/* ── 빠른 입력 모달 (Phase 5.5) ── */}
      {quickOpen && (
        <QuickInputModal
          onClose={() => setQuickOpen(false)}
          onAdd={handleAdd}
          onSaved={(title, rating) => setToast({ text: `${title} ★${rating}로 저장됐어요!` })}
        />
      )}

      {/* ── 토스트 알림 ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a1a', color: '#fff', padding: '10px 20px',
          borderRadius: 20, fontSize: 13, zIndex: 3000,
          boxShadow: '0 4px 20px rgba(0,0,0,.3)',
          animation: 'fadeInUp .2s ease',
        }}>
          {toast.text}
        </div>
      )}

      {/* ── 모바일 FAB (빠른 입력) ── */}
      <button
        className="fab-btn"
        onClick={() => setQuickOpen(true)}
        title="빠른 기록 (Cmd+K)"
        aria-label="빠른 기록"
      >
        ⚡
      </button>
    </div>
  );
}
