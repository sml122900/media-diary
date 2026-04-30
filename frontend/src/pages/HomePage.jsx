/**
 * @file HomePage.jsx
 * 홈 페이지 - 로그인한 유저 이름 표시 및 로그아웃 기능
 */

import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

/**
 * 홈 페이지 컴포넌트
 * 로그인한 사용자 정보를 표시하고 로그아웃 처리
 */
function HomePage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  /**
   * 로그아웃 핸들러 - 상태 초기화 후 로그인 페이지로 이동
   */
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="home-container">
      <div className="home-box">
        <h1 className="home-title">미디어 다이어리</h1>
        <p className="home-welcome">
          안녕하세요, <strong>{user?.name}</strong>님!
        </p>
        <p className="home-email">{user?.email}</p>
        <button onClick={handleLogout} className="logout-button">
          로그아웃
        </button>
      </div>
    </div>
  );
}

export default HomePage;
