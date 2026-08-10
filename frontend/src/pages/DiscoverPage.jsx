/**
 * @file DiscoverPage.jsx
 * 작품 발견 페이지 (/discover) — Phase 10.4
 * AI 채팅 추천 진입점 + 큐레이션 탐색
 */

import { useNavigate } from 'react-router-dom';
import TokenIcon from '../components/TokenIcon';

export default function DiscoverPage() {
  const navigate = useNavigate();

  return (
    <div className="discover-page">
      {/* 헤더 */}
      <div className="discover-header">
        <button className="btn" onClick={() => navigate('/')}>← 돌아가기</button>
        <h2 className="discover-title">🎬 발견하기</h2>
      </div>

      {/* AI 채팅 추천 진입 카드 */}
      <div className="discover-ai-card" onClick={() => navigate('/discover/chat')}>
        <div className="discover-ai-icon">🤖</div>
        <div className="discover-ai-body">
          <div className="discover-ai-title">AI에게 추천받기</div>
          <div className="discover-ai-sub">
            "오늘 기분에 맞는 영화" "넷플릭스 볼 거 추천" —
            대화하며 딱 맞는 작품을 찾아보세요
          </div>
          <div className="discover-ai-cost"><TokenIcon size={12} /> 2토큰/회</div>
        </div>
        <span className="discover-ai-arrow">→</span>
      </div>

      {/* 큐레이션 탐색 */}
      <section className="discover-section">
        <h3 className="discover-section-title">🗂 큐레이션 둘러보기</h3>
        <div
          className="discover-curation-banner"
          onClick={() => navigate('/restore')}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              77개 큐레이션 리스트 탐색
            </div>
            <div style={{ fontSize: 13, color: '#aaa' }}>
              감독별 · 수상작 · 국가별 · 장르별 · 프랜차이즈 · 드라마
            </div>
          </div>
          <span style={{ fontSize: 20, color: '#a78bfa' }}>→</span>
        </div>
      </section>
    </div>
  );
}
