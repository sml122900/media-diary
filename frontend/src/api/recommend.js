/**
 * @file recommend.js
 * 추천 관련 API 호출 함수
 */

import axios from 'axios';

const BASE = `${import.meta.env.VITE_API_URL}/api`;

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

/**
 * 비슷한 작품 추천 조회
 * @param {number} mediaId - user_media.id
 * @returns {Promise<Array>} 추천 작품 배열
 */
export async function fetchSimilarRecs(mediaId) {
  try {
    const res = await axios.get(`${BASE}/recommend/similar/${mediaId}`, { headers: headers() });
    return res.data.data || [];
  } catch {
    return [];
  }
}
