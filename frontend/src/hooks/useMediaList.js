/**
 * @file useMediaList.js
 * 미디어 목록 상태 관리 훅 — 데이터 로드, 시딩, CRUD 핸들러
 */

import { useState, useEffect } from 'react';
import {
  fetchUserMedia,
  saveMediaItem,
  updateMediaItem,
  deleteMediaItem,
  updatePosterItem,
} from '../api/userMedia';

/**
 * @param {object|null} user - 로그인한 유저 (Zustand authStore)
 * @returns {{ items, setItems, loading, handlers }}
 */
export function useMediaList(user) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const doLoad = async () => {
      setLoading(true);
      try {
        const data = await fetchUserMedia();
        setItems(data);
      } catch (err) {
        console.error('데이터 로드 실패:', err);
      }
      setLoading(false);
    };
    doLoad();
  }, [user?.id]);

  /** 별점/리뷰 저장 (컨텍스트 필드 포함) */
  const handleSave = async (item, rating, reviewText, isPublic = false, context = {}) => {
    const date = rating > 0 || reviewText ? new Date().toLocaleDateString('ko-KR') : '';
    const updated = await updateMediaItem(item.id, {
      title: item.title, year: item.year, director: item.director,
      cast_info: item.cast_info, poster_url: item.poster_url,
      type: item.type, rating, review_text: reviewText, review_date: date,
      set_watched_at: true, is_public: isPublic,
      ...context,
    });
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
  };

  /** 감상 기록 삭제 (별점·리뷰 초기화) */
  const handleDeleteReview = async (item) => {
    const updated = await updateMediaItem(item.id, {
      title: item.title, year: item.year, director: item.director,
      cast_info: item.cast_info, poster_url: item.poster_url,
      type: item.type, rating: 0, review_text: '', review_date: '',
      set_watched_at: true,
      // life_period 보존 — 감상 삭제 시 시청 시기 텍스트는 유지
      life_period: item.life_period || null,
    });
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
  };

  /** 항목 삭제 */
  const handleDeleteItem = async (id) => {
    await deleteMediaItem(id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  /** 항목 정보 편집 (제목, 감독, 연도, 분류 등) */
  const handleEditItem = async (item, fields) => {
    const updated = await updateMediaItem(item.id, {
      title: fields.title,
      year: parseInt(fields.year) || item.year,
      director: fields.director,
      cast_info: fields.cast_info,
      type: fields.type,
      poster_url: item.poster_url,
      rating: item.rating,
      review_text: item.review_text,
      review_date: item.review_date,
      set_watched_at: false,  // 정보 편집 시 watched_at 유지
      // life_period 보존 — 항목 정보 편집 시 시청 시기 텍스트는 유지
      life_period: item.life_period || null,
    });
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    return updated;
  };

  /** 미디어 항목 추가 */
  const handleAdd = async (itemData) => {
    const already = items.some(i => i.title === itemData.title && i.year === itemData.year);
    if (already) { alert('이미 목록에 있어요!'); return null; }
    const saved = await saveMediaItem(itemData);
    if (saved) setItems(prev => [...prev, saved]);
    return saved;
  };

  /** 포스터 URL 업데이트 */
  const handleUpdatePoster = async (id, posterUrl) => {
    const updated = await updatePosterItem(id, posterUrl);
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
    return updated;
  };

  /** 서버에서 최신 목록 재로드 (CSV overwrite 후 등) */
  const reloadItems = async () => {
    const data = await fetchUserMedia();
    setItems(data);
  };

  return {
    items, setItems,
    loading,
    handleSave,
    handleDeleteReview,
    handleDeleteItem,
    handleEditItem,
    handleAdd,
    handleUpdatePoster,
    reloadItems,
  };
}
