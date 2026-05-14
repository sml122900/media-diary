/**
 * @file BillingChargePage.jsx
 * 토큰 충전 페이지 — 패키지 선택 → 토스 결제창 호출 (Phase 9.4)
 * 경로: /billing/charge
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useTokenStore from '../store/tokenStore';
import { createCheckout } from '../api/billing';

// 토스페이먼츠 SDK CDN 동적 로드
function loadTossSDK() {
  if (window.TossPayments) return Promise.resolve(window.TossPayments);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.tosspayments.com/v1/payment';
    script.onload = () => resolve(window.TossPayments);
    script.onerror = () => reject(new Error('토스페이먼츠 SDK 로드 실패'));
    document.head.appendChild(script);
  });
}

const PACKAGES = [
  {
    key: 'small',
    label: '소형',
    amount: 1000,
    tokens: 100,
    bonus: 0,
    badge: null,
  },
  {
    key: 'medium',
    label: '중형',
    amount: 3000,
    tokens: 350,
    bonus: 50,
    badge: '+50 보너스',
  },
  {
    key: 'large',
    label: '대형',
    amount: 10000,
    tokens: 1300,
    bonus: 300,
    badge: '가장 인기',
    highlight: true,
  },
];

export default function BillingChargePage() {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const { balance, isFirstCharge, fetchBalance } = useTokenStore();
  const [selected, setSelected] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) fetchBalance(token);
  }, [token]);

  const handleCharge = async () => {
    if (!selected || loading) return;
    setLoading(true);
    setError('');

    try {
      // 1. 서버에 주문 생성
      const res = await createCheckout(token, selected);
      const { orderId, orderName, amount, tokensToAdd, firstBonus } = res.data;

      // 2. 토스 SDK 로드
      const TossPayments = await loadTossSDK();
      const tossPayments = TossPayments(import.meta.env.VITE_TOSS_CLIENT_KEY);

      // 3. 결제창 호출 (결제 완료 시 successUrl로 리다이렉트)
      await tossPayments.requestPayment('카드', {
        amount,
        orderId,
        orderName,
        customerName: user?.name || '사용자',
        successUrl: `${window.location.origin}/billing/success`,
        failUrl: `${window.location.origin}/billing/fail`,
      });
    } catch (err) {
      // 사용자가 결제창을 닫은 경우 등
      if (err.code !== 'USER_CANCEL') {
        setError(err.message || '결제 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="billing-page">
      <div className="billing-header">
        <button className="btn" onClick={() => navigate(-1)}>← 뒤로</button>
        <h2>토큰 충전</h2>
        {balance !== null && (
          <span className="current-balance">현재 잔액: <strong>{balance}토큰</strong></span>
        )}
      </div>

      {isFirstCharge && (
        <div className="first-charge-banner">
          🎉 첫 충전 보너스 +20% 적용 중! 지금 충전하면 더 받아요.
        </div>
      )}

      <div className="package-grid">
        {PACKAGES.map(pkg => {
          const firstBonus = isFirstCharge ? Math.floor(pkg.tokens * 0.2) : 0;
          const total = pkg.tokens + firstBonus;

          return (
            <div
              key={pkg.key}
              className={`package-card ${pkg.highlight ? 'package-highlight' : ''} ${selected === pkg.key ? 'package-selected' : ''}`}
              onClick={() => setSelected(pkg.key)}
            >
              {pkg.badge && (
                <div className={`package-badge ${pkg.highlight ? 'badge-popular' : 'badge-bonus'}`}>
                  {pkg.badge}
                </div>
              )}
              {isFirstCharge && (
                <div className="package-badge badge-first">첫 충전 +{Math.floor(pkg.tokens * 0.2)}</div>
              )}
              <div className="package-label">{pkg.label}</div>
              <div className="package-price">₩{pkg.amount.toLocaleString()}</div>
              <div className="package-tokens">
                <span className="token-main">{total.toLocaleString()}토큰</span>
                {(pkg.bonus > 0 || firstBonus > 0) && (
                  <span className="token-sub">
                    기본 {pkg.tokens} + 보너스 {pkg.bonus + firstBonus}
                  </span>
                )}
              </div>
              <div className="package-select-indicator">
                {selected === pkg.key ? '✓ 선택됨' : '선택'}
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="billing-error">{error}</p>}

      <div className="billing-actions">
        <button
          className="btn btn-primary btn-charge"
          onClick={handleCharge}
          disabled={loading}
        >
          {loading ? '처리 중...' : `결제하기`}
        </button>
        <p className="billing-notice">
          결제 후 7일 이내 미사용분은 이메일로 환불 요청 가능합니다.
        </p>
      </div>
    </div>
  );
}
