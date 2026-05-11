/**
 * @file ListsPage.jsx
 * 베스트 리스트 관리 페이지 (/lists)
 * 리스트 생성/조회/편집/삭제 + 작품 추가/제거/코멘트/순서 변경
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTheme } from '../hooks/useTheme';

const BASE = 'http://localhost:4000/api';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

export default function ListsPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedList, setSelectedList] = useState(null); // 현재 편집 중인 리스트
  const [listDetail, setListDetail] = useState(null);     // 항목 포함 상세

  // 새 리스트 생성 폼
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPublic, setNewPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  // 내 미디어 검색 (항목 추가용)
  const [myMedia, setMyMedia] = useState([]);
  const [mediaSearch, setMediaSearch] = useState('');

  useEffect(() => {
    loadLists();
    // 내 미디어 목록 (항목 추가 검색용)
    axios.get(`${BASE}/user-media`, { headers: headers() })
      .then(res => setMyMedia(res.data.data || []))
      .catch(() => {});
  }, []);

  const loadLists = () => {
    setLoading(true);
    axios.get(`${BASE}/lists`, { headers: headers() })
      .then(res => { setLists(res.data.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const openList = async (list) => {
    if (selectedList?.id === list.id) { setSelectedList(null); setListDetail(null); return; }
    setSelectedList(list);
    try {
      const res = await axios.get(`${BASE}/lists/${list.id}`, { headers: headers() });
      setListDetail(res.data.data);
    } catch { setListDetail({ ...list, items: [] }); }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const res = await axios.post(`${BASE}/lists`, { title: newTitle, description: newDesc, is_public: newPublic }, { headers: headers() });
      setLists(prev => [{ ...res.data.data, item_count: 0 }, ...prev]);
      setCreating(false);
      setNewTitle(''); setNewDesc(''); setNewPublic(false);
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (listId) => {
    if (!window.confirm('리스트를 삭제할까요?')) return;
    await axios.delete(`${BASE}/lists/${listId}`, { headers: headers() });
    setLists(prev => prev.filter(l => l.id !== listId));
    if (selectedList?.id === listId) { setSelectedList(null); setListDetail(null); }
  };

  const handleTogglePublic = async (list) => {
    const updated = await axios.patch(`${BASE}/lists/${list.id}`, { is_public: !list.is_public }, { headers: headers() });
    setLists(prev => prev.map(l => l.id === list.id ? { ...l, is_public: !l.is_public } : l));
  };

  const handleAddItem = async (mediaId) => {
    if (!selectedList) return;
    try {
      await axios.post(`${BASE}/lists/${selectedList.id}/items`, { media_id: mediaId }, { headers: headers() });
      const res = await axios.get(`${BASE}/lists/${selectedList.id}`, { headers: headers() });
      setListDetail(res.data.data);
      setLists(prev => prev.map(l => l.id === selectedList.id ? { ...l, item_count: res.data.data.items.length } : l));
    } catch (err) {
      if (err.response?.status === 409) alert('이미 리스트에 있는 작품입니다');
    }
  };

  const handleRemoveItem = async (itemId) => {
    await axios.delete(`${BASE}/lists/${selectedList.id}/items/${itemId}`, { headers: headers() });
    setListDetail(prev => ({ ...prev, items: prev.items.filter(i => i.id !== itemId) }));
    setLists(prev => prev.map(l => l.id === selectedList.id ? { ...l, item_count: l.item_count - 1 } : l));
  };

  const handleMoveItem = async (item, dir) => {
    const items = listDetail.items;
    const idx = items.indexOf(item);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const swap = items[swapIdx];
    // 포지션 교환
    await Promise.all([
      axios.patch(`${BASE}/lists/${selectedList.id}/items/${item.id}`, { position: swap.position }, { headers: headers() }),
      axios.patch(`${BASE}/lists/${selectedList.id}/items/${swap.id}`, { position: item.position }, { headers: headers() }),
    ]);
    const newItems = [...items];
    newItems[idx] = { ...swap, position: item.position };
    newItems[swapIdx] = { ...item, position: swap.position };
    newItems.sort((a, b) => a.position - b.position);
    setListDetail(prev => ({ ...prev, items: newItems }));
  };

  // 검색 필터
  const filteredMedia = myMedia.filter(m =>
    !mediaSearch || m.title.toLowerCase().includes(mediaSearch.toLowerCase())
  ).slice(0, 10);

  const existingMediaIds = new Set(listDetail?.items?.map(i => i.media_id) || []);

  return (
    <div className="mdb-container">
      <div className="mdb-header" style={{ marginBottom: 24 }}>
        <h1 className="mdb-title">내 리스트</h1>
        <div className="mdb-controls">
          <button className="btn" onClick={toggleTheme}>{theme === 'dark' ? '라이트' : '다크'}</button>
          <button className="btn" onClick={() => navigate('/')}>← 돌아가기</button>
        </div>
      </div>

      {/* 새 리스트 생성 */}
      {!creating ? (
        <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => setCreating(true)}>
          + 새 리스트 만들기
        </button>
      ) : (
        <div className="list-create-form">
          <input
            className="settings-input"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="리스트 제목 (예: 내 인생 영화 10편)"
            autoFocus
          />
          <input
            className="settings-input"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="설명 (선택)"
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              className={`settings-toggle ${newPublic ? 'on' : ''}`}
              style={{ width: 36, height: 20 }}
              onClick={() => setNewPublic(v => !v)}
            >
              <div className="settings-toggle-knob" style={{ width: 14, height: 14, top: 3, left: newPublic ? 19 : 3 }} />
            </div>
            <span style={{ fontSize: 12, color: '#888' }}>{newPublic ? '공개' : '비공개'}</span>
            <div style={{ flex: 1 }} />
            <button className="btn" onClick={() => setCreating(false)}>취소</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !newTitle.trim()}>만들기</button>
          </div>
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>불러오는 중...</div>}

      {!loading && lists.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
          아직 리스트가 없습니다. 첫 리스트를 만들어보세요!
        </div>
      )}

      {/* 리스트 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lists.map(list => (
          <div key={list.id}>
            <div
              className={`report-card ${selectedList?.id === list.id ? 'active' : ''}`}
              style={{ cursor: 'pointer' }}
            >
              <div className="report-card-header" onClick={() => openList(list)}>
                <div>
                  <div className="report-card-period" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {list.title}
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: list.is_public ? '#e8f5e9' : '#f0f0ee', color: list.is_public ? '#2e7d32' : '#888' }}>
                      {list.is_public ? '공개' : '비공개'}
                    </span>
                  </div>
                  {list.description && <div className="report-card-preview">{list.description}</div>}
                  <div className="report-card-date">{list.item_count}편</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    className="btn"
                    style={{ fontSize: 11, padding: '3px 8px' }}
                    onClick={e => { e.stopPropagation(); handleTogglePublic(list); }}
                  >
                    {list.is_public ? '비공개로' : '공개로'}
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ fontSize: 11, padding: '3px 8px' }}
                    onClick={e => { e.stopPropagation(); handleDelete(list.id); }}
                  >
                    삭제
                  </button>
                  <span className="report-card-arrow">{selectedList?.id === list.id ? '▲' : '▼'}</span>
                </div>
              </div>
            </div>

            {/* 리스트 편집 패널 */}
            {selectedList?.id === list.id && listDetail && (
              <div className="report-content">
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {/* 현재 항목 */}
                  <div style={{ flex: 2, minWidth: 280 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                      목록 ({listDetail.items.length}편)
                    </div>
                    {listDetail.items.length === 0 && (
                      <div style={{ color: '#aaa', fontSize: 13 }}>아직 작품이 없습니다</div>
                    )}
                    {listDetail.items.map((item, idx) => (
                      <div key={item.id} className="list-item-row">
                        <span className="list-item-pos">{item.position}</span>
                        {item.poster_url && (
                          <img src={item.poster_url} alt={item.title}
                            style={{ width: 28, height: 42, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                          <div style={{ fontSize: 11, color: '#999' }}>{item.year}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button className="btn" style={{ fontSize: 11, padding: '2px 6px' }} onClick={() => handleMoveItem(item, -1)} disabled={idx === 0}>↑</button>
                          <button className="btn" style={{ fontSize: 11, padding: '2px 6px' }} onClick={() => handleMoveItem(item, 1)} disabled={idx === listDetail.items.length - 1}>↓</button>
                          <button className="btn btn-danger" style={{ fontSize: 11, padding: '2px 6px' }} onClick={() => handleRemoveItem(item.id)}>×</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 작품 추가 */}
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                      작품 추가
                    </div>
                    <input
                      className="settings-input"
                      value={mediaSearch}
                      onChange={e => setMediaSearch(e.target.value)}
                      placeholder="내 목록에서 검색..."
                      style={{ marginBottom: 8 }}
                    />
                    {filteredMedia.map(m => (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex', gap: 8, alignItems: 'center',
                          padding: '6px 8px', borderRadius: 8,
                          cursor: existingMediaIds.has(m.id) ? 'default' : 'pointer',
                          opacity: existingMediaIds.has(m.id) ? .5 : 1,
                          background: existingMediaIds.has(m.id) ? 'transparent' : undefined,
                        }}
                        onClick={() => !existingMediaIds.has(m.id) && handleAddItem(m.id)}
                      >
                        <div style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                        <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>{m.year}</span>
                        {existingMediaIds.has(m.id) && <span style={{ fontSize: 10, color: '#aaa' }}>추가됨</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
