/**
 * @file EpithetsPage.jsx
 * 나의 수식어 페이지 (/epithets, Phase 13.1)
 * 카드 그리드(부문별 대표작) → 탭하면 상세(드래그 정렬/이름 편집/삭제/작품 해제)
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTheme } from '../hooks/useTheme';
import useAuthStore from '../store/authStore';
import { renderEpithetCard } from '../utils/epithetCard';

const BASE = `${import.meta.env.VITE_API_URL}/api`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// [카피 초안 — 사용자 검수 예정] 이모지는 라벨에 어울리는 것으로 임의 배정
const PRESETS = [
  { label: '같이 보고 싶은', emoji: '👯' },
  { label: '큰 울림을 준', emoji: '💥' },
  { label: '압도적인 화면', emoji: '🎇' },
  { label: '볼수록 좋아지는', emoji: '🌱' },
  { label: '나만 아는 보석', emoji: '💎' },
  { label: '최고의 반전', emoji: '🔄' },
  { label: '위로가 필요할 때', emoji: '🫂' },
  { label: '기괴한 미학', emoji: '🕸️' },
  { label: '최고의 사운드', emoji: '🎧' },
  { label: '못 잊을 엔딩', emoji: '🌅' },
];

/** 부문 카드 (그리드) — selectMode일 땐 탭으로 카드용 선택/해제 (작품 0개는 선택 불가) */
function EpithetCard({ ep, onClick, selectMode, selected, disabled }) {
  const rep = ep.items[0]; // sort_order 첫 번째 = 대표작
  const restCount = ep.items.length - 1;
  return (
    <button
      className={`epithet-card${selected ? ' selected' : ''}${selectMode && disabled ? ' disabled' : ''}`}
      onClick={onClick}
      disabled={selectMode && disabled}
    >
      <div className="epithet-card-poster">
        {selectMode && <span className="epithet-card-check">{selected ? '✓' : ''}</span>}
        {rep?.poster_url
          ? <img src={rep.poster_url} alt={rep.title} loading="lazy" onError={e => { e.target.style.display = 'none'; }} />
          : <span style={{ fontSize: 28, opacity: .3 }}>🎬</span>}
        {rep && rep.max_rewatch_count >= 2 && (
          <span className="epithet-card-badge">{rep.max_rewatch_count}회 관람</span>
        )}
      </div>
      <div className="epithet-card-label">{ep.emoji} {ep.label}</div>
      <div className="epithet-card-sub">
        {ep.items.length === 0 ? '작품 없음' : `${ep.items.length}편${restCount > 0 ? ` · 대표작 외 ${restCount}편` : ''}`}
      </div>
    </button>
  );
}

