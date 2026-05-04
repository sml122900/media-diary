/**
 * @file userMedia.js
 * 사용자 미디어 항목 관련 API 호출 함수
 */

import axios from 'axios';

const BASE = 'http://localhost:4000/api/user-media';

/** @returns {object} Authorization 헤더 */
const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

/**
 * 사용자의 모든 미디어 항목 조회
 * @returns {Promise<Array>} 미디어 항목 배열
 */
export async function fetchUserMedia() {
  const res = await axios.get(BASE, { headers: headers() });
  return res.data.data;
}

/**
 * 미디어 항목 일괄 추가 (씨드용)
 * @param {Array} items
 */
export async function bulkSaveMedia(items) {
  const res = await axios.post(`${BASE}/bulk`, { items }, { headers: headers() });
  return res.data;
}

/**
 * 미디어 항목 추가 또는 리뷰 업서트
 * @param {object} item
 */
export async function saveMediaItem(item) {
  const res = await axios.post(BASE, item, { headers: headers() });
  return res.data.data;
}

/**
 * 미디어 항목 업데이트
 * @param {number} id
 * @param {object} updates
 */
export async function updateMediaItem(id, updates) {
  const res = await axios.put(`${BASE}/${id}`, updates, { headers: headers() });
  return res.data.data;
}

/**
 * 미디어 항목 삭제
 * @param {number} id
 */
export async function deleteMediaItem(id) {
  const res = await axios.delete(`${BASE}/${id}`, { headers: headers() });
  return res.data;
}
