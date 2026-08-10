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
import useTokenStore from '../store/tokenStore';
import { deleteAccount } from '../api/auth';
import { useMediaList } from '../hooks/useMediaList';
import ScreenshotImportModal from '../components/ScreenshotImportModal';

const BASE = `${import.meta.env.VITE_API_URL}/api`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const DELETE_CONFIRM_PHRASE = '삭제합니다';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuthStore();
  const { theme, themePref, setThemePref } = useTheme();
  const { balance } = useTokenStore();
  // 토큰 잔액 초기 로딩은 App 루트에서 한 번 처리한다

  // 다른 앱 기록 가져오기 (Phase 12.3) — 기존 스크린샷 임포트 플로우 재사용
  const { handleAdd } = useMediaList(user);
  const [screenshotOpen, setScreenshotOpen] = useState(false);

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

  // 계정 삭제 2단계 확인
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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

  // 계정 영구 삭제 — 비밀번호 확인 + "삭제합니다" 타이핑 모두 일치해야 실행
  const handleDeleteAccount = async () => {
    setDeleteError('');
    if (deleteConfirmText !== DELETE_CONFIRM_PHRASE) {
      setDeleteError(`"${DELETE_CONFIRM_PHRASE}"를 정확히 입력해주세요.`);
      return;
    }
    if (!deletePassword) {
      setDeleteError('비밀번호를 입력해주세요.');
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(token, deletePassword);
      logout();
      navigate('/login');
    } catch (err) {
      setDeleteError(err.response?.data?.error || '탈퇴 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
      setDeleting(false);
    }
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
          <button className="btn" onClick={() => navigate('/')}>← 돌아가기</button>
        </div>
      </div>

      <div className="settings-form">
        {/* 다른 앱 기록 가져오기 (Phase 12.3) */}
        <div className="settings-section">
          <div className="settings-label">다른 앱 기록 가져오기</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
            {/* [카피 초안 — 사용자 검수 예정] */}
            왓챠피디아·키노라이츠 등의 내 별점 목록 화면을 캡처해 올려주세요. AI가 작품을 자동으로 인식해서 가져와드려요.
          </div>
          <button className="btn" onClick={() => setScreenshotOpen(true)}>📸 스크린샷으로 가져오기</button>
        </div>

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

        {/* 화면 모드 */}
        <div className="settings-section">
          <div className="settings-label">화면 모드</div>
          <div className="theme-radio-group">
            {[
              { value: 'auto',  label: '시스템 설정 따르기' },
              { value: 'light', label: '라이트 모드' },
              { value: 'dark',  label: '다크 모드' },
            ].map(opt => (
              <label key={opt.value} className="theme-radio-item">
                <input
                  type="radio"
                  name="theme"
                  value={opt.value}
                  checked={themePref === opt.value}
                  onChange={() => setThemePref(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
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
          <div className="chip-success" style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8 }}>
            {message}
          </div>
        )}
        {error && (
          <div className="chip-error" style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8 }}>
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

        {/* 계정 삭제 */}
        <div className="settings-section" style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #eee' }}>
          <div className="settings-label" style={{ color: '#c0392b' }}>계정 삭제</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
            계정과 모든 기록이 영구적으로 삭제되며 복구할 수 없습니다.
          </div>

          {!deleteOpen ? (
            <button
              className="btn"
              style={{ color: '#c0392b', borderColor: '#c0392b' }}
              onClick={() => setDeleteOpen(true)}
            >
              계정 삭제
            </button>
          ) : (
            <div className="chip-error" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 8 }}>
              <label className="settings-label" htmlFor="delete-password">비밀번호 확인</label>
              <input
                id="delete-password"
                type="password"
                className="settings-input"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                placeholder="비밀번호"
                autoComplete="current-password"
              />

              <label className="settings-label" htmlFor="delete-confirm-text">
                확인을 위해 "{DELETE_CONFIRM_PHRASE}"를 입력하세요
              </label>
              <input
                id="delete-confirm-text"
                className="settings-input"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder={DELETE_CONFIRM_PHRASE}
              />

              {deleteError && (
                <div style={{ fontSize: 13, color: '#c0392b' }}>{deleteError}</div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  className="btn"
                  onClick={() => { setDeleteOpen(false); setDeletePassword(''); setDeleteConfirmText(''); setDeleteError(''); }}
                  disabled={deleting}
                >
                  취소
                </button>
                <button
                  className="btn"
                  style={{ background: '#c0392b', color: '#fff', borderColor: '#c0392b' }}
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting ? '삭제 중...' : '영구 삭제'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {screenshotOpen && (
        <ScreenshotImportModal
          onClose={() => setScreenshotOpen(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  );
}