/** 부문 상세 — 드래그 정렬, 이름/이모지 편집, 삭제, 작품 해제 */
function EpithetDetail({ epithet, onBack, onUpdate, onDelete }) {
  const [items, setItems] = useState(epithet.items);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(epithet.label);
  const [emojiValue, setEmojiValue] = useState(epithet.emoji || '');
  const [saving, setSaving] = useState(false);
  const dragIndexRef = useRef(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const rowRefs = useRef([]);

  useEffect(() => { setItems(epithet.items); }, [epithet]);

  const saveLabel = async () => {
    const trimmed = labelValue.trim();
    if (!trimmed || trimmed.length > 20) { setLabelValue(epithet.label); setEditingLabel(false); return; }
    setSaving(true);
    try {
      const res = await axios.patch(`${BASE}/epithets/${epithet.id}`, { label: trimmed, emoji: emojiValue || null }, { headers: headers() });
      onUpdate({ ...epithet, ...res.data.data, items });
    } catch {
      setLabelValue(epithet.label);
    }
    setSaving(false);
    setEditingLabel(false);
  };

  const handleDelete = async () => {
    if (!window.confirm(`"${epithet.label}" 수식어를 삭제할까요?\n부착된 작품 연결도 함께 사라집니다(작품 자체는 삭제되지 않아요).`)) return;
    await axios.delete(`${BASE}/epithets/${epithet.id}`, { headers: headers() });
    onDelete(epithet.id);
  };

  const handleDetach = async (item) => {
    await axios.delete(`${BASE}/epithets/${epithet.id}/items/${item.id}`, { headers: headers() });
    const next = items.filter(i => i.id !== item.id);
    setItems(next);
    onUpdate({ ...epithet, items: next });
  };

  // ── 드래그 정렬 (Pointer Events — 마우스·터치 공용) ──────────────────────
  const commitReorder = async (newItems) => {
    setItems(newItems);
    onUpdate({ ...epithet, items: newItems });
    try {
      await axios.patch(`${BASE}/epithets/${epithet.id}/items/reorder`, { ids: newItems.map(i => i.id) }, { headers: headers() });
    } catch { /* 실패해도 로컬 순서는 유지 — 다음 새로고침 시 서버값과 어긋나면 사용자가 재정렬 가능 */ }
  };

  const handlePointerDown = (e, index) => {
    dragIndexRef.current = index;
    setDragIndex(index);
    setOverIndex(index);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (dragIndexRef.current === null) return;
    const y = e.clientY;
    let next = overIndex;
    rowRefs.current.forEach((el, i) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom) next = i;
    });
    if (next !== overIndex) setOverIndex(next);
  };

  const handlePointerUp = () => {
    if (dragIndexRef.current !== null && overIndex !== null && overIndex !== dragIndexRef.current) {
      const newItems = [...items];
      const [moved] = newItems.splice(dragIndexRef.current, 1);
      newItems.splice(overIndex, 0, moved);
      commitReorder(newItems);
    }
    dragIndexRef.current = null;
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="btn" onClick={onBack}>← 목록으로</button>
        <div style={{ flex: 1 }} />
        <button className="btn btn-danger" onClick={handleDelete}>삭제</button>
      </div>

      {/* 이름/이모지 편집 */}
      {!editingLabel ? (
        <button
          className="epithet-detail-title"
          onClick={() => { setLabelValue(epithet.label); setEmojiValue(epithet.emoji || ''); setEditingLabel(true); }}
        >
          {epithet.emoji || '🏷️'} {epithet.label} <span style={{ fontSize: 12, color: '#999' }}>✎ 수정</span>
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
          <input
            className="settings-input" style={{ width: 56, textAlign: 'center', flexShrink: 0 }}
            value={emojiValue} onChange={e => setEmojiValue(e.target.value)} placeholder="🏷️" maxLength={4}
          />
          <input
            className="settings-input" style={{ flex: 1 }}
            value={labelValue} onChange={e => setLabelValue(e.target.value)} maxLength={20} autoFocus
            onKeyDown={e => e.key === 'Enter' && saveLabel()}
          />
          <button className="btn" onClick={() => setEditingLabel(false)} disabled={saving}>취소</button>
          <button className="btn btn-primary" onClick={saveLabel} disabled={saving}>저장</button>
        </div>
      )}

      <div style={{ fontSize: 12, color: '#888', margin: '20px 0 10px' }}>
        {items.length}편 — 잡고 위아래로 끌면 순서를 바꿀 수 있어요 (맨 위=대표작)
      </div>

      {items.length === 0 && (
        <div style={{ textAlign: 'center', color: '#aaa', padding: '2rem 0' }}>
          아직 부착된 작품이 없습니다. 작품 상세에서 "+ 수식어"로 추가해보세요.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
        {items.map((item, idx) => (
          <div
            key={item.id}
            ref={el => { rowRefs.current[idx] = el; }}
            className={`epithet-item-row${dragIndex === idx ? ' dragging' : ''}${overIndex === idx && dragIndex !== null && dragIndex !== idx ? ' drag-over' : ''}`}
          >
            <span
              className="epithet-drag-handle"
              onPointerDown={e => handlePointerDown(e, idx)}
              title="끌어서 순서 변경"
            >⠿</span>
            {item.poster_url
              ? <img src={item.poster_url} alt={item.title} style={{ width: 36, height: 54, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                  onError={e => { e.target.style.display = 'none'; }} />
              : <div style={{ width: 36, height: 54, borderRadius: 4, flexShrink: 0, background: 'rgba(128,128,128,.2)' }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.title} {idx === 0 && <span className="epithet-rep-badge">대표작</span>}
              </div>
              <div style={{ fontSize: 11, color: '#999' }}>
                {item.year}{item.max_rewatch_count >= 2 ? ` · ${item.max_rewatch_count}회 관람` : ''}
              </div>
            </div>
            <button className="btn btn-danger" style={{ fontSize: 11, padding: '4px 8px', flexShrink: 0 }} onClick={() => handleDetach(item)}>
              해제
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EpithetsPage() {
  const navigate = useNavigate();
  useTheme();
  const user = useAuthStore(s => s.user);
  const [epithets, setEpithets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [newLabel, setNewLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [cardMode, setCardMode] = useState(false);
  const [selectedForCard, setSelectedForCard] = useState(new Set());
  const [cardBusy, setCardBusy] = useState(false);
  const [cardPreview, setCardPreview] = useState(null); // { blob, url, canShare }

  const load = () => {
    setLoading(true);
    axios.get(`${BASE}/epithets`, { headers: headers() })
      .then(res => setEpithets(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const createEpithet = async (label, emoji = null) => {
    const trimmed = label.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const res = await axios.post(`${BASE}/epithets`, { label: trimmed, emoji }, { headers: headers() });
      setEpithets(prev => [...prev, res.data.data]);
      setNewLabel('');
    } catch (err) {
      if (err.response?.status !== 409) { /* 중복 라벨은 이미 목록에 있으니 조용히 무시 */ }
      setNewLabel('');
    }
    setCreating(false);
  };

  const updateEpithetInList = (updated) => {
    setEpithets(prev => prev.map(ep => ep.id === updated.id ? updated : ep));
  };

  const removeEpithetFromList = (id) => {
    setEpithets(prev => prev.filter(ep => ep.id !== id));
    setSelectedId(null);
  };

  // ── 공유 카드 (Phase 13.2) ────────────────────────────────────────────────
  const toggleCardSelect = (ep) => {
    if (ep.items.length === 0) return;
    setSelectedForCard(prev => {
      const next = new Set(prev);
      if (next.has(ep.id)) next.delete(ep.id);
      else if (next.size < 6) next.add(ep.id);
      return next;
    });
  };

  const exitCardMode = () => { setCardMode(false); setSelectedForCard(new Set()); };

  const generateCard = async () => {
    setCardBusy(true);
    try {
      const chosen = epithets.filter(ep => selectedForCard.has(ep.id));
      const blob = await renderEpithetCard(chosen, user?.name);
      const url = URL.createObjectURL(blob);
      const file = new File([blob], 'card.png', { type: 'image/png' });
      const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
      setCardPreview({ blob, url, canShare });
      exitCardMode();
    } catch { /* 렌더 실패 — 개별 포스터 실패는 이미 폴백 처리되므로 도달 드묾 */ }
    setCardBusy(false);
  };

  const closePreview = () => {
    if (cardPreview) URL.revokeObjectURL(cardPreview.url);
    setCardPreview(null);
  };

  const saveCard = () => {
    const link = document.createElement('a');
    link.href = cardPreview.url;
    link.download = `수식어카드_${new Date().toISOString().slice(0, 10)}.png`;
    link.click();
  };

  const shareCard = async () => {
    try {
      const file = new File([cardPreview.blob], '수식어카드.png', { type: 'image/png' });
      await navigator.share({ files: [file], title: '나의 인생영화들' });
    } catch { /* 사용자가 공유 시트에서 취소한 경우 등 — 무시 */ }
  };

  const selected = epithets.find(ep => ep.id === selectedId);
  const existingLabels = new Set(epithets.map(ep => ep.label));
  const visiblePresets = epithets.length <= 3 ? PRESETS.filter(p => !existingLabels.has(p.label)) : [];

  return (
    <div className="mdb-container">
      <div className="mdb-header" style={{ marginBottom: 24 }}>
        <h1 className="mdb-title">나의 수식어</h1>
        <div className="mdb-controls">
          {!loading && !selected && !cardMode && epithets.length > 0 && (
            <button className="btn" onClick={() => setCardMode(true)}>카드 만들기</button>
          )}
          <button className="btn" onClick={() => navigate('/')}>← 돌아가기</button>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>불러오는 중...</div>}

      {!loading && selected && (
        <EpithetDetail
          epithet={selected}
          onBack={() => setSelectedId(null)}
          onUpdate={updateEpithetInList}
          onDelete={removeEpithetFromList}
        />
      )}

      {!loading && !selected && (
        <>
          {/* 새 수식어 만들기 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input
              className="settings-input"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createEpithet(newLabel)}
              placeholder="직접 만들기 (예: 3회차에 전율)"
              maxLength={20}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={() => createEpithet(newLabel)} disabled={creating || !newLabel.trim()}>
              만들기
            </button>
          </div>

          {epithets.length === 0 && (
            <div style={{ textAlign: 'center', color: '#aaa', padding: '1rem 0 2rem' }}>
              아직 수식어가 없습니다. 별점과 별개로 "어떻게 좋았나"를 나만의 부문으로 남겨보세요.
            </div>
          )}

          {visiblePresets.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>이런 부문은 어때요?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {visiblePresets.map(p => (
                  <button key={p.label} className="epithet-preset-chip" onClick={() => createEpithet(p.label, p.emoji)} disabled={creating}>
                    {p.emoji} {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {epithets.length > 0 && (
            <div className="epithet-grid" style={{ paddingBottom: cardMode ? 84 : 0 }}>
              {epithets.map(ep => (
                <EpithetCard
                  key={ep.id}
                  ep={ep}
                  selectMode={cardMode}
                  selected={selectedForCard.has(ep.id)}
                  disabled={ep.items.length === 0}
                  onClick={() => cardMode ? toggleCardSelect(ep) : setSelectedId(ep.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {cardMode && (
        <div className="epithet-cardbar">
          <span>{selectedForCard.size}/6 선택됨 (3~6개)</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={exitCardMode}>취소</button>
            <button
              className="btn btn-primary"
              disabled={selectedForCard.size < 3 || selectedForCard.size > 6 || cardBusy}
              onClick={generateCard}
            >
              {cardBusy ? '생성 중...' : '카드 생성'}
            </button>
          </div>
        </div>
      )}

      {cardPreview && (
        <div className="backdrop" onClick={e => e.target === e.currentTarget && closePreview()}>
          <div className="add-modal" style={{ maxWidth: 400 }}>
            <img src={cardPreview.url} alt="수식어 카드 미리보기" style={{ width: '100%', borderRadius: 8, display: 'block', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={closePreview}>닫기</button>
              {cardPreview.canShare && <button className="btn" onClick={shareCard}>공유</button>}
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveCard}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
