/**
 * @file QuickInputModal.jsx
 * 빠른 입력 모달 (Phase 5.5)
 * Cmd/Ctrl+K 단축키 또는 FAB 버튼으로 열림
 * TMDB 검색 → 선택 → 별점 → 저장 3단계 흐름
 */

import { useState, useEffect, useRef } from 'react';
import { searchTmdb } from '../api/tmdb';
import { IMG_BASE } from '../utils/constants';

/**
 * @param {{
 *   onClose: Function,
 *   onAdd: Function,
 *   onSaved: Function,  -- 저장 후 토스트용 콜백 (title, rating)
 * }} props
 */
export default function QuickInputModal({ onClose, onAdd, onSaved }) {
  const [step, setStep] = useState('search'); // search | select | rate
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [rating, setRating] = useState(0);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  // 포커스 자동이동
  useEffect(() => {
    if (step === 'search') inputRef.current?.focus();
  }, [step]);

  // TMDB 검색 디바운스
  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const [r1, r2] = await Promise.all([
        searchTmdb(q, 'movie'),
        searchTmdb(q, 'tv'),
      ]);
      setResults([...r1.slice(0, 4), ...r2.slice(0, 3)]);
      setSearching(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  // 작품 선택
  const handleSelect = (r) => {
    const title = r.title || r.name || '';
    const year = parseInt((r.release_date || r.first_air_date || '').slice(0, 4)) || 0;
    const type = r.title ? 'movie' : 'drama';
    setSelected({
      title, year, type,
      tmdb_id: r.id,
      poster_url: r.poster_path ? IMG_BASE + r.poster_path : '',
    });
    setStep('rate');
  };

  // 저장
  const handleSave = async () => {
    setSaving(true);
    try {
      await onAdd({ ...selected, rating, review_text: '' });
      onSaved?.(selected.title, rating);
      onClose();
    } catch { /* 에러 무시 */ }
    setSaving(false);
  };

  // 키보드: 별점 숫자키 1-5
  useEffect(() => {
    if (step !== 'rate') return;
    const handler = (e) => {
      const n = parseInt(e.key);
      if (n >= 1 && n <= 5) setRating(n);
      if (e.key === 'Enter' && rating > 0) handleSave();
      if (e.key === 'Backspace') { setStep('search'); setSelected(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, rating]);

  return (
    <div
      className="backdrop"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ zIndex: 2000 }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,.2)', overflow: 'hidden',
      }}>
        {/* 헤더 */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f0f0ee', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 18 }}>⚡</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>빠른 기록</div>
            <div style={{ fontSize: 11, color: '#aaa' }}>
              {step === 'search' ? '작품을 검색하세요' : step === 'rate' ? '별점을 선택하세요 (숫자키 1-5)' : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#aaa', padding: 0 }}>✕</button>
        </div>

        {/* 검색 단계 */}
        {step === 'search' && (
          <div style={{ padding: 16 }}>
            <input
              ref={inputRef}
              style={{
                width: '100%', padding: '10px 14px', fontSize: 16, border: '1px solid #e0e0e0',
                borderRadius: 10, outline: 'none', fontFamily: 'inherit',
              }}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="제목으로 검색..."
            />
            <div style={{ maxHeight: 320, overflowY: 'auto', marginTop: 8 }}>
              {searching && <div style={{ padding: '8px 4px', color: '#aaa', fontSize: 13 }}>검색 중...</div>}
              {results.map(r => {
                const title = r.title || r.name || '';
                const year = (r.release_date || r.first_air_date || '').slice(0, 4);
                return (
                  <div
                    key={r.id}
                    onClick={() => handleSelect(r)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '8px 4px',
                      cursor: 'pointer', borderRadius: 8, transition: 'background .15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8f8f8'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 36, height: 54, borderRadius: 4, overflow: 'hidden', background: '#f0f0ee', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {r.poster_path
                        ? <img src={IMG_BASE + r.poster_path} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: 16, opacity: .3 }}>🎬</span>
                      }
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{year} · {r.title ? '영화' : 'TV'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 별점 단계 */}
        {step === 'rate' && selected && (
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
              <div style={{ width: 54, height: 80, borderRadius: 6, overflow: 'hidden', background: '#f0f0ee', flexShrink: 0 }}>
                {selected.poster_url
                  ? <img src={selected.poster_url} alt={selected.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 20, opacity: .3 }}>🎬</div>
                }
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.title}</div>
                <div style={{ fontSize: 13, color: '#888' }}>{selected.year}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setRating(r => r === n ? 0 : n)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 40, padding: 0,
                    color: n <= rating ? '#f0a500' : '#e0e0e0',
                    transition: 'color .1s, transform .1s',
                    transform: n <= rating ? 'scale(1.1)' : 'scale(1)',
                  }}
                >★</button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn"
                style={{ flex: 1 }}
                onClick={() => { setStep('search'); setSelected(null); setRating(0); }}
              >← 다시 검색</button>
              <button
                className="btn btn-primary"
                style={{ flex: 2 }}
                onClick={handleSave}
                disabled={saving || rating === 0}
              >
                {saving ? '저장 중...' : rating === 0 ? '별점을 선택해주세요' : `★${rating} 저장`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
