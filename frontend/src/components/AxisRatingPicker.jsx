/**
 * @file AxisRatingPicker.jsx
 * 다면 별점 축 관리 + 부여 피커 (Phase 13.3) — DetailModal에서 여는 모달
 * EpithetPicker(13.1) 패턴을 따르되, "부착"이 아니라 "별점"이라 별을 다시 탭하면 해제(0점)됨.
 * 축 관리(이름/이모지 변경·삭제)도 전용 페이지 없이 여기서 처리.
 */

import { useState } from 'react';
import axios from 'axios';
import StarRating from './StarRating';

const BASE = `${import.meta.env.VITE_API_URL}/api`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// [카피 초안 — 사용자 검수 예정]
const PRESETS = [
  { label: '작품성', emoji: '🎬' },
  { label: '재미', emoji: '🍿' },
  { label: '혼자 볼 때', emoji: '🍺' },
  { label: '가족과 함께', emoji: '👨‍👩‍👧' },
  { label: '다시 볼 가치', emoji: '🔁' },
];

/**
 * @param {{
 *   mediaId: number,
 *   axes: Array,
 *   onClose: Function,
 *   onChange: (updater: (prev: Array) => Array) => void,
 *   onRate: (axisId: number, currentRating: number, n: number) => void,
 * }} props
 */
export default function AxisRatingPicker({ mediaId, axes, onClose, onChange, onRate }) {
  const [newLabel, setNewLabel] = useState('');
  const [newEmoji, setNewEmoji] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editEmoji, setEditEmoji] = useState('');

  const ratingFor = (ax) => ax.items.find(i => i.user_media_id === mediaId)?.rating || 0;

  const createAxis = async (label, emoji = null) => {
    const trimmed = label.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const res = await axios.post(`${BASE}/rating-axes`, { label: trimmed, emoji }, { headers: headers() });
      onChange(prev => [...prev, res.data.data]);
      setNewLabel('');
      setNewEmoji('');
    } catch (err) {
      if (err.response?.status !== 409) { /* 중복 라벨은 이미 목록에 있으니 조용히 무시 */ }
      setNewLabel('');
    }
    setBusy(false);
  };

  const startEdit = (ax) => {
    setEditingId(ax.id);
    setEditLabel(ax.label);
    setEditEmoji(ax.emoji || '');
  };

  const saveEdit = async () => {
    const trimmed = editLabel.trim();
    if (!trimmed || trimmed.length > 20 || busy) return;
    setBusy(true);
    try {
      const res = await axios.patch(`${BASE}/rating-axes/${editingId}`, { label: trimmed, emoji: editEmoji || null }, { headers: headers() });
      onChange(prev => prev.map(ax => ax.id === editingId ? { ...ax, ...res.data.data } : ax));
      setEditingId(null);
    } catch { /* 중복 이름 등 — 편집 상태 유지, 사용자가 다시 시도 가능 */ }
    setBusy(false);
  };

  const deleteAxis = async (ax) => {
    if (!window.confirm(`"${ax.label}" 축을 삭제할까요?\n이 축으로 매긴 모든 점수가 함께 사라집니다.`)) return;
    await axios.delete(`${BASE}/rating-axes/${ax.id}`, { headers: headers() });
    onChange(prev => prev.filter(a => a.id !== ax.id));
  };

  const existingLabels = new Set(axes.map(ax => ax.label));
  const visiblePresets = axes.length <= 3 ? PRESETS.filter(p => !existingLabels.has(p.label)) : [];

  return (
    <div className="backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="add-modal" style={{ maxWidth: 480 }}>
        <h2 style={{ marginBottom: 4 }}>다면 별점</h2>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>별을 탭해서 점수를 매기세요. 매긴 별을 다시 탭하면 해제됩니다.</p>

        {/* 인라인 축 생성 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            className="add-input"
            value={newEmoji}
            onChange={e => setNewEmoji(e.target.value)}
            placeholder="🏷️"
            maxLength={4}
            style={{ width: 56, flexShrink: 0 }}
          />
          <input
            className="add-input"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createAxis(newLabel, newEmoji || null)}
            placeholder="새 기준 (예: 연출)"
            maxLength={20}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={() => createAxis(newLabel, newEmoji || null)} disabled={busy || !newLabel.trim()}>
            추가
          </button>
        </div>

        {/* 내 축 목록 */}
        {axes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: visiblePresets.length ? 16 : 0 }}>
            {axes.map(ax => (
              editingId === ax.id ? (
                <div key={ax.id} className="axis-picker-row">
                  <input className="settings-input" value={editEmoji} onChange={e => setEditEmoji(e.target.value)} placeholder="🏷️" maxLength={4} style={{ width: 48, flexShrink: 0 }} />
                  <input className="settings-input" value={editLabel} onChange={e => setEditLabel(e.target.value)} maxLength={20} autoFocus
                    onKeyDown={e => e.key === 'Enter' && saveEdit()} style={{ flex: 1 }} />
                  <button className="btn" onClick={() => setEditingId(null)} disabled={busy}>취소</button>
                  <button className="btn btn-primary" onClick={saveEdit} disabled={busy}>저장</button>
                </div>
              ) : (
                <div key={ax.id} className="axis-picker-row">
                  <span className="axis-row-label" style={{ flex: 1 }}>{ax.emoji} {ax.label}</span>
                  <StarRating value={ratingFor(ax)} onChange={n => onRate(ax.id, ratingFor(ax), n)} />
                  <button className="axis-icon-btn" onClick={() => startEdit(ax)} title="이름 변경">✎</button>
                  <button className="axis-icon-btn" onClick={() => deleteAxis(ax)} title="삭제">🗑</button>
                </div>
              )
            ))}
          </div>
        )}

        {/* 프리셋 제안 (내 축 0~3개일 때) */}
        {visiblePresets.length > 0 && (
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>이런 기준은 어때요?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {visiblePresets.map(p => (
                <button
                  key={p.label}
                  onClick={() => createAxis(p.label, p.emoji)}
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
