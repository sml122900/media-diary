/**
 * @file OnboardingPage.jsx
 * 신규 가입자 온보딩 마법사 (/onboarding) — Phase 6.4
 * 5단계: 환영 → 명작 체크 → AI 대화 → 스크린샷 → 완료
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ScreenshotImportModal from '../components/ScreenshotImportModal';

const API_BASE  = `${import.meta.env.VITE_API_URL}/api`;
const IMG_BASE  = 'https://image.tmdb.org/t/p/w200';
const authHdr   = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const jsonHdr   = () => ({ 'Content-Type': 'application/json', ...authHdr() });

// 온보딩 Step 2 에서 보여줄 큐레이션 리스트 (slug + 아이콘)
const ONBOARDING_LISTS = [
  { slug: 'marvel-mcu',               label: '마블 MCU',          icon: '🎬', color: '#e53935' },
  { slug: 'bong-joon-ho',             label: '봉준호 감독',        icon: '🎭', color: '#1565C0' },
  { slug: 'korean-boxoffice-top30',   label: '한국 박스오피스',    icon: '📊', color: '#2E7D32' },
  { slug: 'studio-ghibli',            label: '스튜디오 지브리',    icon: '✨', color: '#6A1B9A' },
  { slug: 'korean-drama-ratings-top', label: '한국 드라마',        icon: '📺', color: '#00838F' },
];

// AI 대화 시작 예시 프롬프트
const AI_PROMPTS = [
  '고등학생 때 봤던 영화들이 기억 안 나요',
  '90년대 한국 영화 많이 봤어요',
  '픽사 작품 거의 다 봤어요',
  '일본 애니메이션 좋아해요',
];

/** 진행 단계 표시 바 */
function ProgressBar({ step, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          flex: 1, height: 4, borderRadius: 2,
          background: i < step ? '#1565C0' : 'var(--border-color, #e0e0e0)',
          transition: 'background .3s',
        }} />
      ))}
    </div>
  );
}

