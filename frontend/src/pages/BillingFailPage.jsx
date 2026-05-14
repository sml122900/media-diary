/**
 * @file BillingFailPage.jsx
 * 토스 결제 실패 후 리다이렉트 페이지 (Phase 9.4)
 * 경로: /billing/fail?code=...&message=...&orderId=...
 */

import { useSearchParams, useNavigate } from 'react-router-dom';

const FAIL_MESSAGES = {
  PAY_PROCESS_CANCELED: '결제를 취소했습니다.',
  PAY_PROCESS_ABORTED: '결제가 중단됐습니다.',
  REJECT_CARD_COMPANY: '카드사에서 결제를 거부했습니다.',
  INVALID_CARD_EXPIRATION: '카드 유효기간이 올바르지 않습니다.',
  INSUFFICIENT_BALANCE: '카드 잔액이 부족합니다.',
};

export default function BillingFailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const code = params.get('code') || '';
  const message = params.get('message') || '결제에 실패했습니다.';
  const displayMessage = FAIL_MESSAGES[code] || message;

  return (
    <div className="billing-result-page">
      <div className="billing-result-icon error">❌</div>
      <h2>결제 실패</h2>
      <p className="billing-fail-message">{displayMessage}</p>
      {code && <p className="billing-fail-code">오류 코드: {code}</p>}
      <div className="billing-result-actions">
        <button className="btn btn-primary" onClick={() => navigate('/billing/charge')}>
          다시 시도
        </button>
        <button className="btn" onClick={() => navigate('/')}>
          홈으로
        </button>
      </div>
    </div>
  );
}
