/**
 * @file ScreenshotImportModal.jsx
 * OTT 스크린샷 이미지 인식 모달 — Phase 6.3 강화
 * 멀티 이미지, OTT 종류 선택, 신뢰도 표시, 실패 항목 수동 재검색
 */

import { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import InsufficientTokensModal from './InsufficientTokensModal';

const BASE = `${import.meta.env.VITE_API_URL}/api`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const TYPE_LABEL = { movie: '영화', anime: '애니메이션', drama: '드라마' };

// 지원 OTT/극장 목록
const OTT_OPTIONS = [
  { value: 'other',      label: '선택 안 함 (기타)' },
  { value: 'netflix',    label: '넷플릭스' },
  { value: 'watcha',     label: '왓챠' },
  { value: 'tving',      label: '티빙' },
  { value: 'disneyplus', label: '디즈니+' },
  { value: 'coupang',    label: '쿠팡플레이' },
  { value: 'wavve',      label: '웨이브' },
  { value: 'cgv',        label: 'CGV' },
  { value: 'megabox',    label: '메가박스' },
  { value: 'lotte',      label: '롯데시네마' },
];

/** 신뢰도에 따른 색상 */
function ConfidenceBadge({ confidence }) {
  if (confidence >= 0.7) return <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: '#e8f5e9', color: '#2e7d32' }}>✓ 높음</span>;
  if (confidence >= 0.5) return <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: '#fff8e1', color: '#f57f17' }}>△ 보통</span>;
  return <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: '#fce4ec', color: '#c62828' }}>✗ 낮음</span>;
}

