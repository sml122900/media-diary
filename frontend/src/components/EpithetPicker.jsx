/**
 * @file EpithetPicker.jsx
 * 수식어 부착/해제/생성 피커 (Phase 13.1) — DetailModal에서 여는 바텀시트/모달
 * 관리(이름변경·삭제·정렬)는 여기서 하지 않음 — "나의 수식어" 페이지 몫
 */

import { useState } from 'react';
import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL}/api`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// 내 수식어가 0~3개일 때 노출하는 시작 프리셋 — DB에 미리 심지 않고, 탭하면 일반 수식어로 생성됨
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

/**
 * @param {{
 *   mediaId: number,
 *   epithets: Array,
 *   onClose: Function,
 *   onChange: (updater: (prev: Array) => Array) => void,
 * }} props
 */
export default function EpithetPicker({ mediaId, epithets, onClose, onChange }) {
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const isAttached = (ep) => ep.items.some(i => i.user_media_id === mediaId);
  const findItemId = (ep) => ep.items.find(i => i.user_media_id === mediaId)?.id;

  /** 이미 존재하는 수식어에 현재 항목을 부착 (상태에 이미 있는 epithetId 전제) */
  const attachToId = async (epithetId) => {
    const res = await axios.post(`${BASE}/epithets/${epithetId}/items`, { user_media_id: mediaId }, { headers: headers() });
    onChange(prev => prev.map(ep => ep.id === epithetId ? { ...ep, items: [...ep.items, res.data.data] } : ep));
  };

  const toggle = async (ep) => {
    if (busy) return;
    setBusy(true);
    try {
      if (isAttached(ep)) {
        const itemId = findItemId(ep);
        await axios.delete(`${BASE}/epithets/${ep.id}/items/${itemId}`, { headers: headers() });
        onChange(prev => prev.map(e => e.id === ep.id ? { ...e, items: e.items.filter(i => i.id !== itemId) } : e));
      } else {
        await attachToId(ep.id);
      }
    } catch { /* 네트워크 오류 시 조용히 무시 — 목록이 그대로면 사용자가 다시 탭 가능 */ }
    setBusy(false);
  };

  /** 인라인 생성(또는 프리셋 탭) → 즉시 부착. 중복 라벨(409)이면 기존 것에 부착 */
  const createAndAttach = async (label, emoji = null) => {
    const trimmed = label.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const res = await axios.post(`${BASE}/epithets`, { label: trimmed, emoji }, { headers: headers() });
      const newEp = res.data.data;
      onChange(prev => [...prev, newEp]);
      await attachToId(newEp.id);
      setNewLabel('');
    } catch (err) {
      if (err.response?.status === 409) {
        const existingId = err.response.data?.data?.id;
        const existing = epithets.find(ep => ep.id === existingId);
        if (existingId && !existing?.items.some(i => i.user_media_id === mediaId)) {
          await attachToId(existingId).catch(() => {});
        }
        setNewLabel('');
      }
    }
    setBusy(false);
  };

  const existingLabels = new Set(epithets.map(ep => ep.label));
  const visiblePresets = epithets.length <= 3 ? PRESETS.filter(p => !existingLabels.has(p.label)) : [];

  return (
    <div className="backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="add-modal" style={{ maxWidth: 480 }}>
        <h2 style={{ marginBottom: 4 }}>수식어</h2>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>탭해서 부착하거나 해제하세요</p>

        {/* 인라인 생성 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            className="add-input"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createAndAttach(newLabel)}
            placeholder="새 수식어 (예: 3회차에 전율)"
            maxLength={20}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={() => createAndAttach(newLabel)} disabled={busy || !newLabel.trim()}>
            추가
          </button>
        </div>

        {/* 내 수식어 목록 */}
        {epithets.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: visiblePresets.length ? 16 : 0 }}>
            {epithets.map(ep => {
              const attached = isAttached(ep);
              return (
                <button
                  key={ep.id}
                  onClick={() => toggle(ep)}
                  disabled={busy}
                  className={`epithet-row${attached ? ' attached' : ''}`}
                >
                  <span className="epithet-row-check">{attached ? '✓' : ''}</span>
                  {ep.emoji && <span style={{ fontSize: 16 }}>{ep.emoji}</span>}
                  <span style={{ flex: 1, textAlign: 'left' }}>{ep.label}</span>
                  <span style={{ fontSize: 11, color: '#999' }}>{ep.items.length}편</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 프리셋 제안 (내 수식어 0~3개일 때) */}
        {visiblePresets.length > 0 && (
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>이런 부문은 어때요?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {visiblePresets.map(p => (
                <button
                  key={p.label}
                  onClick={() => createAndAttach(p.label, p.emoji)}
                  disabled={busy}
                  className="epithet-preset-chip"
                >
                  {p.emoji} {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <button className="btn" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
