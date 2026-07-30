/**
 * @file TokenIcon.jsx
 * 토큰(코인) 아이콘 — 🪙 이모지가 구형 Android WebView/폰트에서 미지원(tofu, □)되는
 * 문제 대응. lucide "coins" 아이콘을 인라인 SVG로 재현 (별도 아이콘 라이브러리 의존 없음)
 */

/**
 * @param {{ size?: number, style?: object, className?: string }} props
 */
export default function TokenIcon({ size = 14, style, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ verticalAlign: -2, flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d="M13.744 17.736a6 6 0 1 1-7.48-7.48" />
      <path d="M15 6h1v4" />
      <path d="m6.134 14.768.866-.5 2 3.464" />
      <circle cx="16" cy="8" r="6" />
    </svg>
  );
}
