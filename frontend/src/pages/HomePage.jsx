import useAuthStore from '../store/authStore';
import './HomePage.css';

export default function HomePage() {
  const { user, logout } = useAuthStore((s) => ({ user: s.user, logout: s.logout }));

  return (
    <div className="home-container">
      <header className="home-header">
        <h1>미디어 다이어리</h1>
        <div className="header-right">
          <span className="user-greeting">안녕하세요, <strong>{user?.name}</strong>님</span>
          <button className="logout-btn" onClick={logout}>로그아웃</button>
        </div>
      </header>
      <main className="home-main">
        <div className="empty-state">
          <p className="empty-icon">📚</p>
          <p className="empty-text">아직 기록된 미디어가 없습니다.</p>
          <p className="empty-sub">영화, 책, 드라마를 기록해보세요!</p>
        </div>
      </main>
    </div>
  );
}
