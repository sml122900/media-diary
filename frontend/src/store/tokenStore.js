/**
 * @file tokenStore.js
 * 토큰 잔액 전역 상태 관리 (Phase 9)
 */

import { create } from 'zustand';
import { getTokenBalance } from '../api/billing';

const useTokenStore = create((set) => ({
  balance: null,      // null = 미조회
  isFirstCharge: false,
  importFree: true,   // 임포트(스크린샷) 무료화 플래그 — 서버 응답 오기 전 기본값 (Phase 12.3)

  /** 서버에서 최신 잔액 조회 */
  fetchBalance: async (token) => {
    try {
      const res = await getTokenBalance(token);
      set({
        balance: res.data.balance,
        isFirstCharge: !res.data.has_used_first_charge_bonus,
        importFree: res.data.import_free ?? true,
      });
    } catch {
      // 조회 실패 시 무시 (기존 값 유지)
    }
  },

  /** 결제/차감 후 잔액 직접 갱신 */
  setBalance: (balance) => set({ balance }),
}));

export default useTokenStore;
