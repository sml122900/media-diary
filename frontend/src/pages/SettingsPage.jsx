/**
 * @file SettingsPage.jsx
 * 프로필 설정 페이지 (/settings)
 * username, bio, avatar_url 수정 + 프로필 공개/비공개 토글
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import useAuthStore from '../store/authStore';
import { useTheme } from '../hooks/useTheme';

const BASE = 'http://localhost:4000/api';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useTheme();

  const [form, setForm] = useState({
    username: '',
    bio: '',
    avatar_url: '',
    is_profile_public: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // 현재 프로필 불러오기
  useEffect(() => {
    axios.get(`${BASE}/me/info`, { headers: headers() })
      .then(res => {
        const d = res.data.data;
        setForm({
          username: d.username || '',
          bio: d.bio || '',
          avatar_url: d.avatar_url || '',
          is_profile_public: d.is_profile_public || false,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await axios.patch(`${BASE}/me/profile`, form, { headers: headers() });
      setMessage('저장됐습니다!');
    } catch (err) {
      setError(err.response?.data?.message || '저장에 실패했습니다');
    }
    setSaving(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#888' }}>
      불러오는 중...
    </div>
  );

  return (
    <div className="mdb-container" style={{ maxWidth: 560 }}>
      {/* 헤더 */}
      <div className="mdb-header" style={{ marginBottom: 24 }}>
        <h1 className="mdb-title">프로필 설정</h1>
        <div className="mdb-controls">
          <button className="btn" onClick={toggleTheme}>{theme === 'dark' ? '라이트' : '다크'}</button>
          <button className="btn" onClick={() => navigate('/')}>← 돌아가기</button>
        </div>
      </div>

      <div className="settings-form">
        {/* 기본 정보 (읽기 전용) */}
        <div className="settings-section">
          <div className="settings-label">이름</div>
          <div className="settings-static">{user?.name}</div>
        </div>

        {/* username */}
        <div className="settings-section">
          <label className="settings-label" htmlFor="username">
            username
            <span style={{ fontSize: 11, color: '#aaa', marginLeft: 8 }}>공개 프로필 주소에 사용됩니다</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#aaa', fontSize: 14 }}>/u/</span>
            <input
              id="username"
              className="settings-input"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase() }))}
              placeholder="영소문자·숫자·언더스코어 3-20자"
              maxLength={20}
            />
          </div>
        </div>

        {/* bio */}
        <div className="settings-section">
          <label className="settings-label" htmlFor="bio">자기소개</label>
          <textarea
            id="bio"
            className="settings-input"
            style={{ height: 80, resize: 'vertical' }}
            value={form.bio}
            onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
            placeholder="간단한 자기소개..."
            maxLength={200}
          />
          <div style={{ fontSize: 11, color: '#bbb', textAlign: 'right' }}>{form.bio.length}/200</div>
        </div>

        {/* avatar_url */}
        <div className="settings-section">
          <label className="settings-label" htmlFor="avatar_url">아바타 이미지 URL</label>
          <input
            id="avatar_url"
            className="settings-input"
            value={form.avatar_url}
            onChange={e => setForm(f => ({ ...f, avatar_url: e.target.value }))}
            placeholder="https://..."
          />
          {form.avatar_url && (
            <img
              src={form.avatar_url}
              alt="아바타 미리보기"
              style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', marginTop: 8, border: '2px solid #eee' }}
              onError={e => { e.target.style.display = 'none'; }}
            />
          )}
        </div>

        {/* 공개 설정 */}
        <div className="settings-section">
          <div className="settings-label">프로필 공개</div>
          <div
            className={`settings-toggle ${form.is_profile_public ? 'on' : ''}`}
            onClick={() => setForm(f => ({ ...f, is_profile_public: !f.is_profile_public }))}
          >
            <div className="settings-toggle-knob" />
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
            {form.is_profile_public
              ? '공개 — /u/' + (form.username || 'username') + ' 에서 프로필을 볼 수 있습니다'
              : '비공개 — 나만 볼 수 있습니다'}
          </div>
        </div>

        {/* 피드백 */}
        {message && (
          <div style={{ fontSize: 13, color: '#27ae60', padding: '8px 12px', background: '#e8f5e9', borderRadius: 8 }}>
            {message}
          </div>
        )}
        {error && (
          <div style={{ fontSize: 13, color: '#c0392b', padding: '8px 12px', background: '#fdf0ef', borderRadius: 8 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          {form.username && form.is_profile_public && (
            <button className="btn" onClick={() => navigate(`/u/${form.username}`)}>
              내 프로필 보기
            </button>
          )}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
