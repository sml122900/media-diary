/**
 * @file ScreenshotImportModal.jsx
 * OTT 스크린샷 이미지 인식 모달 (Phase 3.6)
 * 이미지 업로드 → Claude Vision으로 작품명 추출 → 체크박스 선택 → 일괄 추가
 */

import { useState, useRef } from 'react';
import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL}/api`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const TYPE_LABEL = { movie: '영화', anime: '애니메이션', drama: '드라마' };

/**
 * @param {{ onClose: Function, onAdd: Function }} props
 */
export default function ScreenshotImportModal({ onClose, onAdd }) {
  const [preview, setPreview] = useState(null);     // 이미지 미리보기 URL
  const [file, setFile] = useState(null);
  const [results, setResults] = useState(null);     // 추출 결과 배열
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState('');
  const [addedIds, setAddedIds] = useState(new Set());
  const [selected, setSelected] = useState(new Set()); // 선택된 tmdb_id
  const [adding, setAdding] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResults(null);
    setMessage('');
    setSelected(new Set());
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setMessage('');
    setResults(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await axios.post(`${BASE}/import/screenshot`, formData, {
        headers: { ...headers(), 'Content-Type': 'multipart/form-data' },
      });

      const data = res.data.data || [];
      setResults(data);
      if (res.data.message) setMessage(res.data.message);

      // 내 목록에 없는 항목 자동 선택
      const autoSelected = new Set(
        data
          .filter(r => r.result && !r.result.in_my_list)
          .map(r => r.result.tmdb_id)
      );
      setSelected(autoSelected);
    } catch (err) {
      setMessage(err.response?.data?.message || '이미지 분석에 실패했습니다');
    }
    setAnalyzing(false);
  };

  const toggleSelect = (tmdbId) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(tmdbId) ? next.delete(tmdbId) : next.add(tmdbId);
      return next;
    });
  };

  const handleAddSelected = async () => {
    if (!results) return;
    setAdding(true);
    for (const item of results) {
      const r = item.result;
      if (!r || !selected.has(r.tmdb_id) || r.in_my_list || addedIds.has(r.tmdb_id)) continue;
      const saved = await onAdd({
        type: r.type,
        title: r.title,
        year: r.year,
        director: '',
        cast_info: '',
        poster_url: r.poster_url,
        tmdb_id: r.tmdb_id,
      });
      if (saved) setAddedIds(prev => new Set([...prev, r.tmdb_id]));
    }
    setAdding(false);
  };

  const validResults = (results || []).filter(r => r.result);
  const selectableCount = validResults.filter(r => !r.result.in_my_list && !addedIds.has(r.result.tmdb_id)).length;
  const selectedCount = [...selected].filter(id => !addedIds.has(id)).length;

  return (
    <div className="backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="add-modal" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 16 }}>📸</span>
          <h2 style={{ margin: 0 }}>스크린샷으로 가져오기</h2>
        </div>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>
          OTT 앱 화면, 시청 목록, 작품 썸네일 등의 스크린샷을 업로드하면 작품을 자동 인식합니다
        </p>

        {/* 파일 선택 영역 */}
        <div
          className="screenshot-drop-zone"
          onClick={() => fileInputRef.current?.click()}
        >
          {preview ? (
            <img src={preview} alt="미리보기" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'contain' }} />
          ) : (
            <div style={{ textAlign: 'center', color: '#aaa' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 13 }}>클릭해서 이미지 선택 (최대 5MB)</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>JPG, PNG, WEBP 지원</div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        {/* 분석 버튼 */}
        {file && !results && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              className="btn btn-primary"
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing ? '✨ AI 분석 중...' : '✨ 작품 인식 시작'}
            </button>
          </div>
        )}

        {/* 분석 중 */}
        {analyzing && (
          <div style={{ textAlign: 'center', padding: '1.5rem', fontSize: 13, color: '#888' }}>
            Claude가 이미지에서 작품을 찾고 있어요...
          </div>
        )}

        {/* 메시지 */}
        {message && (
          <div style={{
            fontSize: 13, color: '#888', padding: '10px 14px',
            background: '#f8f8f6', borderRadius: 10, marginTop: 12, border: '1px solid #eee',
          }}>
            {message}
          </div>
        )}

        {/* 결과 목록 */}
        {results && results.length > 0 && (
          <>
            <div style={{ fontSize: 13, color: '#666', margin: '14px 0 8px' }}>
              {validResults.length}개 작품 인식됨 — 추가할 작품을 선택하세요
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
              {results.map((item, i) => {
                if (!item.result) return (
                  <div key={i} style={{
                    display: 'flex', gap: 10, padding: '8px 10px',
                    border: '1px solid #eee', borderRadius: 10, opacity: .5, alignItems: 'center',
                  }}>
                    <div style={{ width: 32, height: 48, background: '#f0f0ee', borderRadius: 4, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, color: '#999' }}>"{item.inputTitle}"</div>
                      <div style={{ fontSize: 11, color: '#bbb' }}>검색 결과 없음</div>
                    </div>
                  </div>
                );
                const r = item.result;
                const isAdded = addedIds.has(r.tmdb_id) || r.in_my_list;
                const isSelected = selected.has(r.tmdb_id);
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex', gap: 10, padding: '8px 10px', alignItems: 'center',
                      border: `1px solid ${isSelected && !isAdded ? '#1a1a1a' : '#eee'}`,
                      borderRadius: 10, cursor: isAdded ? 'default' : 'pointer',
                      opacity: isAdded ? .6 : 1,
                    }}
                    onClick={() => !isAdded && toggleSelect(r.tmdb_id)}
                  >
                    {/* 체크박스 */}
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                      border: `1.5px solid ${isSelected && !isAdded ? '#1a1a1a' : '#ccc'}`,
                      background: isSelected && !isAdded ? '#1a1a1a' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isSelected && !isAdded && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
                    </div>

                    {/* 포스터 */}
                    <div style={{ width: 32, height: 48, borderRadius: 4, overflow: 'hidden', background: '#f0f0ee', flexShrink: 0 }}>
                      {r.poster_url && <img src={r.poster_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={r.title} />}
                    </div>

                    {/* 정보 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: '#999' }}>
                        {r.year} · {TYPE_LABEL[r.type] || r.type}
                        {r.vote_average > 0 ? ` · ★${r.vote_average.toFixed(1)}` : ''}
                      </div>
                      {item.inputTitle !== r.title && (
                        <div style={{ fontSize: 10, color: '#bbb' }}>"{item.inputTitle}" 인식</div>
                      )}
                    </div>

                    {/* 상태 배지 */}
                    {isAdded && (
                      <span style={{ fontSize: 11, padding: '2px 8px', background: '#e8f5e9', color: '#2e7d32', borderRadius: 6, flexShrink: 0 }}>
                        {r.in_my_list ? '이미 있음' : '추가됨'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {selectableCount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <span style={{ fontSize: 13, color: '#888' }}>{selectedCount}개 선택됨</span>
                <button
                  className="btn btn-primary"
                  onClick={handleAddSelected}
                  disabled={selectedCount === 0 || adding}
                >
                  {adding ? '추가 중...' : `선택 추가 (${selectedCount})`}
                </button>
              </div>
            )}
          </>
        )}

        <div style={{ textAlign: 'right', marginTop: 14 }}>
          <button className="btn" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
