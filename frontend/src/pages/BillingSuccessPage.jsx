/**
 * @file BillingSuccessPage.jsx
 * 토스 결제 성공 후 리다이렉트 페이지 (Phase 9.4)
 * 경로: /billing/success?paymentKey=...&orderId=...&amount=...
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useTokenStore from '../store/tokenStore';
import { confirmPayment } from '../api/billing';

export default function BillingSuccessPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setBalance } = useTokenStore();

  const { token, isLoading } = useAuthStore();
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [result, setResult] = useState(null);
  const [errMsg, setErrMsg] = useState('');

  // isLoading이 false가 된 뒤에 confirm 호출 (auth 초기화 race condition 방지)
  useEffect(() => {
    if (isLoading) return;

    if (!token) {
      setErrMsg('로그인이 필요합니다.');
      setStatus('error');
      return;
    }

    const paymentKey = params.get('paymentKey');
    const orderId = params.get('orderId');
    const amount = params.get('amount');

    if (!paymentKey || !orderId || !amount) {
      setErrMsg('결제 정보가 올바르지 않습니다.');
      setStatus('error');
      return;
    }

    confirmPayment(token, { paymentKey, orderId, amount: Number(amount) })
      .then(res => {
        setResult(res.data);
        setBalance(res.data.newBalance);
        setStatus('success');
      })
      .catch(err => {
        setErrMsg(err.response?.data?.message || '결제 승인 중 오류가 발생했습니다.');
        setStatus('error');
      });
  }, [isLoading]); // auth 초기화 완료 시 실행

  if (status === 'loading') {
    return (
      <div className="billing-result-page">
        <div className="billing-result-icon">⏳</div>
        <h2>결제 확인 중...</h2>
        <p>잠시만 기다려주세요.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="billing-result-page">
        <div className="billing-result-icon error">❌</div>
        <h2>결제 확인 실패</h2>
        <p className="billing-error">{errMsg}</p>
        <button className="btn btn-primary" onClick={() => navigate('/billing/charge')}>
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="billing-result-page">
      <div className="billing-result-icon success">✅</div>
      <h2>충전 완료!</h2>
      <div className="billing-success-info">
        <div className="success-row">
          <span>충전된 토큰</span>
          <strong>+{result.addedTokens}토큰</strong>
        </div>
        <div className="success-row">
          <span>현재 잔액</span>
          <strong className="balance-highlight">{result.newBalance}토큰</strong>
        </div>
      </div>
      <div className="billing-result-actions">
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          홈으로
        </button>
        <button className="btn" onClick={() => navigate('/billing/charge')}>
          더 충전하기
        </button>
      </div>
    </div>
  );
}
