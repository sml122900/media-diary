/**
 * @file CsvImportModal.jsx
 * CSV 가져오기 모달 — 파일 업로드 → 미리보기 → 일괄 추가
 * CSV 형식: title,year,type,director,cast_info,rating,review_text,review_date
 */

import { useState } from 'react';
import { saveMediaItem } from '../api/userMedia';

/**
 * @param {{ onClose: Function, onAdd: Function, existingItems: Array }} props
 */
export default function CsvImportModal({ onClose, onAdd, existingItems }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [adding, setAdding] = useState(false);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState(false);
  // 중복 처리 방식: 'skip' | 'overwrite'
  const [dupMode, setDupMode] = useState('skip');

  const parseCsv = (text) => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    // 헤더 파싱
    const headers = splitCsvLine(lines[0]);
    return lines.slice(1).map(line => {
      const vals = splitCsvLine(line);
      const row = {};
      headers.forEach((h, i) => { row[h.trim()] = (vals[i] || '').trim(); });
      return row;
    }).filter(r => r.title);
  };

  // 간단한 CSV 한 줄 파싱 (큰따옴표 처리 포함)
  const splitCsvLine = (line) => {
    const result = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        result.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur);
    return result;
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCsv(ev.target.result);
      setRows(parsed.map(r => ({
        ...r,
        year: parseInt(r.year) || 0,
        rating: parseInt(r.rating) || 0,
        type: ['movie', 'anime', 'drama'].includes(r.type) ? r.type : 'movie',
        selected: true,
        isDuplicate: existingItems.some(i => i.title === r.title && String(i.year) === String(r.year)),
      })));
      setDone(false);
    };
    reader.readAsText(file, 'utf-8');
  };

  const toggleRow = (i) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r));
  };

  const selectedRows = rows.filter(r => r.selected);
  const dupRows = rows.filter(r => r.isDuplicate);
  const newRows = rows.filter(r => !r.isDuplicate);

  const handleImport = async () => {
    setAdding(true);
    const toAdd = selectedRows;
    for (let i = 0; i < toAdd.length; i++) {
      const r = toAdd[i];
      setProgress(`${i + 1} / ${toAdd.length} 추가 중...`);
      if (r.isDuplicate && dupMode === 'skip') continue;
      const itemData = {
        type: r.type, title: r.title, year: r.year,
        director: r.director || '', cast_info: r.cast_info || '',
        poster_url: '', tmdb_id: 0,
        rating: r.rating, review_text: r.review_text || '', review_date: r.review_date || '',
      };
      // 중복+덮어쓰기는 API를 직접 호출해 upsert (handleAdd는 중복 시 alert)
      if (r.isDuplicate && dupMode === 'overwrite') {
        await saveMediaItem(itemData);
      } else {
        await onAdd(itemData);
      }
    }
    setAdding(false);
    setProgress('');
    setDone(true);
  };

  const TYPE_LABEL = { movie: '영화', anime: '애니메이션', drama: '드라마' };

  return (
    <div className="backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="add-modal" style={{ maxWidth: 600 }}>
        <h2>CSV 가져오기</h2>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
          CSV 형식: <code>title, year, type, director, cast_info, rating, review_text, review_date</code>
        </p>

        <label style={{ display: 'inline-block', padding: '7px 14px', background: '#1a1a1a', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>
          파일 선택
          <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFile} />
        </label>
        {fileName && <span style={{ fontSize: 13, color: '#888', marginLeft: 10 }}>{fileName}</span>}

        {rows.length > 0 && !done && (
          <>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
              총 {rows.length}개 | 신규 {newRows.length}개 | 중복 {dupRows.length}개
            </div>

            {dupRows.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#888' }}>중복 항목:</span>
                {[['skip', '건너뛰기'], ['overwrite', '덮어쓰기']].map(([v, label]) => (
                  <button
                    key={v}
                    className={`btn ${dupMode === v ? 'btn-primary' : ''}`}
                    style={{ fontSize: 12, padding: '3px 10px' }}
                    onClick={() => setDupMode(v)}
                  >{label}</button>
                ))}
              </div>
            )}

            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              {rows.map((r, i) => (
                <div
                  key={i}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: `1px solid ${r.selected ? '#1a1a1a' : '#eee'}`, borderRadius: 8, cursor: 'pointer', opacity: r.isDuplicate && dupMode === 'skip' ? .5 : 1 }}
                  onClick={() => toggleRow(i)}
                >
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${r.selected ? '#1a1a1a' : '#ccc'}`, background: r.selected ? '#1a1a1a' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {r.selected && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: '#999' }}>{r.year} · {TYPE_LABEL[r.type] || r.type}{r.rating > 0 ? ` · ★${r.rating}` : ''}</div>
                  </div>
                  {r.isDuplicate && <span style={{ fontSize: 11, padding: '2px 6px', background: '#fff3cd', color: '#856404', borderRadius: 4, flexShrink: 0 }}>중복</span>}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#888' }}>{selectedRows.length}개 선택됨</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={onClose}>취소</button>
                <button className="btn btn-primary" onClick={handleImport} disabled={adding || selectedRows.length === 0}>
                  {adding ? progress : `가져오기 (${selectedRows.length})`}
                </button>
              </div>
            </div>
          </>
        )}

        {done && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 15, marginBottom: 16 }}>가져오기 완료!</div>
            <button className="btn btn-primary" onClick={onClose}>닫기</button>
          </div>
        )}

        {rows.length === 0 && (
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <button className="btn" onClick={onClose}>닫기</button>
          </div>
        )}
      </div>
    </div>
  );
}
