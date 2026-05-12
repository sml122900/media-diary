/**
 * @file YearInReviewPage.jsx
 * 연말 결산 페이지 (/year-in-review/:year) — Phase 5.1
 * Spotify Wrapped 스타일 슬라이드 형식 연간 감상 회고
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import axios from 'axios';
import html2canvas from 'html2canvas';

const BASE = `${import.meta.env.VITE_API_URL}/api`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// 슬라이드별 배경 색상 (어두운 시네마틱 팔레트)
const SLIDE_THEMES = [
  { bg: '#0d1117', accent: '#58a6ff' }, // 인트로 — 다크 블루
  { bg: '#0d0d0d', accent: '#f0a500' }, // 총 감상 수 — 골드
  { bg: '#0a1628', accent: '#3fb950' }, // 시청 시간 — 그린
  { bg: '#1a0d2e', accent: '#d2a8ff' }, // 장르 분포 — 퍼플
  { bg: '#1a0800', accent: '#ff7b72' }, // ★5 명단 — 레드
  { bg: '#001a1a', accent: '#39d353' }, // 월별 추이 — 그린
  { bg: '#1a1a00', accent: '#f7d67b' }, // 감독 — 옐로우
  { bg: '#0d0d1a', accent: '#79c0ff' }, // 작년 비교 — 라이트 블루
  { bg: '#1a0d17', accent: '#ffa7c4' }, // 아웃트로 — 핑크
];

const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const TYPE_LABEL = { movie: '영화', anime: '애니메이션', drama: '드라마' };

export default function YearInReviewPage() {
  const { year } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [slide, setSlide] = useState(0);
  const [saving, setSaving] = useState(false);
  const slideRef = useRef(null);

  const totalSlides = 9;

  useEffect(() => {
    axios.get(`${BASE}/year-in-review/${year}`, { headers: headers() })
      .then(res => {
        setData(res.data.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.message || '데이터를 불러오지 못했습니다');
        setLoading(false);
      });
  }, [year]);

  // 키보드 방향키 + ESC 지원
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextSlide();
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   prevSlide();
      if (e.key === 'Escape') navigate('/');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [slide]);

  const nextSlide = () => setSlide(s => Math.min(s + 1, totalSlides - 1));
  const prevSlide = () => setSlide(s => Math.max(s - 1, 0));

  // 현재 슬라이드를 PNG로 저장
  const handleSaveImage = async () => {
    if (!slideRef.current || saving) return;
    setSaving(true);
    try {
      const canvas = await html2canvas(slideRef.current, {
        scale: 2,          // 고해상도
        useCORS: true,     // 외부 이미지(포스터) CORS 허용
        backgroundColor: SLIDE_THEMES[slide].bg,
      });
      const link = document.createElement('a');
      link.download = `media-diary-${year}-slide${slide + 1}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      alert('이미지 저장에 실패했습니다');
    }
    setSaving(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0d1117', color: '#58a6ff', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 32 }}>🎬</div>
      <div style={{ fontSize: 15 }}>{year}년 데이터를 집계하는 중...</div>
    </div>
  );

  if (error || !data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0d1117', color: '#fff', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 24, opacity: .6 }}>😶</div>
      <div style={{ fontSize: 16 }}>{error || `${year}년 감상 기록이 없습니다`}</div>
      <div style={{ fontSize: 13, color: '#888' }}>작품에 별점을 남기고 watched_at이 기록되어야 집계됩니다</div>
      <button onClick={() => navigate('/')} style={{ marginTop: 8, padding: '8px 20px', borderRadius: 8, border: 'none', background: '#58a6ff', color: '#fff', cursor: 'pointer', fontSize: 14 }}>
        홈으로
      </button>
    </div>
  );

  const theme = SLIDE_THEMES[slide];
  const monthlyData = data.monthly_counts.map((count, i) => ({ month: MONTH_LABELS[i], count }));

  // 각 슬라이드 콘텐츠
  const slides = [

    /* 슬라이드 0: 인트로 */
    <div key="intro" className="yir-slide-content" style={{ justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: 14, letterSpacing: 4, color: theme.accent, marginBottom: 16, textTransform: 'uppercase' }}>Media Diary</div>
      <div style={{ fontSize: 80, fontWeight: 900, lineHeight: 1, marginBottom: 12, color: '#fff' }}>{year}</div>
      <div style={{ fontSize: 22, color: '#ccc', fontWeight: 300 }}>당신의 한 해 감상 결산</div>
      <div style={{ marginTop: 32, fontSize: 13, color: '#555' }}>→ 또는 오른쪽 버튼을 눌러 시작하세요</div>
    </div>,

    /* 슬라이드 1: 총 감상 수 */
    <div key="count" className="yir-slide-content" style={{ justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: 14, color: '#888', marginBottom: 24, letterSpacing: 2 }}>올해 당신이 본 작품</div>
      <div className="yir-big-number" style={{ color: theme.accent }}>{data.total_count}</div>
      <div style={{ fontSize: 28, color: '#fff', marginBottom: 20 }}>편</div>
      <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 8 }}>
        {Object.entries(data.type_distribution).filter(([, v]) => v > 0).map(([type, count]) => (
          <div key={type} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{count}</div>
            <div style={{ fontSize: 12, color: '#888' }}>{TYPE_LABEL[type]}</div>
          </div>
        ))}
      </div>
      {data.avg_rating && (
        <div style={{ marginTop: 28, fontSize: 16, color: '#aaa' }}>
          평균 별점 <span style={{ color: '#f0a500', fontWeight: 700, fontSize: 20 }}>★{data.avg_rating}</span>
        </div>
      )}
    </div>,

    /* 슬라이드 2: 총 시청 시간 */
    <div key="time" className="yir-slide-content" style={{ justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: 14, color: '#888', marginBottom: 24, letterSpacing: 2 }}>총 시청 시간</div>
      <div className="yir-big-number" style={{ color: theme.accent, fontSize: 80 }}>
        {Math.floor(data.total_minutes / 60)}
      </div>
      <div style={{ fontSize: 28, color: '#fff', marginBottom: 20 }}>시간</div>
      <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>({data.total_minutes.toLocaleString()}분)</div>
      <div style={{
        fontSize: 16, color: '#aaa', maxWidth: 300, lineHeight: 1.6,
        padding: '14px 20px', background: 'rgba(255,255,255,.05)',
        borderRadius: 12, borderLeft: `3px solid ${theme.accent}`
      }}>
        {data.watch_time_comment}
      </div>
    </div>,

    /* 슬라이드 3: 장르 분포 */
    <div key="genre" className="yir-slide-content" style={{ justifyContent: 'center' }}>
      <div style={{ fontSize: 14, color: '#888', marginBottom: 24, letterSpacing: 2, textAlign: 'center' }}>올해의 장르 분포</div>
      {Object.entries(data.type_distribution)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([type, count], i) => {
          const pct = Math.round(count / data.total_count * 100);
          return (
            <div key={type} style={{ marginBottom: 20, width: '100%', maxWidth: 340 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#fff', fontSize: 16 }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {TYPE_LABEL[type]}
                </span>
                <span style={{ color: theme.accent, fontWeight: 700 }}>{count}편 ({pct}%)</span>
              </div>
              <div style={{ height: 8, background: '#222', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: theme.accent, borderRadius: 4, transition: 'width .6s ease' }} />
              </div>
            </div>
          );
        })}
    </div>,

    /* 슬라이드 4: ★5 명단 */
    <div key="fivestars" className="yir-slide-content" style={{ justifyContent: data.five_star_items.length ? 'flex-start' : 'center' }}>
      <div style={{ fontSize: 14, color: '#888', marginBottom: 16, letterSpacing: 2, textAlign: 'center', width: '100%' }}>
        올해의 명작 ★5
      </div>
      {data.five_star_items.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#555', fontSize: 15 }}>
          아직 별점 5점 작품이 없습니다<br />
          <span style={{ fontSize: 12, marginTop: 8, display: 'block' }}>좋은 작품을 만나면 꼭 기록해두세요!</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', overflowY: 'auto', maxHeight: '70vh' }}>
          {data.five_star_items.map((item, i) => (
            <div key={i} style={{ width: 72, textAlign: 'center' }}>
              <div style={{ width: 72, height: 108, borderRadius: 6, overflow: 'hidden', background: '#1a1a1a', marginBottom: 4 }}>
                {item.poster_url
                  ? <img src={item.poster_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, opacity: .3 }}>🎬</div>
                }
              </div>
              <div style={{ fontSize: 9, color: '#aaa', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {item.title}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>,

    /* 슬라이드 5: 월별 추이 */
    <div key="monthly" className="yir-slide-content" style={{ justifyContent: 'center' }}>
      <div style={{ fontSize: 14, color: '#888', marginBottom: 24, letterSpacing: 2, textAlign: 'center' }}>월별 감상 추이</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={monthlyData} margin={{ left: -20, right: 10 }}>
          <XAxis dataKey="month" tick={{ fill: '#666', fontSize: 11 }} />
          <YAxis tick={{ fill: '#666', fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: `1px solid ${theme.accent}`, borderRadius: 8, color: '#fff' }}
            formatter={(v) => [`${v}편`]}
          />
          <Bar dataKey="count" fill={theme.accent} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: '#666' }}>
        가장 많이 본 달:{' '}
        <span style={{ color: theme.accent, fontWeight: 700 }}>
          {MONTH_LABELS[data.monthly_counts.indexOf(Math.max(...data.monthly_counts))]}
          {' '}({Math.max(...data.monthly_counts)}편)
        </span>
      </div>
    </div>,

    /* 슬라이드 6: 최애 감독 */
    <div key="directors" className="yir-slide-content" style={{ justifyContent: 'center' }}>
      <div style={{ fontSize: 14, color: '#888', marginBottom: 28, letterSpacing: 2, textAlign: 'center' }}>올해 자주 찾은 감독</div>
      {data.top_directors.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#555', fontSize: 15 }}>감독 정보가 없는 작품이 많습니다</div>
      ) : (
        data.top_directors.map((d, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
            padding: '14px 20px', background: 'rgba(255,255,255,.04)',
            borderRadius: 12, width: '100%', maxWidth: 340,
            borderLeft: i === 0 ? `4px solid ${theme.accent}` : '4px solid #333'
          }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: i === 0 ? theme.accent : '#555', width: 32 }}>
              {i + 1}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{d.name}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{d.count}편 감상</div>
            </div>
          </div>
        ))
      )}
      {data.top_decades.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 13, color: '#555', textAlign: 'center' }}>
          선호 연대: {data.top_decades[0].decade}년대 ({data.top_decades[0].count}편)
        </div>
      )}
    </div>,

    /* 슬라이드 7: 작년 대비 */
    <div key="yoy" className="yir-slide-content" style={{ justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: 14, color: '#888', marginBottom: 28, letterSpacing: 2 }}>작년과 비교하면</div>
      <div style={{ display: 'flex', gap: 32, justifyContent: 'center' }}>
        {/* 작년 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>{parseInt(year) - 1}년</div>
          <div style={{ fontSize: 52, fontWeight: 700, color: '#555' }}>{data.prev_year_count}</div>
          <div style={{ fontSize: 13, color: '#555' }}>편</div>
          {data.prev_year_avg_rating && (
            <div style={{ fontSize: 13, color: '#555', marginTop: 8 }}>★{data.prev_year_avg_rating}</div>
          )}
        </div>

        {/* 화살표 */}
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 28, color: '#444' }}>→</div>

        {/* 올해 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: theme.accent, marginBottom: 8 }}>{year}년</div>
          <div style={{ fontSize: 52, fontWeight: 700, color: theme.accent }}>{data.total_count}</div>
          <div style={{ fontSize: 13, color: theme.accent }}>편</div>
          {data.avg_rating && (
            <div style={{ fontSize: 13, color: theme.accent, marginTop: 8 }}>★{data.avg_rating}</div>
          )}
        </div>
      </div>

      {/* 증감 메시지 */}
      <div style={{ marginTop: 28, fontSize: 16, color: '#aaa' }}>
        {data.total_count > data.prev_year_count
          ? `작년보다 ${data.total_count - data.prev_year_count}편 더 봤어요! 🎉`
          : data.total_count < data.prev_year_count
          ? `작년보다 ${data.prev_year_count - data.total_count}편 적게 봤어요`
          : '작년과 똑같은 수를 봤어요'
        }
      </div>
    </div>,

    /* 슬라이드 8: 아웃트로 */
    <div key="outro" className="yir-slide-content" style={{ justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 20 }}>🎬</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
        {year}년도 수고했어요
      </div>
      <div style={{ fontSize: 16, color: '#888', lineHeight: 1.7, maxWidth: 280 }}>
        {data.total_count}편의 작품을 함께한<br />
        소중한 한 해였습니다
      </div>
      <div style={{ marginTop: 32, fontSize: 12, color: '#444', letterSpacing: 2 }}>
        media-diary.app
      </div>
      <button
        onClick={() => navigate('/')}
        style={{
          marginTop: 32, padding: '10px 24px', borderRadius: 10,
          border: `1px solid ${theme.accent}`, background: 'transparent',
          color: theme.accent, cursor: 'pointer', fontSize: 14,
        }}
      >
        홈으로 돌아가기
      </button>
    </div>,
  ];

  return (
    <div className="yir-container" style={{ background: theme.bg }}>
      {/* 슬라이드 영역 */}
      <div
        ref={slideRef}
        className="yir-slide"
        style={{ background: theme.bg }}
        data-watermark={`media-diary / ${year}`}
      >
        {/* 상단 진행 바 */}
        <div className="yir-progress">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <div
              key={i}
              className="yir-progress-bar"
              style={{ background: i <= slide ? theme.accent : '#333' }}
              onClick={() => setSlide(i)}
            />
          ))}
        </div>

        {/* 슬라이드 콘텐츠 */}
        <div className="yir-content-wrap">
          {slides[slide]}
        </div>

        {/* 하단 인디케이터 + 워터마크 */}
        <div className="yir-footer">
          <span style={{ fontSize: 11, color: '#444' }}>media-diary · {year}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: totalSlides }).map((_, i) => (
              <div
                key={i}
                onClick={() => setSlide(i)}
                style={{
                  width: i === slide ? 18 : 6, height: 6, borderRadius: 3,
                  background: i === slide ? theme.accent : '#333',
                  cursor: 'pointer', transition: 'all .2s',
                }}
              />
            ))}
          </div>
          <span style={{ fontSize: 11, color: '#444' }}>{slide + 1}/{totalSlides}</span>
        </div>
      </div>

      {/* 외부 컨트롤 (캡처 영역 밖) */}
      <div className="yir-controls">
        <button className="yir-nav-btn" onClick={prevSlide} disabled={slide === 0}>←</button>

        <button
          className="yir-save-btn"
          onClick={handleSaveImage}
          disabled={saving}
          title="현재 슬라이드를 이미지로 저장"
        >
          {saving ? '저장 중...' : '이미지 저장'}
        </button>

        <button className="yir-nav-btn" onClick={nextSlide} disabled={slide === totalSlides - 1}>→</button>
      </div>
    </div>
  );
}
