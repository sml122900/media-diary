/**
 * @file useAndroidBackButton.js
 * Android 하드웨어 뒤로가기 버튼 처리 (Capacitor, Phase 11.2.4)
 * 열린 오버레이(모달/드로어)가 있으면 최상단 것부터 닫고,
 * 없으면 홈(/)이 아닐 때 react-router 히스토리를 뒤로, 홈이면 종료 확인 후 앱 종료
 * 웹(브라우저)에서는 네이티브 플랫폼이 아니므로 아무 동작도 하지 않음
 */

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

/**
 * 열린 오버레이의 백드롭 셀렉터.
 * 프로젝트의 모든 오버레이는 백드롭 자기 자신을 클릭하면 닫히는 구조라
 * (onClick={e => e.target === e.currentTarget && onClose()})
 * 뒤로가기를 "바깥 탭"과 동일하게 처리한다.
 */
const BACKDROP_SELECTOR = '.backdrop, .menu-backdrop, .dc-overlay, .rc-confirm-overlay';

/** 열려 있는 최상단 오버레이를 닫는다. 닫았으면 true */
function closeTopOverlay() {
  const layers = document.querySelectorAll(BACKDROP_SELECTOR);
  if (!layers.length) return false;
  layers[layers.length - 1].click();
  return true;
}

export function useAndroidBackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      if (closeTopOverlay()) {
        return;
      }
      if (location.pathname !== '/') {
        navigate(-1);
      } else if (window.confirm('앱을 종료하시겠습니까?')) {
        CapacitorApp.exitApp();
      }
    });

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, [location, navigate]);
}