/** Step 2: 큐레이션 리스트 인라인 체크 */
function CurationStep({ onAddedCount }) {
  const [expanded, setExpanded] = useState(null);   // 열린 리스트 slug
  const [items, setItems]       = useState({});      // slug → 아이템 배열
  const [selected, setSelected] = useState({});     // slug → Set<tmdb_id>
  const [added, setAdded]       = useState({});     // slug → 추가 완료 수
  const [loading, setLoading]   = useState(false);
  const [adding, setAdding]     = useState(false);

  // 리스트 클릭 시 아이템 로드
  const openList = async (slug) => {
    if (expanded === slug) { setExpanded(null); return; }
    setExpanded(slug);
    if (items[slug]) return;
    setLoading(true);
    const res = await fetch(`${API_BASE}/curation/lists/${slug}/items`, { headers: authHdr() });
    const json = await res.json();
    if (json.success) {
      setItems(prev => ({ ...prev, [slug]: json.data.items }));
      // 내 목록에 없는 항목 자동 선택
      const autoSel = new Set(
        json.data.items.filter(i => !i.already_added).map(i => i.tmdb_id)
      );
      setSelected(prev => ({ ...prev, [slug]: autoSel }));
    }
    setLoading(false);
  };

  const toggleItem = (slug, tmdbId) => {
    setSelected(prev => {
      const s = new Set(prev[slug] || []);
      s.has(tmdbId) ? s.delete(tmdbId) : s.add(tmdbId);
      return { ...prev, [slug]: s };
    });
  };

  const addSelected = async (slug) => {
    const listItems  = items[slug] || [];
    const selSet     = selected[slug] || new Set();
    const toAdd      = listItems.filter(i => selSet.has(i.tmdb_id) && !i.already_added);
    if (!toAdd.length) return;
    setAdding(true);
    const res = await fetch(`${API_BASE}/curation/bulk-add`, {
      method: 'POST', headers: jsonHdr(),
      body: JSON.stringify({ items: toAdd.map(i => ({
        tmdb_id: i.tmdb_id, tmdb_type: i.tmdb_type, title: i.title, year: i.year,
      })) }),
    });
    const json = await res.json();
    if (json.success) {
      const n = json.data.added;
      setAdded(prev => ({ ...prev, [slug]: (prev[slug] || 0) + n }));
      onAddedCount(n);
      // 추가된 항목 already_added 마킹
      setItems(prev => ({
        ...prev,
        [slug]: prev[slug].map(i => selSet.has(i.tmdb_id) ? { ...i, already_added: true } : i),
      }));
      setSelected(prev => ({ ...prev, [slug]: new Set() }));
    }
    setAdding(false);
  };

  return (
    <div>
      <p style={{ fontSize: 14, color: 'var(--text-secondary, #666)', marginBottom: 16, lineHeight: 1.6 }}>
        자주 본 장르·감독 카테고리를 선택하면 작품 목록을 체크할 수 있습니다.
      </p>
      {ONBOARDING_LISTS.map(list => {
        const isOpen    = expanded === list.slug;
        const listItems = items[list.slug] || [];
        const selSet    = selected[list.slug] || new Set();
        const addedN    = added[list.slug] || 0;
        const selCount  = [...selSet].filter(id => !listItems.find(i => i.tmdb_id === id && i.already_added)).length;

        return (
          <div key={list.slug} style={{ marginBottom: 8, borderRadius: 12, overflow: 'hidden',
            border: '1px solid var(--border-color, #e0e0e0)' }}>
            {/* 카드 헤더 */}
            <button
              onClick={() => openList(list.slug)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 16px', background: isOpen ? list.color : 'var(--card-bg, #fff)',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                color: isOpen ? '#fff' : 'var(--text-primary, #111)', transition: 'background .2s' }}
            >
              <span style={{ fontSize: 20 }}>{list.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{list.label}</span>
              {addedN > 0 && (
                <span style={{ fontSize: 12, background: 'rgba(255,255,255,.25)',
                  padding: '2px 8px', borderRadius: 10, color: isOpen ? '#fff' : list.color, fontWeight: 700 }}>
                  +{addedN}편 추가됨
                </span>
              )}
              <span style={{ fontSize: 14 }}>{isOpen ? '▲' : '▼'}</span>
            </button>

            {/* 아이템 그리드 */}
            {isOpen && (
              <div style={{ padding: '12px 12px 16px' }}>
                {loading && !listItems.length ? (
                  <div style={{ textAlign: 'center', color: '#888', fontSize: 13, padding: 20 }}>불러오는 중...</div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 8, marginBottom: 12 }}>
                      {listItems.slice(0, 20).map(item => {
                        const isSel   = selSet.has(item.tmdb_id);
                        const isAdded = item.already_added;
                        return (
                          <div key={item.id} onClick={() => !isAdded && toggleItem(list.slug, item.tmdb_id)}
                            style={{ position: 'relative', aspectRatio: '2/3', borderRadius: 6,
                              overflow: 'hidden', cursor: isAdded ? 'default' : 'pointer',
                              border: isSel && !isAdded ? `3px solid ${list.color}` : '2px solid transparent',
                              opacity: isAdded ? .5 : 1,
                              background: item.poster_path ? '#000' : '#3949AB',
                              transform: isSel ? 'scale(1.04)' : 'scale(1)', transition: 'transform .15s' }}>
                            {item.poster_path
                              ? <img src={`${IMG_BASE}${item.poster_path}`} alt={item.title} loading="lazy"
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                                  justifyContent: 'center', padding: 4 }}>
                                  <span style={{ fontSize: 9, color: '#fff', textAlign: 'center', lineHeight: 1.2 }}>{item.title}</span>
                                </div>
                            }
                            {isSel && !isAdded && (
                              <div style={{ position: 'absolute', inset: 0, background: `${list.color}55`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: 22, height: 22, borderRadius: '50%', background: list.color,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>✓</div>
                              </div>
                            )}
                            {isAdded && (
                              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ background: '#fff', color: '#333', fontSize: 9, fontWeight: 700,
                                  padding: '2px 5px', borderRadius: 8 }}>추가됨</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#888' }}>
                        {selCount > 0 ? `${selCount}개 선택됨` : '포스터를 클릭해 선택하세요'}
                      </span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <a href={`/restore/${list.slug}`} target="_blank" rel="noreferrer"
                          style={{ fontSize: 12, color: '#888', textDecoration: 'none' }}>전체 보기 →</a>
                        <button onClick={() => addSelected(list.slug)} disabled={selCount === 0 || adding}
                          style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, border: 'none',
                            borderRadius: 6, cursor: selCount > 0 ? 'pointer' : 'not-allowed',
                            background: selCount > 0 ? list.color : '#ccc', color: '#fff' }}>
                          {adding ? '추가 중...' : `${selCount}개 추가`}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Step 3: AI 대화 */
function AiStep({ onGoToChat }) {
  return (
    <div>
      <p style={{ fontSize: 14, color: 'var(--text-secondary, #666)', marginBottom: 20, lineHeight: 1.6 }}>
        "90년대 SF 영화", "고등학생 때 봤던 드라마" 처럼 막연하게 말해도 AI가 작품을 찾아드립니다.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 20 }}>
        {AI_PROMPTS.map(prompt => (
          <button key={prompt} onClick={() => onGoToChat(prompt)}
            style={{ padding: '12px 10px', fontSize: 13, textAlign: 'left', lineHeight: 1.4,
              background: 'var(--card-bg, #f5f5f5)', border: '1px solid var(--border-color, #e0e0e0)',
              borderRadius: 10, cursor: 'pointer', color: 'var(--text-primary, #333)' }}>
            {prompt}
          </button>
        ))}
      </div>
      <button onClick={() => onGoToChat(null)}
        style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 700, border: 'none',
          borderRadius: 12, cursor: 'pointer',
          background: 'linear-gradient(135deg, #1565C0, #0D47A1)', color: '#fff' }}>
        🤖 AI에게 직접 말하기
      </button>
    </div>
  );
}

/** Step 4: 스크린샷 */
function ScreenshotStep({ onAddedCount, onSkip }) {
  const [showModal, setShowModal] = useState(false);
  const [addedN, setAddedN]       = useState(0);

  const handleAdd = async (item) => {
    const res = await fetch(`${API_BASE}/user-media`, {
      method: 'POST', headers: jsonHdr(),
      body: JSON.stringify({ type: item.type, title: item.title, year: item.year,
        director: item.director || '', cast_info: item.cast_info || '',
        tmdb_id: item.tmdb_id || 0, poster_url: item.poster_url || '' }),
    });
    const json = await res.json();
    if (json.success) {
      setAddedN(n => n + 1);
      onAddedCount(1);
      return true;
    }
    return false;
  };

  return (
    <div>
      <p style={{ fontSize: 14, color: 'var(--text-secondary, #666)', marginBottom: 20, lineHeight: 1.6 }}>
        넷플릭스·왓챠·CGV 등 앱의 시청 기록 스크린샷을 올리면 작품을 자동으로 인식합니다.
      </p>

      {addedN > 0 && (
        <div className="chip-success" style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          fontSize: 14, fontWeight: 600 }}>
          ✓ 스크린샷에서 {addedN}편 추가됨
        </div>
      )}

      <button onClick={() => setShowModal(true)}
        style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 700, border: 'none',
          borderRadius: 12, cursor: 'pointer', background: '#37474F', color: '#fff', marginBottom: 12 }}>
        📸 스크린샷 업로드하기
      </button>

      {showModal && (
        <ScreenshotImportModal onClose={() => setShowModal(false)} onAdd={handleAdd} />
      )}
    </div>
  );
}

export default function OnboardingPage() {
  const navigate   = useNavigate();
  const [step, setStep]           = useState(1);      // 1~5
  const [addedTotal, setAddedTotal] = useState(0);    // 이번 온보딩에서 추가한 총 수
  const [completing, setCompleting] = useState(false);

  // 온보딩 step을 백엔드에 저장
  const saveStep = useCallback(async (s) => {
    await fetch(`${API_BASE}/onboarding/step`, {
      method: 'POST', headers: jsonHdr(), body: JSON.stringify({ step: s }),
    });
  }, []);

  const goStep = useCallback((s) => {
    setStep(s);
    saveStep(s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [saveStep]);

  const addedCount = useCallback((n) => {
    setAddedTotal(prev => prev + n);
  }, []);

  // 온보딩 완료 처리
  const complete = useCallback(async () => {
    setCompleting(true);
    await fetch(`${API_BASE}/onboarding/complete`, { method: 'POST', headers: jsonHdr() });
    setCompleting(false);
    navigate('/');
  }, [navigate]);

  // 전체 건너뛰기
  const skipAll = useCallback(async () => {
    await fetch(`${API_BASE}/onboarding/complete`, { method: 'POST', headers: jsonHdr() });
    navigate('/');
  }, [navigate]);

  // AI 대화 페이지로 이동 (온보딩 상태 유지를 위해 step=3 저장 후 이동)
  const goToChat = useCallback(async (prompt) => {
    await saveStep(3);
    const url = prompt ? `/restore/chat?prompt=${encodeURIComponent(prompt)}` : '/restore/chat';
    navigate(url);
  }, [saveStep, navigate]);

  // 단계별 헤더
  const STEP_META = [
    null,
    { title: '환영합니다! 🎬',        sub: '이미 본 작품 100편을 15분 안에 정리해드릴게요' },
    { title: '명작 체크 ✅',          sub: '자주 본 카테고리에서 작품을 골라보세요' },
    { title: 'AI로 더 찾기 🤖',       sub: '기억 안 나는 작품도 AI가 찾아드려요 (선택)' },
    { title: '스크린샷 가져오기 📸',   sub: 'OTT·영화관 앱 기록도 가져올 수 있어요 (선택)' },
    { title: '완료! 🎉',              sub: '' },
  ];

  const meta = STEP_META[step];

  return (
    <div style={{ minHeight: '100dvh', maxWidth: 600, margin: '0 auto', padding: '32px 16px 80px' }}>

      {/* 전체 건너뛰기 버튼 */}
      {step < 5 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button onClick={skipAll}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary, #999)', fontSize: 13 }}>
            건너뛰고 바로 시작 →
          </button>
        </div>
      )}

      {/* 진행 바 */}
      <ProgressBar step={step} total={5} />

      {/* 단계 헤더 */}
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', color: 'var(--text-primary, #111)' }}>
        {meta?.title}
      </h1>
      {meta?.sub && (
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #666)', margin: '0 0 24px', lineHeight: 1.6 }}>
          {meta.sub}
        </p>
      )}

      {/* ── Step 1: 환영 ── */}
      {step === 1 && (
        <div>
          <div style={{ background: 'linear-gradient(135deg, #1565C0, #0D47A1)', borderRadius: 16,
            padding: '28px 24px', marginBottom: 24, color: '#fff', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
              이미 본 작품을 지금 정리해드릴게요
            </div>
            <div style={{ fontSize: 13, opacity: .85, lineHeight: 1.6 }}>
              명작 체크리스트, AI 대화, 스크린샷 인식으로<br />
              15분 만에 내 시청 기록을 완성할 수 있어요.
            </div>
          </div>

          {/* 3단계 미리보기 */}
          {[
            { icon: '✅', title: '명작 체크', desc: '마블·지브리·한국 드라마 등 인기 리스트에서 체크' },
            { icon: '🤖', title: 'AI 대화', desc: '"90년대 SF 좋아했어요"처럼 말하면 작품 찾아줌' },
            { icon: '📸', title: '스크린샷', desc: '넷플릭스·CGV 앱 화면 올리면 자동 인식' },
          ].map(item => (
            <div key={item.icon} style={{ display: 'flex', gap: 14, padding: '12px 0',
              borderBottom: '1px solid var(--border-color, #eee)' }}>
              <div style={{ fontSize: 24, width: 32, textAlign: 'center', flexShrink: 0 }}>{item.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary, #666)' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Step 2: 큐레이션 체크 ── */}
      {step === 2 && <CurationStep onAddedCount={addedCount} />}

      {/* ── Step 3: AI 대화 ── */}
      {step === 3 && <AiStep onGoToChat={goToChat} />}

      {/* ── Step 4: 스크린샷 ── */}
      {step === 4 && <ScreenshotStep onAddedCount={addedCount} />}

      {/* ── Step 5: 완료 ── */}
      {step === 5 && (
        <div style={{ textAlign: 'center', paddingTop: 16 }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>🎉</div>
          {addedTotal > 0 ? (
            <>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary, #111)', marginBottom: 8 }}>
                총 {addedTotal}편 추가됐어요!
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary, #666)', marginBottom: 32 }}>
                미디어 다이어리에 오신 것을 환영합니다.<br />
                언제든지 메뉴의 "과거 기록 복원"에서 추가할 수 있어요.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary, #111)', marginBottom: 8 }}>
                미디어 다이어리 시작!
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary, #666)', marginBottom: 32 }}>
                홈에서 직접 작품을 추가하거나, 언제든 메뉴의 "과거 기록 복원"을 이용하세요.
              </div>
            </>
          )}
          <button onClick={complete} disabled={completing}
            style={{ padding: '16px 48px', fontSize: 16, fontWeight: 800, border: 'none',
              borderRadius: 14, cursor: 'pointer',
              background: 'linear-gradient(135deg, #1565C0, #0D47A1)', color: '#fff' }}>
            {completing ? '이동 중...' : '홈으로 이동 →'}
          </button>
        </div>
      )}

      {/* ── 하단 네비게이션 버튼 ── */}
      {step < 5 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--card-bg, #fff)', borderTop: '1px solid var(--border-color, #e0e0e0)',
          padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          maxWidth: 600, margin: '0 auto', zIndex: 100 }}>
          {step > 1 ? (
            <button onClick={() => goStep(step - 1)}
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary, #666)', fontSize: 14, padding: '8px 0' }}>
              ← 이전
            </button>
          ) : <div />}

          <button onClick={() => goStep(step + 1)}
            style={{ padding: '12px 28px', fontSize: 15, fontWeight: 700, border: 'none',
              borderRadius: 10, cursor: 'pointer',
              background: '#1565C0', color: '#fff' }}>
            {step === 1 ? '시작하기 →' : step === 4 ? '완료 →' : '다음 단계 →'}
          </button>
        </div>
      )}
    </div>
  );
}
