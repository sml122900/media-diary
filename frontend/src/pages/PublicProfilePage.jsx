/**
 * @file PublicProfilePage.jsx
 * 공개 프로필 페이지 (/u/:username)
 * 비로그인 접근 가능, is_profile_public=true일 때 통계 표시
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const BASE = 'http://localhost:4000/api';

export default function PublicProfilePage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    axios.get(`${BASE}/profile/${username}`)
      .then(res => { setProfile(res.data.data); setLoading(false); })
      .catch(err => {
        if (err.response?.status === 404) setNotFound(true);
        setLoading(false);
      });
  }, [username]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#888' }}>
      불러오는 중...
    </div>
  );

  if (notFound) return (
    <div className="mdb-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🤷</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>
        @{username} 를 찾을 수 없습니다
      </div>
      <button className="btn btn-primary" onClick={() => navigate('/')} style={{ marginTop: 16 }}>홈으로</button>
    </div>
  );

  const { stats } = profile;

  return (
    <div className="mdb-container" style={{ maxWidth: 640 }}>
      {/* 상단 네비 */}
      <div style={{ marginBottom: 24 }}>
        <Link to="/" className="btn" style={{ fontSize: 13 }}>← 홈으로</Link>
      </div>

      {/* 프로필 카드 */}
      <div className="profile-card">
        {/* 아바타 */}
        <div className="profile-avatar">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.name} onError={e => { e.target.style.display = 'none'; }} />
          ) : (
            <span style={{ fontSize: 36 }}>👤</span>
          )}
        </div>

        {/* 기본 정보 */}
        <div className="profile-info">
          <div className="profile-name">{profile.name}</div>
          <div className="profile-username">@{profile.username}</div>
          {profile.bio && <div className="profile-bio">{profile.bio}</div>}
          <div className="profile-joined">
            {new Date(profile.joined_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })} 가입
          </div>
        </div>
      </div>

      {/* 비공개 프로필 안내 */}
      {!profile.is_profile_public && (
        <div style={{
          textAlign: 'center', padding: '3rem', color: '#aaa',
          background: '#f8f8f6', borderRadius: 16, border: '1px solid #eee',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
          이 프로필은 비공개입니다
        </div>
      )}

      {/* 공개 프로필 통계 */}
      {profile.is_profile_public && stats && (
        <>
          <div className="profile-stats-grid">
            <div className="profile-stat-card">
              <div className="profile-stat-value">{stats.total_count}</div>
              <div className="profile-stat-label">전체 작품</div>
            </div>
            <div className="profile-stat-card">
              <div className="profile-stat-value">{stats.reviewed_count}</div>
              <div className="profile-stat-label">감상 기록</div>
            </div>
            <div className="profile-stat-card">
              <div className="profile-stat-value">{stats.avg_rating ?? '-'}</div>
              <div className="profile-stat-label">평균 별점</div>
            </div>
          </div>

          {/* 선호 장르 */}
          {stats.top_genres?.length > 0 && (
            <div className="profile-genres">
              <div className="profile-genres-label">선호 장르</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {stats.top_genres.map(g => (
                  <span key={g} className="profile-genre-tag">{g}</span>
                ))}
              </div>
            </div>
          )}

          {/* 공개 작품 목록은 Phase 4.2(is_public 구현) 이후 표시 */}
          <div style={{ textAlign: 'center', padding: '2rem', color: '#bbb', fontSize: 13 }}>
            공개된 리뷰 목록은 추후 지원 예정입니다
          </div>
        </>
      )}
    </div>
  );
}
