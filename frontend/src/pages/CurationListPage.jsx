/**
 * @file CurationListPage.jsx
 * 큐레이션 리스트 상세 페이지 (/restore/:slug) — Phase 6.1
 * 작품 체크박스 그리드 + 일괄 추가 기능
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const BASE = `${import.meta.env.VITE_API_URL}/api/curation`;
const IMG_BASE = 'https://image.tmdb.org/t/p/w200';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` });

/** 포스터 이미지 or 플레이스홀더 */
function PosterCard({ item, selected, alreadyAdded, onToggle }) {
  const hasPoster = !!item.poster_path;

  return (
    <div
      onClick={() => !alreadyAdded && onToggle(item)}
      style={{
        position: 'relative', cursor: alreadyAdded ? 'default' : 'pointer',
        borderRadius: 8, overflow: 'hidden',
        border: selected ? '3px solid #1565C0' : '2px solid transparent',
        opacity: alreadyAdded ? 0.5 : 1,
        transition: 'border-color .15s, transform .15s',
        transform: selected ? 'scale(1.03)' : 'scale(1)',
        aspectRatio: '2/3',
        background: hasPoster ? '#000' : '#e8eaf6',
      }}
    >
      {/* 포스터 이미지 */}
      {hasPoster ? (
        <img
          src={`${IMG_BASE}${item.poster_path}`}
          alt={item.title}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={e => { e.target.style.display = 'none'; }}
        />
      ) : (
        /* 포스터 없을 때 제목 플레이스홀더 */
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 8, background: '#3949AB' }}>
          <div style={{ fontSize: 11, color: '#fff', textAlign: 'center', lineHeight: 1.3, fontWeight: 600 }}>
            {item.title}
          </div>
          {item.year && <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)', marginTop: 4 }}>{item.year}</div>}
        </div>
      )}

      {/* 선택 체크 오버레이 */}
      {selected && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(21,101,192,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1565C0',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16 }}>
            ✓
          </div>
        </div>
      )}

      {/* 이미 추가됨 배지 */}
      {alreadyAdded && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', color: '#333', fontSize: 10, fontWeight: 700,
            padding: '3px 7px', borderRadius: 12 }}>추가됨</div>
        </div>
      )}

      {/* 하단 제목 (포스터 있을 때) */}
      {hasPoster && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,.8))',
          padding: '16px 6px 6px', color: '#fff', fontSize: 10, lineHeight: 1.3, textAlign: 'center' }}>
          {item.title}
        </div>
      )}
    </div>
  );
}

/** 토스트 알림 */
function Toast({ msg, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      background: '#323232', color: '#fff', padding: '10px 20px', borderRadius: 20,
      fontSize: 13, zIndex: 9999, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,.3)' }}>
      {msg}
    </div>
  );
}

export default function CurationListPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [list, setList] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${BASE}/lists/${slug}/items`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setList(json.data.list);
          setItems(json.data.items);
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const toggleItem = useCallback((item) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(item.tmdb_id)) next.delete(item.tmdb_id);
      else next.add(item.tmdb_id);
      return next;
    });
  }, []);

  // 전체 선택/해제 (이미 추가된 항목 제외)
  const toggleAll = useCallback(() => {
    const available = items.filter(i => !i.already_added);
    const allSelected = available.every(i => selected.has(i.tmdb_id));
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(available.map(i => i.tmdb_id)));
    }
  }, [items, selected]);

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setAdding(true);

    // 선택된 항목의 상세 정보 추출
    const toAdd = items
      .filter(i => selected.has(i.tmdb_id))
      .map(i => ({ tmdb_id: i.tmdb_id, tmdb_type: i.tmdb_type, title: i.title, year: i.year }));

    try {
      const res = await fetch(`${BASE}/bulk-add`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ items: toAdd }),
      });
      const json = await res.json();
      if (json.success) {
        const { added, skipped } = json.data;
        setToast(`${added}개 추가 완료${skipped > 0 ? ` (${skipped}개 중복 스킵)` : ''}`);
        // 추가된 항목을 already_added 로 표시
        setItems(prev => prev.map(i =>
          selected.has(i.tmdb_id) ? { ...i, already_added: true } : i
        ));
        setSelected(new Set());
      } else {
        setToast('추가 실패: ' + json.message);
      }
    } catch (e) {
      setToast('오류: ' + e.message);
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 15, color: '#888' }}>불러오는 중...</div>
      </div>
    );
  }

  const notAdded = items.filter(i => !i.already_added);
  const allSelected = notAdded.length > 0 && notAdded.every(i => selected.has(i.tmdb_id));

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 120px' }}>
      {/* 헤더 */}
      <button
        onClick={() => navigate('/restore')}
        style={{ background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary, #666)', fontSize: 14, padding: 0, marginBottom: 16 }}
      >
        ← 목록으로
      </button>

      {list && (
        <>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px', color: 'var(--text-primary, #111)' }}>
            {list.title}
          </h1>
          {list.description && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary, #666)', margin: '0 0 16px' }}>
              {list.description}
            </p>
          )}
        </>
      )}

      {/* 전체 선택 버튼 + 상태 요약 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={toggleAll}
          className="btn"
          style={{ fontSize: 13, padding: '6px 14px' }}
        >
          {allSelected ? '전체 해제' : '전체 선택'}
        </button>
        <span style={{ fontSize: 13, color: 'var(--text-secondary, #666)' }}>
          {items.length}개 중 이미 추가: {items.filter(i => i.already_added).length}개
        </span>
      </div>

      {/* 작품 그리드 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
        gap: 10,
      }}>
        {items.map(item => (
          <PosterCard
            key={item.id}
            item={item}
            selected={selected.has(item.tmdb_id)}
            alreadyAdded={item.already_added}
            onToggle={toggleItem}
          />
        ))}
      </div>

      {/* 하단 고정 추가 버튼 */}
      {selected.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--card-bg, #fff)', borderTop: '1px solid var(--border-color, #e0e0e0)',
          padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          zIndex: 100, boxShadow: '0 -4px 16px rgba(0,0,0,.08)',
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary, #111)' }}>
            {selected.size}개 선택됨
          </span>
          <button
            className="btn"
            onClick={handleAdd}
            disabled={adding}
            style={{ fontSize: 14, padding: '10px 24px', fontWeight: 700,
              background: '#1565C0', color: '#fff', border: 'none', borderRadius: 8 }}
          >
            {adding ? '추가 중...' : `${selected.size}개 내 목록에 추가`}
          </button>
        </div>
      )}

      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
