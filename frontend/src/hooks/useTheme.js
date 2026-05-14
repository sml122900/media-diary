/**
 * @file useTheme.js
 * 테마 관리 훅 — auto(시스템 따르기) / light / dark 3옵션 (Phase 10.2)
 * localStorage 'mdb_theme_pref': 'auto' | 'light' | 'dark'
 * document.documentElement.dataset.theme: 'light' | 'dark' (실제 적용값)
 */

import { useState, useEffect } from 'react';

/** 시스템 테마 감지 */
function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** 저장된 설정 → 실제 적용 테마 계산 */
function resolveTheme(pref) {
  if (pref === 'light') return 'light';
  if (pref === 'dark')  return 'dark';
  return getSystemTheme(); // 'auto' 또는 미설정
}

export function useTheme() {
  const [themePref, setThemePref] = useState(() => {
    return localStorage.getItem('mdb_theme_pref') || 'auto';
  });

  const [theme, setTheme] = useState(() => {
    const pref = localStorage.getItem('mdb_theme_pref') || 'auto';
    const resolved = resolveTheme(pref);
    document.documentElement.dataset.theme = resolved;
    return resolved;
  });

  // 시스템 테마 변경 감지 (auto 모드일 때만)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      if ((localStorage.getItem('mdb_theme_pref') || 'auto') === 'auto') {
        const resolved = e.matches ? 'dark' : 'light';
        document.documentElement.dataset.theme = resolved;
        setTheme(resolved);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // themePref 변경 시 즉시 적용
  useEffect(() => {
    const resolved = resolveTheme(themePref);
    document.documentElement.dataset.theme = resolved;
    localStorage.setItem('mdb_theme_pref', themePref);
    setTheme(resolved);
  }, [themePref]);

  // 기존 코드 호환성 유지 — toggleTheme은 light ↔ dark 토글
  const toggleTheme = () =>
    setThemePref(p => (resolveTheme(p) === 'dark' ? 'light' : 'dark'));

  return { theme, themePref, setThemePref, toggleTheme };
}
