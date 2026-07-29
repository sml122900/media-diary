/**
 * @file platform.js
 * 실행 플랫폼 감지 유틸 — Capacitor 네이티브 앱 vs 웹 브라우저 구분 (Stage 11.3.2)
 */

import { Capacitor } from '@capacitor/core';

/**
 * Capacitor 네이티브 앱(APK/AAB)에서 실행 중인지 여부
 * @returns {boolean}
 */
export const isNativeApp = () => Capacitor.isNativePlatform();
