/**
 * @file billing.js
 * 결제·토큰 관련 API 호출 함수 (Phase 9)
 */

import axios from 'axios';

const API = import.meta.env.VITE_API_URL;
const h = (token) => ({ Authorization: `Bearer ${token}` });

/** 토큰 잔액 + 사용량 조회 */
export const getTokenBalance = (token) =>
  axios.get(`${API}/api/me/tokens`, { headers: h(token) }).then(r => r.data);

/** 결제 주문 생성 → orderId 반환 */
export const createCheckout = (token, packageType) =>
  axios.post(`${API}/api/billing/checkout`, { packageType }, { headers: h(token) }).then(r => r.data);

/** 토스 결제창 완료 후 서버 승인 */
export const confirmPayment = (token, body) =>
  axios.post(`${API}/api/billing/confirm`, body, { headers: h(token) }).then(r => r.data);

/** 결제 이력 목록 */
export const getBillingHistory = (token) =>
  axios.get(`${API}/api/billing/history`, { headers: h(token) }).then(r => r.data);
