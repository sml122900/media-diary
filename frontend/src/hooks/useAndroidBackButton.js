/**
 * @file useAndroidBackButton.js
 * Android 하드웨어 뒤로가기 버튼 처리 (Capacitor, Phase 11.2.4)
 * 홈(/)이 아니면 react-router 히스토리를 뒤로, 홈이면 종료 확인 후 앱 종료
 * 웹(브라우저)에서는 네이티브 플랫폼이 아니므로 아무 동작도 하지 않음
 */

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

export function useAndroidBackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = CapacitorApp.addListener('backButton', () => {
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
