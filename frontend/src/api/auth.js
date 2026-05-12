/**
 * @file auth.js
 * 인증 관련 API 호출 함수 모음 (회원가입, 로그인, 내 정보 조회)
 */

import axios from 'axios';

// Axios 인스턴스 생성 - 백엔드 기본 URL 설정
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

/**
 * 회원가입 API 호출
 * @param {string} name - 사용자 이름
 * @param {string} email - 이메일
 * @param {string} password - 비밀번호
 * @returns {Promise<{token: string, user: object}>}
 */
export async function register(name, email, password) {
  const res = await api.post('/api/auth/register', { name, email, password });
  return res.data;
}

/**
 * 로그인 API 호출
 * @param {string} email - 이메일
 * @param {string} password - 비밀번호
 * @returns {Promise<{token: string, user: object}>}
 */
export async function login(email, password) {
  const res = await api.post('/api/auth/login', { email, password });
  return res.data;
}

/**
 * 내 정보 조회 API 호출
 * @param {string} token - JWT 토큰
 * @returns {Promise<{user: object}>}
 */
export async function getMe(token) {
  const res = await api.get('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
