/**
 * @file StatsPage.jsx
 * 통계 페이지 (/stats) — 연도별 분포, 분류 파이차트, 별점 분포, 감상 활동 캘린더
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { fetchUserMedia } from '../api/userMedia';
import { useTheme } from '../hooks/useTheme';

// 파이차트 색상
const PIE_COLORS = { movie: '#1a1a1a', anime: '#4a90d9', drama: '#e07a3f' };
const TYPE_LABEL = { movie: '영화', anime: '애니메이션', drama: '드라마' };

// 연대별 바 색상 — 다크에서 #1a1a1a가 카드 배경(#1c1c1c)에 묻혀 테마별로 분기
const BAR_COLOR = { light: '#1a1a1a', dark: '#a78bfa' };

// 감상 활동 캘린더 색 단계 (0편 → 5편 이상)
// 다크는 GitHub 다크 잔디색 + 빈 셀만 카드 테두리 톤(#2e2e2e)으로 맞춤
// (GitHub 원본 #161b22는 카드 배경 #1c1c1c보다 어두워 셀이 안 보임)
const CALENDAR_SCALE = {
  light: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
  dark:  ['#2e2e2e', '#0e4429', '#006d32', '#26a641', '#39d353'],
};

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
  const { theme } = useTheme();
  const scale = CALENDAR_SCALE[theme] || CALENDAR_SCALE.light;

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
    if (count === 0) return scale[0];
    if (count === 1) return scale[1];
    if (count === 2) return scale[2];
    if (count <= 4) return scale[3];
    return scale[4];
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
                  style={{ width: 12, height: 12, borderRadius: 2, background: day ? getColor(day.count) : scale[0] }}
                  title={day ? `${day.date}: ${day.count}편` : ''}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 11, color: '#888' }}>적음</span>
        {scale.map(c => (
          <div key={c} style={{ width: 12, height: 12, borderRadius: 2, background: c }} />
        ))}
        <span style={{ fontSize: 11, color: '#888' }}>많음</span>
      </div>
    </div>
  );
}

const RUNTIME_EST = { movie: 110, drama: 60, anime: 24 };

function watchTimeQuip(minutes) {
  const hours = Math.round(minutes / 60);
  if (hours >= 200) return `서울-부산 KTX를 ${Math.floor(minutes / 112)}번 탈 수 있어요`;
  if (hours >= 50)  return `마라톤을 ${Math.floor(minutes / 300)}번 뛸 수 있는 시간이에요`;
  if (hours >= 10)  return `잠을 ${Math.floor(minutes / 480)}일치 더 잘 수 있었어요`;
  return '이제 막 시작하는 감상가예요!';
}

export default function StatsPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const currentYear = new Date().getFullYear();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [watchStats, setWatchStats] = useState(null);
  const [statsPeriod, setStatsPeriod] = useState('year');
  // 시청 시기 태그 그룹 (Phase 6.5.1)
  const [lifePeriods, setLifePeriods] = useState([]);

  useEffect(() => {
    fetchUserMedia()
      .then(data => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
    // 시청 시기 그룹 로드
    const token = localStorage.getItem('token');
    fetch(`${import.meta.env.VITE_API_URL}/api/me/life-periods`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(json => { if (json.success) setLifePeriods(json.data); }).catch(() => {});
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get(`${import.meta.env.VITE_API_URL}/api/me/watch-stats?period=${statsPeriod}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => setWatchStats(res.data.data)).catch(() => {});
  }, [statsPeriod]);

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
      counts[decade] = (counts[decade] || 0) + 1;
    });
    // 연대 숫자로 오름차순 정렬 (기존엔 '1980s' 문자열을 Number()로 변환해 NaN → 정렬 무효화)
    return Object.entries(counts)
      .map(([decade, count]) => ({ decade: Number(decade), name: `${decade}s`, count }))
      .sort((a, b) => a.decade - b.decade);
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

      {/* 시청 시간 카드 (Phase 5.3) */}
      <div className="chart-card chart-card-wide" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="chart-title" style={{ marginBottom: 0 }}>시청 시간</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['year', '올해'], ['month', '이번 달'], ['all', '전체']].map(([p, label]) => (
              <button
                key={p}
                className={statsPeriod === p ? 'tab-btn active' : 'tab-btn'}
                style={{ fontSize: 12, padding: '3px 10px' }}
                onClick={() => setStatsPeriod(p)}
              >{label}</button>
            ))}
          </div>
        </div>
        {watchStats ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 48, fontWeight: 900, lineHeight: 1 }}>{Math.floor(watchStats.total_hours)}<span style={{ fontSize: 20, fontWeight: 400 }}>시간</span></div>
              <div style={{ fontSize: 13, color: '#888', marginTop: 6 }}>{watchStats.total_count}편 · 편당 평균 {watchStats.avg_minutes}분</div>
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 4, fontStyle: 'italic' }}>{watchTimeQuip(watchStats.total_minutes)}</div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {Object.entries(watchStats.by_type).filter(([, v]) => v > 0).map(([type, mins]) => (
                <div key={type} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{Math.round(mins / 60)}h</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{TYPE_LABEL[type]}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ color: '#aaa', fontSize: 14 }}>해당 기간 시청 기록이 없습니다</div>
        )}
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
              <Bar dataKey="count" fill={BAR_COLOR[theme] || BAR_COLOR.light} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 감상 활동 캘린더 */}
        <div className="chart-card chart-card-wide">
          <div className="chart-title">감상 활동 (최근 52주)</div>
          <ActivityCalendar items={items} />
        </div>

        {/* 그 시절 — 시청 시기별 그룹 (Phase 6.5.1) */}
        {lifePeriods.length > 0 && (
          <div className="chart-card chart-card-wide">
            <div className="chart-title">그 시절 🕰️</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {lifePeriods.map(group => (
                <div key={group.life_period}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                    {group.life_period}
                    <span style={{ fontSize: 12, fontWeight: 400, color: '#888', marginLeft: 6 }}>
                      {group.count}편
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                    {(group.works || []).slice(0, 10).map(w => (
                      <div key={w.id} style={{ flexShrink: 0, width: 60 }}>
                        <div style={{ width: 60, height: 90, borderRadius: 6, overflow: 'hidden',
                          background: w.poster_url ? '#000' : '#3949AB', marginBottom: 4 }}>
                          {w.poster_url
                            ? <img src={w.poster_url} alt={w.title} loading="lazy"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', padding: 4 }}>
                                <span style={{ fontSize: 8, color: '#fff', textAlign: 'center', lineHeight: 1.3 }}>{w.title}</span>
                              </div>
                          }
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--text-secondary)', textAlign: 'center',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {w.title}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
