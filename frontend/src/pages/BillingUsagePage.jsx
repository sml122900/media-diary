/**
 * @file BillingUsagePage.jsx
 * 토큰 사용량 대시보드 — 잔액, 충전/사용 합계, 기능별 도넛, 월별 바 차트 (Phase 9.6)
 * 경로: /billing/usage
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';
import useAuthStore from '../store/authStore';
import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const FEATURE_LABELS = { chat: 'AI 채팅', screenshot: '스크린샷', search: 'AI 검색', report: '리포트', discover_chat: 'AI 추천 채팅', report_chat: '리포트 AI 채팅' };
const FEATURE_COLORS = { chat: '#a78bfa', screenshot: '#34d399', search: '#fbbf24', report: '#f87171', discover_chat: '#60a5fa', report_chat: '#fb923c' };
const PIE_COLORS   = ['#a78bfa', '#34d399', '#fbbf24', '#f87171', '#60a5fa', '#fb923c'];

export default function BillingUsagePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${BASE}/api/me/usage-stats`, { headers: headers() })
      .then(res => setStats(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="billing-page">
        <p className="billing-loading">불러오는 중...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="billing-page">
        <p className="billing-loading">데이터를 불러오지 못했습니다.</p>
      </div>
    );
  }

  // 기능별 도넛 차트 데이터
  const pieData = Object.entries(stats.by_feature)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: FEATURE_LABELS[key] || key, value }));

  // 월별 바 차트 데이터
  const barData = stats.monthly_breakdown.map(row => ({
    month: row.month.slice(5) + '월',   // "2026-05" → "05월"
    tokens: row.tokens_used,
    cost: row.cost_estimate_krw,
  }));

  const usageRatio = stats.total_charged > 0
    ? Math.round((stats.total_used / stats.total_charged) * 100)
    : 0;

  return (
    <div className="billing-page">
      <div className="billing-header">
        <button className="btn" onClick={() => navigate(-1)}>← 뒤로</button>
        <h2>사용량 통계</h2>
        <Link to="/billing/history" className="btn" style={{ marginLeft: 'auto' }}>결제 이력</Link>
      </div>

      {/* 잔액 + 누적 요약 카드 */}
      <div className="usage-summary-grid">
        <div className="usage-card usage-card-main">
          <div className="usage-card-label">현재 잔액</div>
          <div className="usage-card-value">{stats.current_balance.toLocaleString()}<span>토큰</span></div>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => navigate('/billing/charge')}>
            충전하기
          </button>
        </div>
        <div className="usage-card">
          <div className="usage-card-label">누적 충전</div>
          <div className="usage-card-value">{stats.total_charged.toLocaleString()}<span>토큰</span></div>
        </div>
        <div className="usage-card">
          <div className="usage-card-label">누적 사용</div>
          <div className="usage-card-value">{stats.total_used.toLocaleString()}<span>토큰</span></div>
          <div className="usage-ratio">사용률 {usageRatio}%</div>
        </div>
      </div>

      {/* 기능별 사용량 도넛 차트 */}
      <div className="usage-section">
        <h3 className="usage-section-title">기능별 사용량</h3>
        {pieData.length === 0 ? (
          <p className="usage-empty">아직 AI 기능을 사용하지 않았어요.</p>
        ) : (
          <div className="usage-donut-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                  dataKey="value" nameKey="name" paddingAngle={3}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v}토큰`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>

            {/* 범례 + 수치 */}
            <div className="usage-feature-list">
              {Object.entries(stats.by_feature).map(([key, val]) => (
                <div key={key} className="usage-feature-row">
                  <span className="usage-feature-dot" style={{ background: FEATURE_COLORS[key] }} />
                  <span className="usage-feature-name">{FEATURE_LABELS[key]}</span>
                  <span className="usage-feature-val">{val}토큰</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 월별 사용 추이 바 차트 */}
      <div className="usage-section">
        <h3 className="usage-section-title">월별 사용 추이 (최근 6개월)</h3>
        {barData.length === 0 ? (
          <p className="usage-empty">사용 기록이 없어요.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => `${v}토큰`} />
              <Bar dataKey="tokens" name="사용 토큰" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
