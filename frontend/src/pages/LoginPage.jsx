/**
 * @file LoginPage.jsx
 * 로그인 페이지 - 이메일/비밀번호 입력 후 로그인 처리
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../api/auth';
import useAuthStore from '../store/authStore';

/**
 * 로그인 페이지 컴포넌트
 * 성공 시 홈으로 이동, 실패 시 에러 메시지 표시
 */
function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login: storeLogin } = useAuthStore();
  const navigate = useNavigate();

  /**
   * 로그인 폼 제출 핸들러
   * @param {React.FormEvent} e - 폼 이벤트
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await login(email, password);
      storeLogin(user, token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1 className="auth-title">미디어 다이어리</h1>
        <h2 className="auth-subtitle">로그인</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="auth-input"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="auth-input"
          />
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" disabled={loading} className="auth-button">
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
        <p className="auth-link">
          계정이 없으신가요? <Link to="/register">회원가입</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
