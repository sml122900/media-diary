/**
 * @file RestorePage.jsx
 * 과거 기록 복원 메인 페이지 (/restore)
 * Phase 6.1: 큐레이션 리스트 체크
 * Phase 7.2: 감독/배우 자유 검색
 * Phase 7.3: 2단계 아코디언 + 필터 검색
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const BASE     = `${import.meta.env.VITE_API_URL}/api/curation`;
const IMG_BASE = 'https://image.tmdb.org/t/p/w200';
const PROF_BASE = 'https://image.tmdb.org/t/p/w185';
const authHdr  = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const jsonHdr  = () => ({ 'Content-Type': 'application/json', ...authHdr() });

// ─── 2단계 아코디언 계층 정의 ──────────────────────────────────────────────
const SUPER_GROUPS = [
  {
    id: 'movie', label: '🎬 영화', color: '#e53935',
    subGroups: [
      { id: 'franchise',      label: '시리즈 / 프랜차이즈', filter: l => l.category === 'franchise' },
      { id: 'kr-director',   label: '한국 감독',            filter: l => l.category === 'director' && l.region === 'kr' },
      { id: 'global-director', label: '해외 감독',          filter: l => l.category === 'director' && l.region === 'global' },
      { id: 'boxoffice',     label: '박스오피스',            filter: l => l.category === 'boxoffice' },
      { id: 'awards-movie',  label: '시상식 수상작',         filter: l => l.category === 'awards' && l.media_type !== 'drama' },
      { id: 'genre',         label: '장르별',                filter: l => l.category === 'genre' },
    ],
  },
  {
    id: 'drama', label: '📺 드라마', color: '#00838F',
    subGroups: [
      // awards는 awards-drama가 별도 처리하므로 category!='awards' 조건 추가 (중복 방지)
      { id: 'kr-drama',     label: '한국 드라마',           filter: l => l.media_type === 'drama' && l.region === 'kr'     && l.category !== 'awards' },
      { id: 'global-drama', label: '해외 드라마',           filter: l => l.media_type === 'drama' && l.region === 'global' && l.category !== 'awards' },
      { id: 'awards-drama', label: '드라마 시상식',         filter: l => l.category === 'awards' && l.media_type === 'drama' },
    ],
  },
  {
    id: 'anime', label: '🎌 애니메이션', color: '#6A1B9A',
    subGroups: [
      { id: 'anime-all', label: '애니메이션', filter: l => l.media_type === 'anime' },
    ],
  },
];

// ─── ListCard ───────────────────────────────────────────────────────────────
function ListCard({ list, onClick }) {
  return (
    <button
      onClick={() => onClick(list.slug)}
      style={{
        display: 'flex', flexDirection: 'column', width: '100%', textAlign: 'left',
        padding: 0, background: 'var(--card-bg, #fff)',
        border: '1px solid var(--border-color, #e0e0e0)', borderRadius: 10,
        overflow: 'hidden', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        transition: 'transform .15s, box-shadow .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.06)'; }}
    >
      <div style={{ padding: '10px 12px', flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary, #111)', marginBottom: 3 }}>
          {list.title}
        </div>
        {list.description && (
          <div style={{ fontSize: 11, color: 'var(--text-secondary, #888)', lineHeight: 1.4,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {list.description}
          </div>
        )}
      </div>
      <div style={{ padding: '6px 12px', textAlign: 'right', fontSize: 11, color: '#aaa' }}>보기 →</div>
    </button>
  );
}

// ─── SubGroup (2단계 내부) ───────────────────────────────────────────────────
function SubGroup({ subGroup, lists, onClickList }) {
  const filtered = lists.filter(subGroup.filter);
  if (filtered.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, #888)',
        marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>
        {subGroup.label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
        {filtered.map(list => (
          <ListCard key={list.slug} list={list} onClick={onClickList} />
        ))}
      </div>
    </div>
  );
}

// ─── SuperGroup (1단계 아코디언) ─────────────────────────────────────────────
function SuperGroup({ sg, allLists, filterText, onClickList }) {
  const [open, setOpen] = useState(true);

  // 필터 텍스트가 있을 때 자동으로 열기
  useEffect(() => { if (filterText) setOpen(true); }, [filterText]);

  // 이 super group에 해당하는 리스트 (필터 적용)
  const relevantLists = allLists.filter(l => {
    const inThisGroup = sg.subGroups.some(sg2 => sg2.filter(l));
    if (!inThisGroup) return false;
    if (!filterText) return true;
    return l.title.toLowerCase().includes(filterText.toLowerCase());
  });
  if (relevantLists.length === 0 && filterText) return null;

  return (
    <section style={{ marginBottom: 20 }}>
      {/* 상위 카테고리 헤더 */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: sg.color, color: '#fff', marginBottom: open ? 12 : 0,
          fontWeight: 800, fontSize: 16,
        }}
      >
        <span>{sg.label}</span>
        <span style={{ fontSize: 14, opacity: .8 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ paddingLeft: 4 }}>
          {sg.subGroups.map(sub => (
            <SubGroup
              key={sub.id}
              subGroup={sub}
              lists={relevantLists}
              onClickList={onClickList}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── PersonSearch (Stage 7.2) ────────────────────────────────────────────────
function PersonSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [persons, setPersons] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [workType, setWorkType] = useState('director'); // 'director' | 'actor'
  const [works, setWorks] = useState([]);
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState(null);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = e => { if (!wrapRef.current?.contains(e.target)) setShowDropdown(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 디바운스 검색
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setPersons([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`${BASE}/person/search?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (json.success) { setPersons(json.data); setShowDropdown(true); }
    }, 300);
  }, [query]);

  const selectPerson = useCallback(async (person) => {
    setSelectedPerson(person);
    setShowDropdown(false);
    setQuery(person.name);
    setSelected(new Set());
    // 기본 type: known_for_department 기준
    const t = person.known_for_department === 'Acting' ? 'actor' : 'director';
    setWorkType(t);
    await loadWorks(person.id, t);
  }, []);

  const loadWorks = async (personId, type) => {
    setLoadingWorks(true);
    setWorks([]);
    try {
      const res = await fetch(`${BASE}/person/${personId}/works?type=${type}`, { headers: authHdr() });
      const json = await res.json();
      if (json.success) setWorks(json.data);
    } finally {
      setLoadingWorks(false);
    }
  };

  const switchType = async (t) => {
    setWorkType(t);
    setSelected(new Set());
    if (selectedPerson) await loadWorks(selectedPerson.id, t);
  };

  const toggleWork = (tmdbId) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(tmdbId) ? next.delete(tmdbId) : next.add(tmdbId);
      return next;
    });
  };

  const handleAdd = async () => {
    const toAdd = works.filter(w => selected.has(w.tmdb_id) && !w.already_added);
    if (!toAdd.length) return;
    setAdding(true);
    const res = await fetch(`${BASE}/bulk-add`, {
      method: 'POST', headers: jsonHdr(),
      body: JSON.stringify({ items: toAdd.map(w => ({
        tmdb_id: w.tmdb_id, tmdb_type: w.tmdb_type, title: w.title, year: w.year,
      })) }),
    });
    const json = await res.json();
    if (json.success) {
      setToast(`${json.data.added}개 추가됨`);
      setWorks(prev => prev.map(w => selected.has(w.tmdb_id) ? { ...w, already_added: true } : w));
      setSelected(new Set());
      setTimeout(() => setToast(null), 3000);
    }
    setAdding(false);
  };

  return (
    <div style={{ marginBottom: 28, padding: 18, background: 'var(--card-bg, #fff)',
      border: '1px solid var(--border-color, #e0e0e0)', borderRadius: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: 'var(--text-primary, #111)' }}>
        🎭 감독 / 배우로 찾기
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary, #888)', marginBottom: 12 }}>
        감독이나 배우 이름을 검색하면 그 사람의 작품을 모두 볼 수 있어요.
      </div>

      {/* 검색창 */}
      <div ref={wrapRef} style={{ position: 'relative', marginBottom: 12 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => persons.length && setShowDropdown(true)}
          placeholder="봉준호, 크리스토퍼 놀란, 탕웨이..."
          style={{
            width: '100%', padding: '10px 14px', fontSize: 14, boxSizing: 'border-box',
            border: '1px solid var(--border-color, #ddd)', borderRadius: 10,
            background: 'transparent', color: 'inherit', fontFamily: 'inherit', outline: 'none',
          }}
        />

        {/* 드롭다운 */}
        {showDropdown && persons.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #ddd)',
            borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', overflow: 'hidden',
          }}>
            {persons.map(p => (
              <button
                key={p.id}
                onClick={() => selectPerson(p)}
                style={{
                  width: '100%', display: 'flex', gap: 10, alignItems: 'center',
                  padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
                  textAlign: 'left', borderBottom: '1px solid var(--border-color, #f0f0f0)',
                }}
              >
                {p.profile_path
                  ? <img src={`${PROF_BASE}${p.profile_path}`} alt={p.name}
                      style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <div className="placeholder-box" style={{ width: 36, height: 36, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>👤</div>
                }
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary, #111)' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>
                    {p.known_for_department === 'Acting' ? '배우' : p.known_for_department === 'Directing' ? '감독' : p.known_for_department}
                    {p.known_for.length > 0 && ` · ${p.known_for.join(', ')}`}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 선택된 인물의 감독/배우 토글 */}
      {selectedPerson && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {['director', 'actor'].map(t => (
            <button key={t} onClick={() => switchType(t)}
              style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 20,
                border: `1.5px solid ${workType === t ? '#1565C0' : 'var(--border-color, #ddd)'}`,
                background: workType === t ? '#1565C0' : 'transparent',
                color: workType === t ? '#fff' : 'var(--text-secondary, #666)', cursor: 'pointer',
              }}>
              {t === 'director' ? '감독 작품' : '출연 작품'}
            </button>
          ))}
        </div>
      )}

      {/* 작품 그리드 */}
      {loadingWorks && (
        <div style={{ textAlign: 'center', color: '#888', fontSize: 13, padding: 20 }}>
          작품 불러오는 중...
        </div>
      )}

      {!loadingWorks && works.length > 0 && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
            gap: 8, marginBottom: 10,
          }}>
            {works.map(w => {
              const isSel   = selected.has(w.tmdb_id);
              const isAdded = w.already_added;
              return (
                <div key={`${w.tmdb_id}-${w.tmdb_type}`}
                  onClick={() => !isAdded && toggleWork(w.tmdb_id)}
                  style={{
                    position: 'relative', aspectRatio: '2/3', borderRadius: 6, overflow: 'hidden',
                    cursor: isAdded ? 'default' : 'pointer', opacity: isAdded ? .5 : 1,
                    border: isSel && !isAdded ? '3px solid #1565C0' : '2px solid transparent',
                    background: w.poster_path ? '#000' : '#3949AB',
                    transform: isSel ? 'scale(1.04)' : 'scale(1)', transition: 'transform .15s',
                  }}>
                  {w.poster_path
                    ? <img src={`${IMG_BASE}${w.poster_path}`} alt={w.title} loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', padding: 4 }}>
                        <span style={{ fontSize: 9, color: '#fff', textAlign: 'center', lineHeight: 1.3 }}>{w.title}</span>
                      </div>
                  }
                  {isSel && !isAdded && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(21,101,192,.35)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1565C0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>✓</div>
                    </div>
                  )}
                  {isAdded && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ background: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 8, color: '#333' }}>추가됨</div>
                    </div>
                  )}
                  {/* 하단 제목 */}
                  {w.poster_path && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: 'linear-gradient(transparent, rgba(0,0,0,.85))',
                      padding: '12px 4px 4px', color: '#fff', fontSize: 8, textAlign: 'center' }}>
                      {w.title}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 추가 버튼 */}
          {selected.size > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#888' }}>{selected.size}개 선택됨</span>
              <button onClick={handleAdd} disabled={adding}
                style={{
                  padding: '8px 20px', fontSize: 13, fontWeight: 700, border: 'none',
                  borderRadius: 8, cursor: 'pointer', background: '#1565C0', color: '#fff',
                }}>
                {adding ? '추가 중...' : `${selected.size}개 내 목록에 추가`}
              </button>
            </div>
          )}
        </>
      )}

      {toast && (
        <div className="chip-success" style={{ marginTop: 10, padding: '8px 14px', borderRadius: 8,
          fontSize: 13, fontWeight: 600 }}>
          ✓ {toast}
        </div>
      )}
    </div>
  );
}

// ─── LetterboxdSection (Phase 6.5) ───────────────────────────────────────────
function LetterboxdSection() {
  const RESTORE_BASE = `${import.meta.env.VITE_API_URL}/api/restore`;
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setResult(null); setError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${RESTORE_BASE}/letterboxd-csv`, {
        method: 'POST', headers: authHdr(), body: formData,
      });
      const json = await res.json();
      if (json.success) setResult(json.data);
      else setError(json.message);
    } catch (e) { setError('업로드 오류: ' + e.message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  return (
    <div style={{ marginTop: 32, padding: '18px', border: '1px solid var(--border-color, #e0e0e0)',
      borderRadius: 14, background: 'var(--card-bg, #fff)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 22 }}>🎞️</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary, #111)' }}>Letterboxd CSV 가져오기</div>
          <div style={{ fontSize: 12, color: '#888' }}>Letterboxd → 설정 → 데이터 내보내기 → watched.csv</div>
        </div>
      </div>
      {result && (
        <div className="chip-success" style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 10,
          fontSize: 13 }}>
          ✓ {result.added}편 추가 {result.skipped > 0 ? `· ${result.skipped}편 중복 스킵` : ''}
          {result.failed > 0 ? ` · ${result.failed}편 실패` : ''} (총 {result.total}편)
        </div>
      )}
      {error && <div className="chip-error" style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 10,
        fontSize: 13 }}>{error}</div>}
      <button onClick={() => fileRef.current?.click()} disabled={uploading}
        style={{ padding: '10px 20px', fontSize: 13, fontWeight: 700, border: 'none',
          borderRadius: 8, cursor: uploading ? 'not-allowed' : 'pointer',
          background: uploading ? '#ccc' : '#37474F', color: '#fff' }}>
        {uploading ? '가져오는 중...' : '📂 CSV 파일 선택'}
      </button>
      <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleUpload} />
    </div>
  );
}

// ─── 메인 RestorePage ────────────────────────────────────────────────────────
export default function RestorePage() {
  const navigate   = useNavigate();
  const [allLists, setAllLists] = useState([]);  // 모든 리스트 평탄화
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [filterText, setFilter] = useState('');  // 큐레이션 이름 필터

  useEffect(() => {
    fetch(`${BASE}/lists`)
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          // grouped 객체를 flat array로 변환
          setAllLists(Object.values(json.data).flat());
        } else throw new Error(json.message);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 15, color: '#888' }}>불러오는 중...</div>
    </div>
  );
  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#e53935' }}>오류: {error}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 80px' }}>
      {/* 헤더 */}
      <button onClick={() => navigate('/')}
        style={{ background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary, #666)', fontSize: 14, padding: 0, marginBottom: 20 }}>
        ← 홈으로
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: 'var(--text-primary, #111)' }}>
        📚 과거 기록 복원
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary, #666)', margin: '0 0 20px' }}>
        이미 본 작품을 빠르게 추가하세요. 시리즈·감독·장르·배우 어디서든 찾을 수 있어요.
      </p>

      {/* AI 채팅 배너 */}
      <button onClick={() => navigate('/restore/chat')}
        style={{
          width: '100%', padding: '14px 18px', marginBottom: 20,
          background: 'linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)',
          border: 'none', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 14,
          boxShadow: '0 4px 16px rgba(21,101,192,.3)',
        }}>
        <div style={{ fontSize: 28 }}>🤖</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', marginBottom: 2 }}>AI에게 말해서 작품 찾기</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)' }}>
            막연하게 말해도 AI가 구체적인 작품을 찾아드려요
          </div>
        </div>
        <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,.7)', fontSize: 18 }}>→</div>
      </button>

      {/* 감독/배우 자유 검색 (Stage 7.2) */}
      <PersonSearch />

      {/* 큐레이션 이름 필터 검색창 (Stage 7.3) */}
      <div style={{ marginBottom: 20 }}>
        <input
          value={filterText}
          onChange={e => setFilter(e.target.value)}
          placeholder="🔍 큐레이션 이름 검색... (예: 봉준호, MCU, 지브리)"
          style={{
            width: '100%', padding: '10px 14px', fontSize: 14, boxSizing: 'border-box',
            border: '1px solid var(--border-color, #ddd)', borderRadius: 10,
            background: 'transparent', color: 'inherit', fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>

      {/* 2단계 아코디언 (Stage 7.3) */}
      {SUPER_GROUPS.map(sg => (
        <SuperGroup
          key={sg.id}
          sg={sg}
          allLists={allLists}
          filterText={filterText}
          onClickList={slug => navigate(`/restore/${slug}`)}
        />
      ))}

      {/* Letterboxd CSV (Phase 6.5) */}
      <LetterboxdSection />
    </div>
  );
}
