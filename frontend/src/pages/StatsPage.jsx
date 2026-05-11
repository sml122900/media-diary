/**
 * @file StatsPage.jsx
 * 통계 페이지 (/stats) — 연도별 분포, 분류 파이차트, 별점 분포, 감상 활동 캘린더
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { fetchUserMedia } from '../api/userMedia';
import { useTheme } from '../hooks/useTheme';

// 파이차트 색상
const PIE_COLORS = { movie: '#1a1a1a', anime: '#4a90d9', drama: '#e07a3f' };
const TYPE_LABEL = { movie: '영화', anime: '애니메이션', drama: '드라마' };

/** 커스텀 파이차트 라벨 */
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

/** GitHub 잔디 스타일 감상 활동 캘린더 */
function ActivityCalendar({ items }) {
  // 최근 52주 날짜 생성
  const weeks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - 7 * 52 + 1);

    // watched_at 기준 날짜별 카운트
    const counts = {};
    items.forEach(item => {
      if (!item.watched_at) return;
      const key = new Date(item.watched_at).toISOString().slice(0, 10);
      counts[key] = (counts[key] || 0) + 1;
    });

    // 주 단위 배열 생성
    const allWeeks = [];
    const cur = new Date(start);
    let week = [];
    while (cur <= today) {
      week.push({ date: cur.toISOString().slice(0, 10), count: counts[cur.toISOString().slice(0, 10)] || 0 });
      if (week.length === 7) { allWeeks.push(week); week = []; }
      cur.setDate(cur.getDate() + 1);
    }
    if (week.length) allWeeks.push(week);
    return allWeeks;
  }, [items]);

  const getColor = (count) => {
    if (count === 0) return '#ebedf0';
    if (count === 1) return '#9be9a8';
    if (count === 2) return '#40c463';
    if (count <= 4) return '#30a14e';
    return '#216e39';
  };

  const DAY_LABELS = ['일', '', '화', '', '목', '', '토'];

  return (
    <div className="calendar-wrap">
      <div style={{ display: 'flex', gap: 3 }}>
        {/* 요일 라벨 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginRight: 4 }}>
          {DAY_LABELS.map((label, i) => (
            <div key={i} style={{ height: 12, fontSize: 10, color: '#888', lineHeight: '12px' }}>{label}</div>
          ))}
        </div>
        {/* 주 단위 셀 */}
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {Array.from({ length: 7 }).map((_, di) => {
              const day = week[di];
              return (
                <div
                  key={di}
                  style={{ width: 12, height: 12, borderRadius: 2, background: day ? getColor(day.count) : '#ebedf0' }}
                  title={day ? `${day.date}: ${day.count}편` : ''}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 11, color: '#888' }}>적음</span>
        {['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'].map(c => (
          <div key={c} style={{ width: 12, height: 12, borderRadius: 2, background: c }} />
        ))}
        <span style={{ fontSize: 11, color: '#888' }}>많음</span>
      </div>
    </div>
  );
}

export default function StatsPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const currentYear = new Date().getFullYear();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserMedia()
      .then(data => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // 분류 파이차트 데이터
  const typeData = useMemo(() => {
    const counts = { movie: 0, anime: 0, drama: 0 };
    items.forEach(i => { counts[i.type] = (counts[i.type] || 0) + 1; });
    return Object.entries(counts).map(([type, value]) => ({ name: TYPE_LABEL[type], value, type })).filter(d => d.value > 0);
  }, [items]);

  // 연도별 분포 바 차트
  const yearData = useMemo(() => {
    const counts = {};
    items.forEach(i => {
      if (!i.year || i.year < 1900) return;
      const decade = Math.floor(i.year / 10) * 10;
      const key = `${decade}s`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).sort(([a], [b]) => Number(a) - Number(b)).map(([name, count]) => ({ name, count }));
  }, [items]);

  // 별점 분포 바 차트
  const ratingData = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    items.filter(i => i.rating > 0).forEach(i => { counts[i.rating] = (counts[i.rating] || 0) + 1; });
    return [1, 2, 3, 4, 5].map(r => ({ name: '★'.repeat(r), count: counts[r] }));
  }, [items]);

  // 요약 통계
  const summary = useMemo(() => {
    const reviewed = items.filter(i => i.rating > 0 || i.review_text);
    const rated = items.filter(i => i.rating > 0);
    const avgRating = rated.length
      ? (rated.reduce((s, i) => s + i.rating, 0) / rated.length).toFixed(1)
      : '-';
    const now = new Date();
    const thisMonth = items.filter(i => {
      if (!i.watched_at) return false;
      const d = new Date(i.watched_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    return { total: items.length, reviewed: reviewed.length, avgRating, thisMonth: thisMonth.length };
  }, [items]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#888' }}>
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="mdb-container">
      {/* 헤더 */}
      <div className="mdb-header" style={{ marginBottom: 24 }}>
        <h1 className="mdb-title">통계</h1>
        <div className="mdb-controls">
          <button className="btn" onClick={toggleTheme}>{theme === 'dark' ? '라이트' : '다크'}</button>
          <button className="btn" onClick={() => navigate('/')}>← 돌아가기</button>
        </div>
      </div>

      {/* 연말 결산 진입 배너 */}
      <div className="yir-banner" onClick={() => navigate(`/year-in-review/${currentYear}`)}>
        <div>
          <div className="yir-banner-text">🎬 {currentYear}년 감상 결산 보기</div>
          <div className="yir-banner-sub">Spotify Wrapped 스타일로 한 해를 돌아보세요</div>
        </div>
        <div className="yir-banner-arrow">›</div>
      </div>

      {/* 요약 카드 */}
      <div className="stats-summary">
        {[
          { label: '전체 작품', value: summary.total },
          { label: '감상 기록', value: summary.reviewed },
          { label: '평균 별점', value: summary.avgRating },
          { label: '이번 달 감상', value: summary.thisMonth },
        ].map(({ label, value }) => (
          <div key={label} className="summary-card">
            <div className="summary-value">{value}</div>
            <div className="summary-label">{label}</div>
          </div>
        ))}
      </div>

      {/* 차트 섹션 */}
      <div className="charts-grid">
        {/* 분류 파이차트 */}
        <div className="chart-card">
          <div className="chart-title">분류 분포</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={typeData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                dataKey="value"
                labelLine={false}
                label={PieLabel}
              >
                {typeData.map(entry => (
                  <Cell key={entry.type} fill={PIE_COLORS[entry.type] || '#888'} />
                ))}
              </Pie>
              <Legend formatter={(value) => value} />
              <Tooltip formatter={(value, name) => [`${value}편`, name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 별점 분포 */}
        <div className="chart-card">
          <div className="chart-title">별점 분포</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ratingData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 13 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [`${v}편`]} />
              <Bar dataKey="count" fill="#f0a500" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 연도별 분포 */}
        <div className="chart-card chart-card-wide">
          <div className="chart-title">연대별 분포</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={yearData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [`${v}편`]} />
              <Bar dataKey="count" fill="#1a1a1a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 감상 활동 캘린더 */}
        <div className="chart-card chart-card-wide">
          <div className="chart-title">감상 활동 (최근 52주)</div>
          <ActivityCalendar items={items} />
        </div>
      </div>
    </div>
  );
}
