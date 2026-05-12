/**
 * @file RestorePage.jsx
 * 과거 기록 복원 메인 페이지 (/restore) — Phase 6.1
 * 카테고리별 큐레이션 리스트 카드 표시
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const BASE = `${import.meta.env.VITE_API_URL}/api/curation`;

// 카테고리별 표시 메타데이터
const CATEGORY_META = {
  franchise:  { label: '프랜차이즈',   icon: '🎬', color: '#e53935' },
  director:   { label: '감독 작품',    icon: '🎭', color: '#1565C0' },
  awards:     { label: '수상작',       icon: '🏆', color: '#F9A825' },
  boxoffice:  { label: '박스오피스',   icon: '📊', color: '#2E7D32' },
  anime:      { label: '애니메이션',   icon: '✨', color: '#6A1B9A' },
  drama:      { label: '드라마',       icon: '📺', color: '#00838F' },
};

// 카테고리 표시 순서
const CATEGORY_ORDER = ['franchise', 'director', 'awards', 'boxoffice', 'anime', 'drama'];

/** 큐레이션 리스트 카드 */
function ListCard({ list, onClick }) {
  const meta = CATEGORY_META[list.category] || { label: list.category, icon: '📋', color: '#888' };
  return (
    <button
      onClick={() => onClick(list.slug)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        width: '100%', textAlign: 'left', padding: 0,
        background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e0e0e0)',
        borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
        boxShadow: '0 1px 4px rgba(0,0,0,.06)',
        transition: 'transform .15s, box-shadow .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.06)'; }}
    >
      {/* 컬러 헤더 바 */}
      <div style={{ width: '100%', padding: '10px 14px', background: meta.color, color: '#fff', fontSize: 13, fontWeight: 600 }}>
        {meta.icon} {meta.label}
      </div>
      {/* 리스트 정보 */}
      <div style={{ padding: '12px 14px', flex: 1, width: '100%' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: 'var(--text-primary, #111)' }}>
          {list.title}
        </div>
        {list.description && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary, #666)', lineHeight: 1.4,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {list.description}
          </div>
        )}
      </div>
      <div style={{ padding: '8px 14px', color: meta.color, fontSize: 12, fontWeight: 600, alignSelf: 'flex-end' }}>
        작품 보기 →
      </div>
    </button>
  );
}

export default function RestorePage() {
  const navigate = useNavigate();
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${BASE}/lists`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setGrouped(json.data);
        else throw new Error(json.message);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 15, color: '#888' }}>불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#e53935' }}>오류: {error}</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px 80px' }}>
      {/* 헤더 */}
      <button
        onClick={() => navigate('/')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary, #666)',
          fontSize: 14, padding: 0, marginBottom: 20 }}
      >
        ← 홈으로
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: 'var(--text-primary, #111)' }}>
        📚 과거 기록 복원
      </h1>
      <p style={{ fontSize: 14, color: 'var(--text-secondary, #666)', margin: '0 0 28px' }}>
        이미 본 작품들을 빠르게 추가하세요. 카테고리를 선택하면 작품 목록이 열립니다.
      </p>

      {/* 카테고리별 섹션 */}
      {CATEGORY_ORDER.map(cat => {
        const lists = grouped[cat];
        if (!lists?.length) return null;
        const meta = CATEGORY_META[cat] || { label: cat, icon: '📋' };

        return (
          <section key={cat} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px',
              color: 'var(--text-primary, #111)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {meta.icon} {meta.label}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {lists.map(list => (
                <ListCard
                  key={list.slug}
                  list={list}
                  onClick={slug => navigate(`/restore/${slug}`)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
