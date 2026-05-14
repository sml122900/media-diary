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
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import PublicProfilePage from './pages/PublicProfilePage';
import ListsPage from './pages/ListsPage';
import FeedPage from './pages/FeedPage';
import ComparePage from './pages/ComparePage';
import WatchlistsPage from './pages/WatchlistsPage';
import YearInReviewPage from './pages/YearInReviewPage';
import WishlistPage from './pages/WishlistPage';
import RestorePage from './pages/RestorePage';
import CurationListPage from './pages/CurationListPage';
import MemoryChatPage from './pages/MemoryChatPage';
import OnboardingPage from './pages/OnboardingPage';
import BillingChargePage from './pages/BillingChargePage';
import BillingSuccessPage from './pages/BillingSuccessPage';
import BillingFailPage from './pages/BillingFailPage';
import BillingHistoryPage from './pages/BillingHistoryPage';
import BillingUsagePage from './pages/BillingUsagePage';
import PolicyPage from './pages/PolicyPage';

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
        <Route
          path="/reports"
          element={
            <PrivateRoute>
              <ReportsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <SettingsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/lists"
          element={
            <PrivateRoute>
              <ListsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/feed"
          element={
            <PrivateRoute>
              <FeedPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/compare/:userId"
          element={
            <PrivateRoute>
              <ComparePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/watchlists"
          element={
            <PrivateRoute>
              <WatchlistsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/wishlist"
          element={
            <PrivateRoute>
              <WishlistPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/year-in-review/:year"
          element={
            <PrivateRoute>
              <YearInReviewPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/onboarding"
          element={
            <PrivateRoute>
              <OnboardingPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/restore"
          element={
            <PrivateRoute>
              <RestorePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/restore/chat"
          element={
            <PrivateRoute>
              <MemoryChatPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/restore/:slug"
          element={
            <PrivateRoute>
              <CurationListPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/billing/charge"
          element={<PrivateRoute><BillingChargePage /></PrivateRoute>}
        />
        <Route
          path="/billing/history"
          element={<PrivateRoute><BillingHistoryPage /></PrivateRoute>}
        />
        <Route
          path="/billing/usage"
          element={<PrivateRoute><BillingUsagePage /></PrivateRoute>}
        />
        {/* 토스 리다이렉트 — 인증 불필요 (URL에 결제 정보 포함) */}
        <Route path="/billing/success" element={<BillingSuccessPage />} />
        <Route path="/billing/fail" element={<BillingFailPage />} />
        {/* 정책 페이지 — 비로그인 접근 가능 */}
        <Route path="/policy/:type" element={<PolicyPage />} />
        {/* 공개 프로필 — 비로그인 접근 가능 */}
        <Route path="/u/:username" element={<PublicProfilePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
