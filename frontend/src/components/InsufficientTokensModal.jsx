/**
 * @file InsufficientTokensModal.jsx
 * 토큰 부족 시 표시되는 모달 (Phase 9.4)
 * AI 기능이 402 응답을 받을 때 사용
 */

import { useNavigate } from 'react-router-dom';
import TokenIcon from './TokenIcon';

/**
 * @param {{ required: number, balance: number, onClose: () => void }} props
 */
export default function InsufficientTokensModal({ required, balance, onClose }) {
  const navigate = useNavigate();
  const shortBy = required - balance;

  const handleCharge = () => {
    onClose();
    navigate('/billing/charge');
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal token-shortage-modal" onClick={e => e.stopPropagation()}>
        <div className="token-shortage-icon"><TokenIcon size={40} /></div>
        <h3 className="token-shortage-title">토큰이 부족해요</h3>
        <p className="token-shortage-desc">
          이 기능을 사용하려면 <strong>{required}토큰</strong>이 필요해요.
        </p>
        <div className="token-shortage-info">
          <div className="token-info-row">
            <span>현재 잔액</span>
            <span className="token-balance">{balance}토큰</span>
          </div>
          <div className="token-info-row">
            <span>필요 토큰</span>
            <span className="token-required">{required}토큰</span>
          </div>
          <div className="token-info-row token-info-total">
            <span>부족한 토큰</span>
            <span className="token-short">{shortBy}토큰</span>
          </div>
        </div>
        <div className="token-shortage-actions">
          <button className="btn btn-primary" onClick={handleCharge}>
            🛒 충전하기
          </button>
          <button className="btn" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}
