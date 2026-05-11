/**
 * @file ReportsPage.jsx
 * 월간 취향 리포트 페이지 (/reports)
 * Claude AI가 감상 기록을 분석해서 마크다운 리포트를 생성
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';
import { useTheme } from '../hooks/useTheme';

const BASE = 'http://localhost:4000/api';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// YYYY-MM → "2026년 5월" 형식 변환
function periodLabel(period) {
  const [y, m] = period.split('-');
  return `${y}년 ${parseInt(m)}월`;
}

// 리포트 미리보기: 마크다운 기호 제거 후 앞 80자
function previewText(content) {
  return content
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^-\s*/gm, '')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 80) + '...';
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(null); // 현재 열린 리포트
  const [reportContent, setReportContent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  // 현재 연월 (기본 생성 대상)
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    axios.get(`${BASE}/me/reports`, { headers: headers() })
      .then(res => { setReports(res.data.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // 리포트 카드 클릭 — 상세 로드
  const openReport = async (period) => {
    if (selectedPeriod === period) { setSelectedPeriod(null); return; }
    setSelectedPeriod(period);
    try {
      const res = await axios.get(`${BASE}/me/reports/${period}`, { headers: headers() });
      setReportContent(res.data.data.content);
    } catch {
      setReportContent('리포트를 불러오지 못했습니다.');
    }
  };

  // 리포트 생성
  const handleGenerate = async () => {
    setGenerating(true);
    setGenError('');
    try {
      const res = await axios.post(
        `${BASE}/me/reports/generate`,
        { period: currentPeriod },
        { headers: headers() }
      );
      const report = res.data.data;
      // 목록 갱신 (이미 있으면 replace, 없으면 prepend)
      setReports(prev => {
        const idx = prev.findIndex(r => r.period === report.period);
        if (idx >= 0) { const next = [...prev]; next[idx] = report; return next; }
        return [report, ...prev];
      });
      setSelectedPeriod(report.period);
      setReportContent(report.content);
    } catch (err) {
      setGenError(err.response?.data?.message || '리포트 생성에 실패했습니다');
    }
    setGenerating(false);
  };

  const hasCurrentReport = reports.some(r => r.period === currentPeriod);

  return (
    <div className="mdb-container">
      {/* 헤더 */}
      <div className="mdb-header" style={{ marginBottom: 24 }}>
        <h1 className="mdb-title">취향 리포트</h1>
        <div className="mdb-controls">
          <button className="btn" onClick={toggleTheme}>{theme === 'dark' ? '라이트' : '다크'}</button>
          <button className="btn" onClick={() => navigate('/')}>← 돌아가기</button>
        </div>
      </div>

      {/* 리포트 생성 버튼 */}
      <div className="report-gen-bar">
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
            {periodLabel(currentPeriod)} 리포트
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {hasCurrentReport ? '이미 생성된 리포트가 있습니다. 다시 생성하면 덮어씁니다.' : 'Claude AI가 이달 감상 기록을 분석합니다'}
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={generating}
          style={{ whiteSpace: 'nowrap' }}
        >
          {generating ? '✨ 생성 중...' : hasCurrentReport ? '✨ 다시 생성' : '✨ 리포트 생성'}
        </button>
      </div>

      {/* 에러 */}
      {genError && (
        <div style={{
          fontSize: 13, color: '#c0392b', padding: '10px 14px',
          background: '#fdf0ef', border: '1px solid #e0b4b0', borderRadius: 10, marginBottom: 16
        }}>
          {genError}
        </div>
      )}

      {/* 생성 중 로딩 */}
      {generating && (
        <div style={{
          padding: '2rem', textAlign: 'center', fontSize: 14, color: '#888',
          background: '#f8f8f6', borderRadius: 12, marginBottom: 16, border: '1px solid #eee'
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>✨</div>
          Claude가 감상 기록을 분석하고 있습니다...
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>불러오는 중...</div>
      )}

      {/* 리포트 목록 */}
      {!loading && reports.length === 0 && !generating && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
          아직 리포트가 없습니다. 위 버튼으로 첫 리포트를 생성해보세요!
        </div>
      )}

      <div className="report-list">
        {reports.map(report => (
          <div key={report.period}>
            {/* 리포트 카드 */}
            <div
              className={`report-card ${selectedPeriod === report.period ? 'active' : ''}`}
              onClick={() => openReport(report.period)}
            >
              <div className="report-card-header">
                <div>
                  <div className="report-card-period">{periodLabel(report.period)}</div>
                  <div className="report-card-preview">{previewText(report.preview || report.content || '')}</div>
                </div>
                <span className="report-card-arrow">{selectedPeriod === report.period ? '▲' : '▼'}</span>
              </div>
              <div className="report-card-date">
                {new Date(report.created_at).toLocaleDateString('ko-KR')} 생성
              </div>
            </div>

            {/* 리포트 상세 (펼쳐지는 형태) */}
            {selectedPeriod === report.period && reportContent && (
              <div className="report-content">
                <ReactMarkdown>{reportContent}</ReactMarkdown>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
