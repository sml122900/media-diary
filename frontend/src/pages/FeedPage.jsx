/**
 * @file FeedPage.jsx
 * 활동 피드 페이지 (/feed)
 * 팔로잉한 사용자들의 최근 감상 기록 + 사용자 검색 + 팔로우 관리
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useTheme } from '../hooks/useTheme';

const BASE = `${import.meta.env.VITE_API_URL}/api`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const TYPE_LABEL = { movie: '영화', anime: '애니메이션', drama: '드라마' };

export default function FeedPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [tab, setTab] = useState('feed'); // 'feed' | 'search' | 'following'
  const [feed, setFeed] = useState([]);
  const [feedPage, setFeedPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [feedLoading, setFeedLoading] = useState(true);

  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [following, setFollowing] = useState([]);

  // 피드 로드
  const loadFeed = useCallback(async (page = 1) => {
    setFeedLoading(true);
    try {
      const res = await axios.get(`${BASE}/feed?page=${page}`, { headers: headers() });
      const data = res.data.data || [];
      setFeed(prev => page === 1 ? data : [...prev, ...data]);
      setHasMore(res.data.has_more);
      setFeedPage(page);
    } catch {}
    setFeedLoading(false);
  }, []);

  // 팔로잉 목록 로드
  const loadFollowing = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE}/me/following`, { headers: headers() });
      setFollowing(res.data.data || []);
    } catch {}
  }, []);

  useEffect(() => { loadFeed(1); loadFollowing(); }, []);

  // 사용자 검색 (400ms 디바운스)
  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await axios.get(`${BASE}/search/users?q=${encodeURIComponent(searchQ)}`, { headers: headers() });
        setSearchResults(res.data.data || []);
      } catch {}
      setSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [searchQ]);

  const handleFollow = async (userId) => {
    await axios.post(`${BASE}/follow/${userId}`, {}, { headers: headers() });
    setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, is_following: true } : u));
    loadFollowing();
  };

  const handleUnfollow = async (userId) => {
    await axios.delete(`${BASE}/follow/${userId}`, { headers: headers() });
    setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, is_following: false } : u));
    setFollowing(prev => prev.filter(u => u.id !== userId));
  };

  return (
    <div className="mdb-container">
      <div className="mdb-header" style={{ marginBottom: 20 }}>
        <h1 className="mdb-title">친구 활동</h1>
        <div className="mdb-controls">
          <button className="btn" onClick={() => navigate('/')}>← 돌아가기</button>
        </div>
      </div>

      {/* 탭 */}
      <div className="tab-bar" style={{ marginBottom: 16 }}>
        {[['feed', '피드'], ['search', '사용자 검색'], ['following', `팔로잉 (${following.length})`]].map(([key, label]) => (
          <button key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {/* 피드 탭 */}
      {tab === 'feed' && (
        <div>
          {feedLoading && feed.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>불러오는 중...</div>
          )}
          {!feedLoading && feed.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
              아직 친구 활동이 없습니다.<br />
              "사용자 검색" 탭에서 친구를 찾아 팔로우해보세요!
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {feed.map((item, i) => (
              <div key={i} className="feed-item">
                {/* 유저 정보 */}
                <div className="feed-item-user">
                  {item.avatar_url ? (
                    <img src={item.avatar_url} alt={item.name} className="feed-avatar" />
                  ) : (
                    <div className="feed-avatar-ph">👤</div>
                  )}
                  <div>
                    <Link to={`/u/${item.username}`} className="feed-username">{item.username || item.name}</Link>
                    <div className="feed-time">
                      {new Date(item.watched_at).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                </div>

                {/* 작품 정보 */}
                <div className="feed-item-content">
                  {item.poster_url && (
                    <img src={item.poster_url} alt={item.title}
                      style={{ width: 44, height: 66, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>{item.year} · {TYPE_LABEL[item.type] || item.type}</div>
                    {item.rating > 0 && (
                      <div style={{ fontSize: 14, color: '#f0a500', marginTop: 2 }}>{'★'.repeat(item.rating)}</div>
                    )}
                    {item.review_text && (
                      <div style={{ fontSize: 13, color: '#555', marginTop: 4, lineHeight: 1.5 }}>
                        {item.review_text.slice(0, 100)}{item.review_text.length > 100 ? '...' : ''}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button className="btn" onClick={() => loadFeed(feedPage + 1)} disabled={feedLoading}>
                {feedLoading ? '불러오는 중...' : '더 보기'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 사용자 검색 탭 */}
      {tab === 'search' && (
        <div>
          <input
            className="search-input"
            style={{ width: '100%', marginBottom: 14 }}
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="username 또는 이름으로 검색..."
            autoFocus
          />
          {searching && <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: 16 }}>검색 중...</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {searchResults.map(u => (
              <div key={u.id} className="user-search-row">
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt={u.name} className="feed-avatar" />
                ) : (
                  <div className="feed-avatar-ph">👤</div>
                )}
                <div style={{ flex: 1 }}>
                  <Link to={`/u/${u.username}`} style={{ fontWeight: 600, fontSize: 14 }}>
                    {u.username || u.name}
                  </Link>
                  <div style={{ fontSize: 12, color: '#888' }}>{u.name}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {u.is_following ? (
                    <>
                      <button className="btn" style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => navigate(`/compare/${u.id}`)}>비교하기</button>
                      <button className="btn btn-danger" style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => handleUnfollow(u.id)}>언팔로우</button>
                    </>
                  ) : (
                    <button className="btn btn-primary" style={{ fontSize: 12, padding: '4px 10px' }}
                      onClick={() => handleFollow(u.id)}>팔로우</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 팔로잉 탭 */}
      {tab === 'following' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {following.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>팔로잉 중인 사용자가 없습니다</div>
          )}
          {following.map(u => (
            <div key={u.id} className="user-search-row">
              {u.avatar_url ? (
                <img src={u.avatar_url} alt={u.name} className="feed-avatar" />
              ) : (
                <div className="feed-avatar-ph">👤</div>
              )}
              <div style={{ flex: 1 }}>
                <Link to={`/u/${u.username}`} style={{ fontWeight: 600, fontSize: 14 }}>
                  {u.username || u.name}
                </Link>
                <div style={{ fontSize: 12, color: '#888' }}>{u.name}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn" style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => navigate(`/compare/${u.id}`)}>비교하기</button>
                <button className="btn btn-danger" style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => handleUnfollow(u.id)}>언팔로우</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
