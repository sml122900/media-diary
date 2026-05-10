/**
 * @file App.jsx
 * 앱 루트 컴포넌트 - 라우팅 설정 및 인증 상태 초기화
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import useAuthStore from './store/authStore';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import StatsPage from './pages/StatsPage';

/**
 * 로그인이 필요한 경로 보호 컴포넌트
 * 토큰 복원 중에는 렌더링 대기, 미로그인 시 /login으로 리다이렉트
 * @param {React.ReactNode} children - 보호할 컴포넌트
 */
function PrivateRoute({ children }) {
  const { user, isLoading } = useAuthStore();
  // 토큰 복원 중에는 아무것도 렌더링하지 않아 화면 깜빡임 방지
  if (isLoading) return null;
  return user ? children : <Navigate to="/login" replace />;
}

/**
 * 앱 루트 컴포넌트
 * 앱 시작 시 localStorage 토큰으로 인증 상태 복원
 */
function App() {
  const { init } = useAuthStore();

  // 앱 초기화 시 토큰 복원
  useEffect(() => {
    init();
  }, [init]);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <PrivateRoute>
              <HomePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/stats"
          element={
            <PrivateRoute>
              <StatsPage />
            </PrivateRoute>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