/** 실패 항목 수동 재검색 인라인 컴포넌트 */
function InlineSearch({ inputTitle, onSelect }) {
  const [query, setQuery] = useState(inputTitle || '');
  const [tmdbType, setTmdbType] = useState('movie');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await axios.get(`${BASE}/import/screenshot/search`, {
        params: { q: query, type: tmdbType },
        headers: headers(),
      });
      setSearchResults(res.data.data || []);
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  return (
    <div style={{ marginTop: 8, padding: '10px 12px', background: 'rgba(0,0,0,.03)', borderRadius: 8,
      border: '1px dashed #ccc' }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>직접 검색</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          placeholder="제목 입력..."
          style={{ flex: 1, padding: '5px 8px', fontSize: 12, border: '1px solid #ddd', borderRadius: 6,
            fontFamily: 'inherit', background: 'transparent', color: 'inherit' }}
        />
        <select
          value={tmdbType}
          onChange={e => setTmdbType(e.target.value)}
          style={{ fontSize: 12, padding: '5px 6px', border: '1px solid #ddd', borderRadius: 6,
            background: 'transparent', color: 'inherit' }}
        >
          <option value="movie">영화</option>
          <option value="tv">드라마/애니</option>
        </select>
        <button onClick={doSearch} disabled={searching}
          style={{ padding: '5px 10px', fontSize: 12, border: 'none', borderRadius: 6,
            background: '#333', color: '#fff', cursor: 'pointer' }}>
          {searching ? '...' : '검색'}
        </button>
      </div>
      {searchResults && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {searchResults.length === 0 && <div style={{ fontSize: 12, color: '#999' }}>결과 없음</div>}
          {searchResults.map(r => (
            <button
              key={r.tmdb_id}
              onClick={() => onSelect(r)}
              style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 8px',
                border: '1px solid #eee', borderRadius: 6, cursor: 'pointer', background: 'var(--card-bg, #fff)',
                textAlign: 'left', width: '100%' }}
            >
              {r.poster_url && (
                <img src={r.poster_url} alt={r.title}
                  style={{ width: 44, height: 66, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
              )}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{r.title}</div>
                <div style={{ fontSize: 11, color: '#999' }}>{r.year} · {TYPE_LABEL[r.type] || r.type}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * @param {{ onClose: Function, onAdd: Function }} props
 */
export default function ScreenshotImportModal({ onClose, onAdd }) {
  const [files, setFiles] = useState([]);          // File 객체 배열
  const [previews, setPreviews] = useState([]);    // 미리보기 URL 배열
  const [ottType, setOttType] = useState('other');
  const [results, setResults] = useState(null);    // 추출+매칭 결과 배열
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState('');
  const [addedIds, setAddedIds] = useState(new Set());
  const [selected, setSelected] = useState(new Set());
  const [adding, setAdding] = useState(false);
  const [reSearchIdx, setReSearchIdx] = useState(null); // 재검색 중인 항목 index
  const [dragOver, setDragOver] = useState(false);
  const [tokenError, setTokenError] = useState(null);
  const fileInputRef = useRef(null);

  /** 파일 추가 처리 (중복 제거, 최대 10장) */
  const addFiles = useCallback((newFiles) => {
    const imageFiles = Array.from(newFiles).filter(f => f.type.startsWith('image/'));
    setFiles(prev => {
      const merged = [...prev, ...imageFiles].slice(0, 10);
      setPreviews(merged.map(f => URL.createObjectURL(f)));
      return merged;
    });
    setResults(null);
    setMessage('');
    setSelected(new Set());
  }, []);

  const handleFileInput = (e) => addFiles(e.target.files);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeFile = (idx) => {
    setFiles(prev => {
      const next = prev.filter((_, i) => i !== idx);
      setPreviews(next.map(f => URL.createObjectURL(f)));
      return next;
    });
  };

  const handleAnalyze = async () => {
    if (files.length === 0) return;
    setAnalyzing(true);
    setMessage('');
    setResults(null);

    const formData = new FormData();
    files.forEach(f => formData.append('images', f));
    formData.append('ott_type', ottType);

    try {
      const res = await axios.post(`${BASE}/import/screenshot`, formData, {
        headers: { ...headers(), 'Content-Type': 'multipart/form-data' },
      });

      const data = res.data.data || [];
      setResults(data);
      if (res.data.message) setMessage(res.data.message);

      // 내 목록에 없고 신뢰도 50% 이상인 항목 자동 선택
      const autoSelected = new Set(
        data
          .filter(r => r.result && !r.result.in_my_list && r.confidence >= 0.5)
          .map(r => r.result.tmdb_id)
      );
      setSelected(autoSelected);
    } catch (err) {
      if (err.response?.status === 402) {
        setTokenError(err.response.data);
      } else {
        setMessage(err.response?.data?.message || '이미지 분석에 실패했습니다.');
      }
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

  /** 재검색으로 결과 교체 */
  const handleReplace = (idx, newResult) => {
    setResults(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      return {
        ...item,
        confidence: 0.9,
        result: {
          tmdb_id: newResult.tmdb_id,
          title: newResult.title,
          year: newResult.year,
          type: newResult.type,
          poster_url: newResult.poster_url,
          overview: '',
          vote_average: 0,
          in_my_list: false,
        },
      };
    }));
    // 교체된 항목 자동 선택
    setSelected(prev => new Set([...prev, newResult.tmdb_id]));
    setReSearchIdx(null);
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
  const failedResults = (results || []).filter(r => !r.result);
  const selectableCount = validResults.filter(r => !r.result.in_my_list && !addedIds.has(r.result.tmdb_id)).length;
  const selectedCount = [...selected].filter(id => !addedIds.has(id)).length;

  return (
    <div className="backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="add-modal" style={{ maxWidth: 600 }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 16 }}>📸</span>
          <h2 style={{ margin: 0 }}>스크린샷으로 가져오기</h2>
        </div>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>
          OTT 시청 목록, 영화관 앱 관람 내역 스크린샷을 올리면 작품을 자동 인식합니다 (최대 10장)
        </p>

        {/* OTT 종류 선택 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: '#666', flexShrink: 0 }}>앱 종류:</span>
          <select
            value={ottType}
            onChange={e => setOttType(e.target.value)}
            style={{ flex: 1, padding: '7px 10px', fontSize: 13, border: '1px solid #ddd',
              borderRadius: 8, background: 'transparent', color: 'inherit', fontFamily: 'inherit' }}
          >
            {OTT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* 드래그 앤 드롭 업로드 영역 */}
        <div
          className="screenshot-drop-zone"
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => files.length === 0 && fileInputRef.current?.click()}
          style={{ borderColor: dragOver ? '#1565C0' : undefined, cursor: files.length === 0 ? 'pointer' : 'default' }}
        >
          {files.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#aaa' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 13 }}>클릭하거나 파일을 드래그해서 업로드 (최대 10장, 각 5MB)</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>JPG, PNG, WEBP 지원</div>
            </div>
          ) : (
            /* 썸네일 미리보기 */
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {previews.map((url, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={url} alt={`미리보기 ${i + 1}`}
                    style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                    style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18,
                      borderRadius: '50%', background: '#e53935', border: 'none', color: '#fff',
                      fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >✕</button>
                </div>
              ))}
              {/* 추가 버튼 */}
              {files.length < 10 && (
                <button
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  style={{ width: 80, height: 80, borderRadius: 6, border: '2px dashed #ccc',
                    background: 'none', cursor: 'pointer', fontSize: 24, color: '#ccc' }}>
                  +
                </button>
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
        </div>

        {/* 분석 버튼 */}
        {files.length > 0 && !results && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <span style={{ fontSize: 12, color: '#888' }}>{files.length}장 선택됨</span>
            <button className="btn btn-primary" onClick={handleAnalyze} disabled={analyzing}>
              {analyzing ? `✨ AI 분석 중 (${files.length}장)...` : `✨ 작품 인식 시작`}
            </button>
          </div>
        )}

        {/* 분석 중 진행 표시 */}
        {analyzing && (
          <div style={{ textAlign: 'center', padding: '1rem', fontSize: 13, color: '#888' }}>
            Claude가 {files.length}장의 이미지에서 작품을 찾고 있어요...
          </div>
        )}

        {/* 메시지 */}
        {message && (
          <div style={{ fontSize: 13, color: '#888', padding: '10px 14px',
            background: 'rgba(0,0,0,.03)', borderRadius: 10, marginTop: 12, border: '1px solid #eee' }}>
            {message}
          </div>
        )}

        {/* 결과 목록 */}
        {results && (
          <>
            <div style={{ fontSize: 13, color: '#666', margin: '14px 0 8px' }}>
              {validResults.length}개 인식됨
              {failedResults.length > 0 && ` · ${failedResults.length}개 미매칭`}
              {' '}— 추가할 작품을 선택하세요
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 350, overflowY: 'auto' }}>
              {results.map((item, i) => {
                const r = item.result;
                const isAdded = r && (addedIds.has(r.tmdb_id) || r.in_my_list);
                const isSelected = r && selected.has(r.tmdb_id);
                const isResearching = reSearchIdx === i;

                return (
                  <div key={i}>
                    <div
                      style={{
                        display: 'flex', gap: 10, padding: '8px 10px', alignItems: 'center',
                        border: `1px solid ${isSelected && !isAdded ? '#1565C0' : '#eee'}`,
                        borderRadius: 10, cursor: r && !isAdded ? 'pointer' : 'default',
                        opacity: isAdded ? .6 : 1,
                        background: isSelected && !isAdded ? 'rgba(21,101,192,.05)' : undefined,
                      }}
                      onClick={() => r && !isAdded && toggleSelect(r.tmdb_id)}
                    >
                      {/* 체크박스 */}
                      <div style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                        border: `1.5px solid ${isSelected && !isAdded ? '#1565C0' : '#ccc'}`,
                        background: isSelected && !isAdded ? '#1565C0' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isSelected && !isAdded && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
                      </div>

                      {/* 포스터 */}
                      <div style={{ width: 32, height: 48, borderRadius: 4, overflow: 'hidden',
                        background: '#f0f0ee', flexShrink: 0 }}>
                        {r?.poster_url && (
                          <img src={r.poster_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={r?.title} />
                        )}
                      </div>

                      {/* 정보 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {r ? (
                          <>
                            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden',
                              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                            <div style={{ fontSize: 11, color: '#999', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span>{r.year} · {TYPE_LABEL[r.type] || r.type}</span>
                              <ConfidenceBadge confidence={item.confidence} />
                            </div>
                            {item.inputTitle !== r.title && (
                              <div style={{ fontSize: 10, color: '#bbb' }}>"{item.inputTitle}" 인식</div>
                            )}
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: 12, color: '#999' }}>"{item.inputTitle}"</div>
                            <div style={{ fontSize: 11, color: '#e53935' }}>검색 결과 없음</div>
                          </>
                        )}
                      </div>

                      {/* 우측 버튼/배지 */}
                      <div style={{ flexShrink: 0, display: 'flex', gap: 4, alignItems: 'center' }}>
                        {isAdded ? (
                          <span style={{ fontSize: 11, padding: '2px 8px', background: '#e8f5e9',
                            color: '#2e7d32', borderRadius: 6 }}>
                            {r.in_my_list ? '이미 있음' : '추가됨'}
                          </span>
                        ) : (
                          /* 재검색 버튼 — 보통 이하 신뢰도 또는 매칭 실패 */
                          (item.confidence < 0.7 || !r) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setReSearchIdx(isResearching ? null : i); }}
                              style={{ fontSize: 11, padding: '3px 8px', border: '1px solid #ddd',
                                borderRadius: 6, cursor: 'pointer', background: isResearching ? '#eee' : 'none',
                                color: '#666' }}
                            >
                              {isResearching ? '닫기' : '🔍 수정'}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* 인라인 재검색 */}
                    {isResearching && (
                      <InlineSearch
                        inputTitle={item.inputTitle}
                        onSelect={(newResult) => handleReplace(i, newResult)}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {selectableCount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <span style={{ fontSize: 13, color: '#888' }}>{selectedCount}개 선택됨</span>
                <button className="btn btn-primary" onClick={handleAddSelected} disabled={selectedCount === 0 || adding}>
                  {adding ? '추가 중...' : `선택 추가 (${selectedCount})`}
                </button>
              </div>
            )}

            {/* 새 이미지 분석 버튼 */}
            <div style={{ marginTop: 10 }}>
              <button className="btn" style={{ fontSize: 12 }}
                onClick={() => { setFiles([]); setPreviews([]); setResults(null); setMessage(''); }}>
                다른 이미지 분석하기
              </button>
            </div>
          </>
        )}

        <div style={{ textAlign: 'right', marginTop: 14 }}>
          <button className="btn" onClick={onClose}>닫기</button>
        </div>
      </div>

      {tokenError && (
        <InsufficientTokensModal
          required={tokenError.required}
          balance={tokenError.balance}
          onClose={() => setTokenError(null)}
        />
      )}
    </div>
  );
}
