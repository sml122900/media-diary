/**
 * @file App.jsx
 * 앱 루트 컴포넌트 - 라우팅 설정 및 인증 상태 초기화
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import useAuthStore from './store/authStore';
import useTokenStore from './store/tokenStore';
import { useAndroidBackButton } from './hooks/useAndroidBackButton';
import { useTheme } from './hooks/useTheme';
import ExitConfirmDialog from './components/ExitConfirmDialog';
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
import DiscoverPage from './pages/DiscoverPage';
import DiscoverChatPage from './pages/DiscoverChatPage';
import ReportsCustomizePage from './pages/ReportsCustomizePage';
import BillingChargePage from './pages/BillingChargePage';
import BillingSuccessPage from './pages/BillingSuccessPage';
import BillingFailPage from './pages/BillingFailPage';
import BillingHistoryPage from './pages/BillingHistoryPage';
import BillingUsagePage from './pages/BillingUsagePage';
import PolicyPage from './pages/PolicyPage';
import EpithetsPage from './pages/EpithetsPage';

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
 * Android 하드웨어 뒤로가기 버튼 리스너 + 종료 확인 다이얼로그
 * useAndroidBackButton이 react-router 컨텍스트를 필요로 해 BrowserRouter 내부에 배치
 */
function AndroidBackButtonListener() {
  const { exitConfirmOpen, cancelExit, confirmExit } = useAndroidBackButton();
  if (!exitConfirmOpen) return null;
  return <ExitConfirmDialog onCancel={cancelExit} onExit={confirmExit} />;
}

/**
 * 앱 루트 컴포넌트
 * 앱 시작 시 localStorage 토큰으로 인증 상태 복원
 */
function App() {
  const { init, token } = useAuthStore();
  const fetchBalance = useTokenStore(s => s.fetchBalance);

  // 루트에서 한 번 호출해 어떤 경로로 진입하든 data-theme이 항상 설정되게 한다.
  // 기존엔 페이지별로 호출해서 /discover 등 미호출 페이지를 직접 열면
  // data-theme이 없어 테마 규칙이 하나도 적용되지 않았다.
  useTheme();

  // 앱 초기화 시 토큰 복원
  useEffect(() => {
    init();
  }, [init]);

  // 잔액도 같은 이유로 루트에서 한 번만 조회한다.
  // 페이지별로 호출하니 미호출 페이지(/discover/chat 등)를 직접 열면
  // 잔액 배지가 '···'로 비어 보였다. 차감·충전 후 갱신은 각 화면이
  // setBalance로 처리하므로 여기서는 최초 1회(로그인 시점)면 충분하다
  useEffect(() => {
    if (token) fetchBalance(token);
  }, [token, fetchBalance]);

  return (
    <BrowserRouter>
      <AndroidBackButtonListener />
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
          path="/epithets"
          element={
            <PrivateRoute>
              <EpithetsPage />
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
          path="/reports/customize"
          element={<PrivateRoute><ReportsCustomizePage /></PrivateRoute>}
        />
        <Route
          path="/discover"
          element={<PrivateRoute><DiscoverPage /></PrivateRoute>}
        />
        <Route
          path="/discover/chat"
          element={<PrivateRoute><DiscoverChatPage /></PrivateRoute>}
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
