/**
 * @file BillingHistoryPage.jsx
 * 결제 이력 페이지 (Phase 9.4)
 * 경로: /billing/history
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { getBillingHistory } from '../api/billing';

const STATUS_LABEL = {
  pending:  { text: '처리 중',  cls: 'status-pending'  },
  success:  { text: '완료',    cls: 'status-success'  },
  failed:   { text: '실패',    cls: 'status-failed'   },
  refunded: { text: '환불됨',  cls: 'status-refunded' },
};

const PKG_LABEL = { small: '소형', medium: '중형', large: '대형' };

export default function BillingHistoryPage() {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBillingHistory(token)
      .then(res => setHistory(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="billing-page">
      <div className="billing-header">
        <button className="btn" onClick={() => navigate(-1)}>← 뒤로</button>
        <h2>결제 이력</h2>
        <Link to="/billing/usage" className="btn" style={{ marginLeft: 'auto' }}>사용량 통계</Link>
      </div>

      {loading ? (
        <p className="billing-loading">불러오는 중...</p>
      ) : history.length === 0 ? (
        <div className="billing-empty">
          <p>결제 내역이 없어요.</p>
          <button className="btn btn-primary" onClick={() => navigate('/billing/charge')}>
            첫 충전하기
          </button>
        </div>
      ) : (
        <div className="billing-history-list">
          {history.map(item => {
            const s = STATUS_LABEL[item.status] || { text: item.status, cls: '' };
            const date = new Date(item.created_at).toLocaleDateString('ko-KR', {
              year: 'numeric', month: 'long', day: 'numeric',
            });
            return (
              <div key={item.id} className="billing-history-item">
                <div className="bh-left">
                  <div className="bh-pkg">{PKG_LABEL[item.package_type] || item.package_type} 패키지</div>
                  <div className="bh-date">{date}</div>
                  {item.payment_method && (
                    <div className="bh-method">{item.payment_method}</div>
                  )}
                </div>
                <div className="bh-right">
                  <div className="bh-tokens">+{item.tokens_added}토큰</div>
                  <div className="bh-amount">₩{Number(item.amount_krw).toLocaleString()}</div>
                  <span className={`bh-status ${s.cls}`}>{s.text}</span>
                  {item.status === 'refunded' && item.refund_amount_krw > 0 && (
                    <div className="bh-refund">환불 ₩{Number(item.refund_amount_krw).toLocaleString()}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="billing-refund-notice">
        <p>환불 문의: 결제 후 7일 이내 미사용분은 이메일(sml122900@gmail.com)로 문의해주세요.</p>
        <p style={{ marginTop: 8 }}>
          <Link to="/policy/refund">환불 정책</Link>
          {' · '}
          <Link to="/policy/terms">이용약관</Link>
          {' · '}
          <Link to="/policy/privacy">개인정보처리방침</Link>
        </p>
      </div>
    </div>
  );
}
