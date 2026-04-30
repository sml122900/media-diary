/**
 * @file authStore.js
 * Zustand를 이용한 인증 상태 전역 관리 (user, token, 로그인/로그아웃)
 */

import { create } from 'zustand';
import { getMe } from '../api/auth';

/**
 * 인증 스토어
 * - user: 현재 로그인한 사용자 정보
 * - token: JWT 토큰 (localStorage에 저장)
 * - isLoading: 토큰 복원 중 여부 (초기 깜빡임 방지)
 * - login: 로그인 후 상태 저장
 * - logout: 상태 및 localStorage 초기화
 * - init: 앱 시작 시 localStorage에서 토큰 복원
 */
const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isLoading: !!localStorage.getItem('token'), // 저장된 토큰이 있으면 복원 대기 상태

  /**
   * 로그인 성공 시 user와 token 저장
   * @param {object} user - 사용자 정보
   * @param {string} token - JWT 토큰
   */
  login: (user, token) => {
    localStorage.setItem('token', token);
    set({ user, token, isLoading: false });
  },

  /**
   * 로그아웃 - 상태 초기화 및 localStorage 토큰 제거
   */
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isLoading: false });
  },

  /**
   * 앱 초기화 시 localStorage 토큰으로 사용자 정보 복원
   */
  init: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const { user } = await getMe(token);
      set({ user, token, isLoading: false });
    } catch {
      // 토큰이 만료되었거나 유효하지 않으면 제거
      localStorage.removeItem('token');
      set({ user: null, token: null, isLoading: false });
    }
  },
}));

export default useAuthStore;
