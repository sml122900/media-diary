/**
 * @file ComparePage.jsx
 * 공통 작품 비교 페이지 (/compare/:userId) — Phase 4.5
 * 두 사용자 모두 본 작품의 별점 차이 시각화
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTheme } from '../hooks/useTheme';

const BASE = `${import.meta.env.VITE_API_URL}/api`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

export default function ComparePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${BASE}/compare/${userId}`, { headers: headers() })
      .then(res => { setData(res.data.data); setLoading(false); })
      .catch(err => {
        setError(err.response?.data?.message || '비교 데이터를 불러오지 못했습니다');
        setLoading(false);
      });
  }, [userId]);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#888' }}>불러오는 중...</div>;

  if (error) return (
    <div className="mdb-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
      <div style={{ color: '#c0392b', marginBottom: 16 }}>{error}</div>
      <button className="btn" onClick={() => navigate(-1)}>돌아가기</button>
    </div>
  );

  const { target, items } = data;
  const iLikedMore = items.filter(i => i.my_rating > i.their_rating);
  const theyLikedMore = items.filter(i => i.their_rating > i.my_rating);
  const agreed = items.filter(i => i.my_rating === i.their_rating);

  return (
    <div className="mdb-container">
      <div className="mdb-header" style={{ marginBottom: 24 }}>
        <h1 className="mdb-title">취향 비교</h1>
        <div className="mdb-controls">
          <button className="btn" onClick={() => navigate(-1)}>← 돌아가기</button>
        </div>
      </div>

      {/* 비교 대상 정보 */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', background: '#f8f8f6', borderRadius: 14, padding: '16px 20px', marginBottom: 24, border: '1px solid #eee' }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>나</div>
        </div>
        <div style={{ fontSize: 14, color: '#888' }}>vs</div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          {target.avatar_url && <img src={target.avatar_url} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', marginBottom: 4 }} alt={target.name} />}
          <div style={{ fontSize: 15, fontWeight: 700 }}>@{target.username || target.name}</div>
        </div>
      </div>

      {/* 요약 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: '공통 작품', value: items.length },
          { label: '내가 더 좋아한', value: iLikedMore.length },
          { label: '친구가 더 좋아한', value: theyLikedMore.length },
        ].map(({ label, value }) => (
          <div key={label} className="profile-stat-card">
            <div className="profile-stat-value">{value}</div>
            <div className="profile-stat-label">{label}</div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
          아직 공통으로 본 작품이 없습니다
        </div>
      )}

      {/* 비교 목록 (별점 차이 큰 순) */}
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item, i) => (
            <div key={i} className="compare-row">
              {item.poster_url && (
                <img src={item.poster_url} alt={item.title}
                  style={{ width: 36, height: 54, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                <div style={{ fontSize: 11, color: '#999' }}>{item.year}</div>
              </div>
              {/* 별점 막대 비교 */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, color: item.my_rating > item.their_rating ? '#27ae60' : '#1a1a1a', fontWeight: 600 }}>
                    {'★'.repeat(item.my_rating)}
                  </div>
                  <div style={{ fontSize: 10, color: '#aaa' }}>나</div>
                </div>
                <div style={{ fontSize: 12, color: '#bbb' }}>vs</div>
                <div>
                  <div style={{ fontSize: 13, color: item.their_rating > item.my_rating ? '#27ae60' : '#1a1a1a', fontWeight: 600 }}>
                    {'★'.repeat(item.their_rating)}
                  </div>
                  <div style={{ fontSize: 10, color: '#aaa' }}>친구</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
