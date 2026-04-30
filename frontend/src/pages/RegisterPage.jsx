/**
 * @file RegisterPage.jsx
 * 회원가입 페이지 - 이름/이메일/비밀번호 입력 후 회원가입 처리
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../api/auth';
import useAuthStore from '../store/authStore';

/**
 * 회원가입 페이지 컴포넌트
 * 성공 시 자동 로그인 후 홈으로 이동
 */
function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login: storeLogin } = useAuthStore();
  const navigate = useNavigate();

  /**
   * 회원가입 폼 제출 핸들러
   * @param {React.FormEvent} e - 폼 이벤트
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await register(name, email, password);
      // 회원가입 성공 후 자동 로그인
      storeLogin(user, token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1 className="auth-title">미디어 다이어리</h1>
        <h2 className="auth-subtitle">회원가입</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="text"
            placeholder="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="auth-input"
          />
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
            {loading ? '가입 중...' : '회원가입'}
          </button>
        </form>
        <p className="auth-link">
          이미 계정이 있으신가요? <Link to="/login">로그인</Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
