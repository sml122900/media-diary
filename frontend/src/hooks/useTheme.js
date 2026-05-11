/**
 * @file useTheme.js
 * 라이트/다크 테마 토글 훅 — localStorage 영속, 시스템 설정 초기값 사용
 */

import { useState, useEffect } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('mdb_theme');
    const resolved = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    // 첫 렌더 전 즉시 적용 (flash 방지)
    document.documentElement.dataset.theme = resolved;
    return resolved;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('mdb_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return { theme, toggleTheme };
}
