/**
 * @file ReportsCustomizePage.jsx
 * 리포트 템플릿 커스터마이징 페이지 (/reports/customize) — Phase 10.6
 * 16개 항목 체크박스 선택 + AI 자동 선택 + 템플릿 저장
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import InsufficientTokensModal from '../components/InsufficientTokensModal';
import useTokenStore from '../store/tokenStore';

const BASE = import.meta.env.VITE_API_URL;
const h = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

export default function ReportsCustomizePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit'); // 수정 모드: 기존 템플릿 ID

  const { balance, setBalance } = useTokenStore();

  const [components, setComponents]   = useState([]);   // 16개 항목 정의
  const [selected, setSelected]       = useState(new Set(['basic_count','avg_rating','top_genres','best_of_month']));
  const [name, setName]               = useState('');
  const [saving, setSaving]           = useState(false);
  const [message, setMessage]         = useState('');

  const [aiInput, setAiInput]         = useState('');
  const [aiLoading, setAiLoading]     = useState(false);
  const [tokenError, setTokenError]   = useState(null);

  // 항목 목록 로딩
  useEffect(() => {
    axios.get(`${BASE}/api/reports/components`, { headers: h() })
      .then(res => setComponents(res.data.data || []))
      .catch(() => {});
  }, []);

  // 수정 모드: 기존 템플릿 로딩
  useEffect(() => {
    if (!editId) return;
    axios.get(`${BASE}/api/reports/templates`, { headers: h() })
      .then(res => {
        const tmpl = res.data.data?.find(t => String(t.id) === editId);
        if (tmpl) {
          setName(tmpl.name);
          setSelected(new Set(tmpl.components));
        }
      })
      .catch(() => {});
  }, [editId]);

  const toggle = (code) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  // 저장
  const handleSave = async () => {
    if (!name.trim()) { setMessage('템플릿 이름을 입력해주세요.'); return; }
    if (selected.size === 0) { setMessage('항목을 하나 이상 선택해주세요.'); return; }

    setSaving(true);
    setMessage('');
    try {
      if (editId) {
        await axios.put(`${BASE}/api/reports/templates/${editId}`,
          { name: name.trim(), components: [...selected] }, { headers: h() });
      } else {
        await axios.post(`${BASE}/api/reports/templates`,
          { name: name.trim(), components: [...selected] }, { headers: h() });
      }
      navigate('/reports');
    } catch (err) {
      setMessage(err.response?.data?.message || '저장에 실패했습니다.');
    }
    setSaving(false);
  };

  // AI 자동 선택
  const handleAiSelect = async () => {
    if (!aiInput.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const res = await axios.post(`${BASE}/api/reports/customize-chat`,
        { description: aiInput }, { headers: h() });
      const codes = res.data.data?.components || [];
      setSelected(new Set(codes));
      if (res.data.data?.token_balance !== undefined) setBalance(res.data.data.token_balance);
      setAiInput('');
    } catch (err) {
      if (err.response?.status === 402) setTokenError(err.response.data);
    }
    setAiLoading(false);
  };

  return (
    <div className="rc-page">
      <div className="rc-header">
        <button className="btn" onClick={() => navigate('/reports')}>← 돌아가기</button>
        <h2>{editId ? '템플릿 수정' : '새 템플릿 만들기'}</h2>
        <div className="rc-token">🪙 {balance ?? '···'}</div>
      </div>

      {/* AI 자동 선택 */}
      <div className="rc-ai-section">
        <div className="rc-ai-label">✨ AI로 항목 자동 선택 <span className="rc-cost">2토큰</span></div>
        <div className="rc-ai-row">
          <input
            className="rc-ai-input"
            value={aiInput}
            onChange={e => setAiInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAiSelect()}
            placeholder="예: 장르 변화에 집중한 리포트, 인생작 위주로, 패턴 분석 중심"
          />
          <button className="btn btn-primary rc-ai-btn" onClick={handleAiSelect} disabled={aiLoading || !aiInput.trim()}>
            {aiLoading ? '분석 중...' : '선택'}
          </button>
        </div>
      </div>

      {/* 항목 체크박스 그리드 */}
      <div className="rc-grid">
        {components.map(c => (
          <label key={c.code} className={`rc-item ${selected.has(c.code) ? 'checked' : ''}`}>
            <input
              type="checkbox"
              checked={selected.has(c.code)}
              onChange={() => toggle(c.code)}
            />
            <div className="rc-item-body">
              <div className="rc-item-name">{c.name}</div>
              <div className="rc-item-desc">{c.desc}</div>
            </div>
          </label>
        ))}
      </div>

      <div className="rc-count">{selected.size}개 선택됨</div>

      {/* 템플릿 저장 */}
      <div className="rc-save-section">
        <input
          className="rc-name-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="템플릿 이름 (예: 내 기본 리포트, 장르 분석 리포트)"
          maxLength={40}
        />
        {message && <p className="rc-error">{message}</p>}
        <button className="btn btn-primary rc-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : editId ? '수정 완료' : '템플릿 저장'}
        </button>
      </div>

      {tokenError && (
        <InsufficientTokensModal
          required={tokenError.required}
          balance={tokenError.balance}
          onClose={() => setTokenError(null)}
        />
      )}
    </div>
  );
}
