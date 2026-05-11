/**
 * @file WatchlistsPage.jsx
 * 공유 워치리스트 페이지 (/watchlists) — Phase 4.7
 * 친구와 함께 볼 영화 리스트 공유, 시청 여부 추적
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTheme } from '../hooks/useTheme';

const BASE = 'http://localhost:4000/api';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

export default function WatchlistsPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [watchlists, setWatchlists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);

  // 새 워치리스트 생성
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [saving, setSaving] = useState(false);

  // 초대
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  // 내 미디어 검색 (항목 추가)
  const [myMedia, setMyMedia] = useState([]);
  const [mediaQ, setMediaQ] = useState('');

  useEffect(() => {
    loadWatchlists();
    axios.get(`${BASE}/user-media`, { headers: headers() })
      .then(res => setMyMedia(res.data.data || []))
      .catch(() => {});
  }, []);

  const loadWatchlists = () => {
    setLoading(true);
    axios.get(`${BASE}/watchlists`, { headers: headers() })
      .then(res => { setWatchlists(res.data.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const openDetail = async (wl) => {
    if (selectedId === wl.id) { setSelectedId(null); setDetail(null); return; }
    setSelectedId(wl.id);
    try {
      const res = await axios.get(`${BASE}/watchlists/${wl.id}`, { headers: headers() });
      setDetail(res.data.data);
    } catch {}
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const res = await axios.post(`${BASE}/watchlists`, { title: newTitle }, { headers: headers() });
      loadWatchlists();
      setCreating(false);
      setNewTitle('');
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('워치리스트를 삭제할까요?')) return;
    await axios.delete(`${BASE}/watchlists/${id}`, { headers: headers() });
    setWatchlists(prev => prev.filter(w => w.id !== id));
    if (selectedId === id) { setSelectedId(null); setDetail(null); }
  };

  const handleLeave = async (id) => {
    if (!window.confirm('워치리스트에서 나갈까요?')) return;
    await axios.delete(`${BASE}/watchlists/${id}/leave`, { headers: headers() });
    setWatchlists(prev => prev.filter(w => w.id !== id));
    if (selectedId === id) { setSelectedId(null); setDetail(null); }
  };

  const handleInvite = async () => {
    if (!inviteUsername.trim()) return;
    setInviting(true);
    setInviteMsg('');
    try {
      await axios.post(`${BASE}/watchlists/${selectedId}/invite`, { username: inviteUsername }, { headers: headers() });
      setInviteMsg('초대 완료!');
      setInviteUsername('');
      // 멤버 목록 새로고침
      const res = await axios.get(`${BASE}/watchlists/${selectedId}`, { headers: headers() });
      setDetail(res.data.data);
    } catch (err) {
      setInviteMsg(err.response?.data?.message || '초대 실패');
    }
    setInviting(false);
  };

  const handleAddItem = async (mediaId) => {
    try {
      await axios.post(`${BASE}/watchlists/${selectedId}/items`, { media_id: mediaId }, { headers: headers() });
      const res = await axios.get(`${BASE}/watchlists/${selectedId}`, { headers: headers() });
      setDetail(res.data.data);
      setWatchlists(prev => prev.map(w => w.id === selectedId ? { ...w, item_count: res.data.data.items.length } : w));
    } catch (err) {
      if (err.response?.status === 409) alert('이미 추가된 작품입니다');
    }
  };

  const handleToggleWatched = async (itemId) => {
    const res = await axios.patch(`${BASE}/watchlists/${selectedId}/items/${itemId}/watched`, {}, { headers: headers() });
    setDetail(prev => ({ ...prev, items: prev.items.map(i => i.id === itemId ? res.data.data : i) }));
  };

  const handleRemoveItem = async (itemId) => {
    await axios.delete(`${BASE}/watchlists/${selectedId}/items/${itemId}`, { headers: headers() });
    setDetail(prev => ({ ...prev, items: prev.items.filter(i => i.id !== itemId) }));
  };

  const filteredMedia = myMedia.filter(m =>
    !mediaQ || m.title.toLowerCase().includes(mediaQ.toLowerCase())
  ).slice(0, 8);

  const existingMediaIds = new Set(detail?.items?.map(i => i.media_id) || []);

  return (
    <div className="mdb-container">
      <div className="mdb-header" style={{ marginBottom: 24 }}>
        <h1 className="mdb-title">같이 볼 영화</h1>
        <div className="mdb-controls">
          <button className="btn" onClick={toggleTheme}>{theme === 'dark' ? '라이트' : '다크'}</button>
          <button className="btn" onClick={() => navigate('/')}>← 돌아가기</button>
        </div>
      </div>

      {/* 새 워치리스트 생성 */}
      {!creating ? (
        <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => setCreating(true)}>
          + 새 워치리스트 만들기
        </button>
      ) : (
        <div className="list-create-form">
          <input
            className="settings-input"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="리스트 이름 (예: 주말에 같이 볼 영화)"
            autoFocus
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn" onClick={() => setCreating(false)}>취소</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !newTitle.trim()}>만들기</button>
          </div>
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>불러오는 중...</div>}

      {!loading && watchlists.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
          아직 워치리스트가 없습니다. 친구와 함께 볼 영화를 모아보세요!
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {watchlists.map(wl => (
          <div key={wl.id}>
            <div className={`report-card ${selectedId === wl.id ? 'active' : ''}`}>
              <div className="report-card-header" onClick={() => openDetail(wl)}>
                <div>
                  <div className="report-card-period">{wl.title}</div>
                  <div className="report-card-preview">
                    {wl.role === 'creator' ? '내가 만든 리스트' : `@${wl.creator_username}의 리스트`}
                    {' · '}{wl.item_count}편 · 멤버 {wl.member_count}명
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {wl.role === 'creator' ? (
                    <button className="btn btn-danger" style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={e => { e.stopPropagation(); handleDelete(wl.id); }}>삭제</button>
                  ) : (
                    <button className="btn" style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={e => { e.stopPropagation(); handleLeave(wl.id); }}>나가기</button>
                  )}
                  <span className="report-card-arrow">{selectedId === wl.id ? '▲' : '▼'}</span>
                </div>
              </div>
            </div>

            {/* 상세 패널 */}
            {selectedId === wl.id && detail && (
              <div className="report-content">
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {/* 항목 목록 */}
                  <div style={{ flex: 2, minWidth: 280 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                      작품 목록 ({detail.items.length})
                    </div>
                    {detail.items.length === 0 && <div style={{ color: '#aaa', fontSize: 13 }}>아직 작품이 없습니다</div>}
                    {detail.items.map(item => (
                      <div key={item.id} className="list-item-row">
                        {item.poster_url && (
                          <img src={item.poster_url} alt={item.title}
                            style={{ width: 28, height: 42, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                          <div style={{ fontSize: 10, color: '#aaa' }}>
                            추가: @{item.added_by_username}
                            {' · '}
                            <span style={{ color: item.watched_by_creator ? '#27ae60' : '#ddd' }}>creator{item.watched_by_creator ? '✓' : '○'}</span>
                            {' '}
                            <span style={{ color: item.watched_by_member ? '#27ae60' : '#ddd' }}>member{item.watched_by_member ? '✓' : '○'}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button className="btn" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => handleToggleWatched(item.id)}>
                            {(detail.my_role === 'creator' ? item.watched_by_creator : item.watched_by_member) ? '취소' : '봤어요'}
                          </button>
                          <button className="btn btn-danger" style={{ fontSize: 11, padding: '2px 6px' }} onClick={() => handleRemoveItem(item.id)}>×</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 사이드 패널 */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    {/* 멤버 목록 */}
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                      멤버 ({detail.members.length})
                    </div>
                    {detail.members.map(m => (
                      <div key={m.user_id} style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>
                        @{m.username || m.name} {m.role === 'creator' ? '👑' : ''}
                      </div>
                    ))}

                    {/* 초대 (creator만) */}
                    {detail.my_role === 'creator' && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                          친구 초대
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            className="settings-input"
                            style={{ flex: 1 }}
                            value={inviteUsername}
                            onChange={e => setInviteUsername(e.target.value)}
                            placeholder="@username"
                          />
                          <button className="btn btn-primary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={handleInvite} disabled={inviting}>초대</button>
                        </div>
                        {inviteMsg && <div style={{ fontSize: 12, color: inviteMsg.includes('완료') ? '#27ae60' : '#c0392b', marginTop: 6 }}>{inviteMsg}</div>}
                      </div>
                    )}

                    {/* 작품 추가 */}
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                        작품 추가
                      </div>
                      <input
                        className="settings-input"
                        style={{ marginBottom: 6 }}
                        value={mediaQ}
                        onChange={e => setMediaQ(e.target.value)}
                        placeholder="내 목록에서 검색..."
                      />
                      {filteredMedia.map(m => (
                        <div
                          key={m.id}
                          style={{ fontSize: 13, padding: '4px 6px', borderRadius: 6, cursor: existingMediaIds.has(m.id) ? 'default' : 'pointer', opacity: existingMediaIds.has(m.id) ? .5 : 1, display: 'flex', justifyContent: 'space-between' }}
                          onClick={() => !existingMediaIds.has(m.id) && handleAddItem(m.id)}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{m.title}</span>
                          <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>{existingMediaIds.has(m.id) ? '추가됨' : '+'}</span>
                        </div>
                      ))}
                    </div>
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
