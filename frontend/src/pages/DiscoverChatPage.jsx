/**
 * @file DiscoverChatPage.jsx
 * AI 채팅형 작품 추천 페이지 (/discover/chat) — Phase 10.5
 * 큐레이터 AI와 대화하며 딱 맞는 작품을 찾아가는 인터페이스
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import InsufficientTokensModal from '../components/InsufficientTokensModal';
import useTokenStore from '../store/tokenStore';

const BASE = import.meta.env.VITE_API_URL;
const h    = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const IMG  = 'https://image.tmdb.org/t/p/w200';

// 빈 화면 예시 질문
const STARTERS = [
  '오늘 기분 전환하고 싶어, 뭐가 좋을까?',
  '잔잔한 일본 영화 추천해줘',
  '최근에 본 기생충 같은 거 더 없어?',
  '비 오는 날 어울리는 작품 알려줘',
  '요즘 K-드라마 뭐가 좋아?',
  '클래식 SF 영화 모르는 거 찾고 싶어',
];

/** 추천 작품 카드 */
function WorkCard({ work }) {
  const [listState, setListState] = useState('idle');
  const [wishState, setWishState] = useState('idle');

  const addToList = async () => {
    if (listState !== 'idle') return;
    setListState('adding');
    try {
      await axios.post(`${BASE}/api/user-media`, {
        type: work.media_type || 'movie',
        title: work.title, year: work.year,
        tmdb_id: work.tmdb_id, poster_url: work.poster_path ? `${IMG}${work.poster_path}` : '',
        director: '', cast_info: '',
      }, { headers: h() });
      setListState('done');
    } catch { setListState('idle'); }
  };

  const addToWish = async () => {
    if (wishState !== 'idle') return;
    setWishState('adding');
    try {
      await axios.post(`${BASE}/api/me/watchlist`, {
        type: work.media_type || 'movie',
        title: work.title, year: work.year,
        tmdb_id: work.tmdb_id,
        poster_url: work.poster_path ? `${IMG}${work.poster_path}` : '',
      }, { headers: h() });
      setWishState('done');
    } catch { setWishState('idle'); }
  };

  return (
    <div className="dc-work-card">
      <div className="dc-work-poster">
        {work.poster_path
          ? <img src={`${IMG}${work.poster_path}`} alt={work.title} loading="lazy" />
          : <span style={{ fontSize: 28, opacity: .2 }}>🎬</span>
        }
      </div>
      <div className="dc-work-info">
        <div className="dc-work-title">{work.title}</div>
        <div className="dc-work-year">{work.year || ''}</div>
        {work.reason && <div className="dc-work-reason">{work.reason}</div>}
        <div className="dc-work-actions">
          <button className={`dc-btn-list ${listState === 'done' ? 'done' : ''}`}
            onClick={addToList} disabled={listState !== 'idle'}>
            {listState === 'done' ? '✓ 추가됨' : listState === 'adding' ? '...' : '+ 내 목록'}
          </button>
          <button className={`dc-btn-wish ${wishState === 'done' ? 'done' : ''}`}
            onClick={addToWish} disabled={wishState !== 'idle'}>
            {wishState === 'done' ? '✓ 저장' : '🔖'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** AI 응답 버블 (추천 카드 포함) */
function AssistantBubble({ msg }) {
  const works = msg.suggested_works || [];
  return (
    <div className="dc-bubble-wrap dc-bubble-ai">
      <div className="dc-avatar">🎬</div>
      <div className="dc-bubble-body">
        <div className="dc-bubble dc-bubble-left">{msg.content}</div>
        {works.length > 0 && (
          <div className="dc-works-grid">
            {works.map((w, i) => <WorkCard key={`${w.tmdb_id}-${i}`} work={w} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/** 사용자 메시지 버블 */
function UserBubble({ content }) {
  return (
    <div className="dc-bubble-wrap dc-bubble-user">
      <div className="dc-bubble dc-bubble-right">{content}</div>
    </div>
  );
}

export default function DiscoverChatPage() {
  const navigate = useNavigate();
  const { balance, setBalance } = useTokenStore();

  const [sessionId, setSessionId]   = useState(() => crypto.randomUUID());
  const [sessions, setSessions]     = useState([]);
  const [messages, setMessages]     = useState([]);   // { role, content, suggested_works }
  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [histLoading, setHistLoading] = useState(false);
  const [tokenError, setTokenError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // 세션 목록 로딩
  useEffect(() => {
    axios.get(`${BASE}/api/discover/sessions`, { headers: h() })
      .then(res => setSessions(res.data.data || []))
      .catch(() => {});
  }, []);

  // 새 메시지마다 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 세션 전환 — 해당 세션 이력 로드
  const loadSession = useCallback(async (sid) => {
    if (sid === sessionId && messages.length > 0) return;
    setHistLoading(true);
    setSidebarOpen(false);
    try {
      const res = await axios.get(`${BASE}/api/discover/history`, {
        params: { sessionId: sid }, headers: h(),
      });
      setSessionId(sid);
      setMessages(res.data.data || []);
    } catch {}
    setHistLoading(false);
  }, [sessionId, messages.length]);

  // 새 대화 시작
  const newSession = () => {
    setSessionId(crypto.randomUUID());
    setMessages([]);
    setSidebarOpen(false);
    inputRef.current?.focus();
  };

  // 메시지 전송
  const sendMessage = useCallback(async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post(`${BASE}/api/discover/chat`,
        { message: trimmed, sessionId },
        { headers: h() }
      );
      const { message: aiMsg, works, sessionId: returnedId, token_balance } = res.data.data;

      // 서버가 새 sessionId 발급한 경우 반영
      if (returnedId !== sessionId) setSessionId(returnedId);

      setMessages(prev => [...prev, {
        role: 'assistant', content: aiMsg, suggested_works: works,
      }]);
      if (token_balance !== undefined) setBalance(token_balance);

      // 세션 목록 갱신 (새 세션이면 prepend)
      setSessions(prev => {
        const exists = prev.find(s => s.session_id === (returnedId || sessionId));
        if (exists) return prev;
        return [{
          session_id: returnedId || sessionId,
          preview: trimmed,
          created_at: new Date().toISOString(),
        }, ...prev];
      });
    } catch (err) {
      if (err.response?.status === 402) {
        setTokenError(err.response.data);
        // 낙관적으로 추가한 user 버블 제거
        setMessages(prev => prev.slice(0, -1));
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '오류가 발생했습니다. 다시 시도해주세요.',
          suggested_works: [],
        }]);
      }
    }

    setLoading(false);
    inputRef.current?.focus();
  }, [input, loading, sessionId, setBalance]);

  const isEmpty = messages.length === 0 && !histLoading;

  return (
    <div className="dc-layout">
      {/* ── 세션 사이드바 ── */}
      <aside className={`dc-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="dc-sidebar-header">
          <button className="btn btn-primary dc-new-btn" onClick={newSession}>
            + 새 대화
          </button>
          <button className="dc-sidebar-close" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        <div className="dc-session-list">
          {sessions.length === 0
            ? <div className="dc-session-empty">이전 대화 없음</div>
            : sessions.map(s => (
              <div
                key={s.session_id}
                className={`dc-session-item ${s.session_id === sessionId ? 'active' : ''}`}
                onClick={() => loadSession(s.session_id)}
              >
                <div className="dc-session-preview">
                  {s.preview?.slice(0, 36) || '대화'}
                </div>
                <div className="dc-session-date">
                  {new Date(s.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))
          }
        </div>
      </aside>

      {/* ── 사이드바 오버레이 (모바일) ── */}
      {sidebarOpen && <div className="dc-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ── 메인 채팅 영역 ── */}
      <div className="dc-main">
        {/* 헤더 */}
        <div className="dc-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="dc-sidebar-toggle" onClick={() => setSidebarOpen(v => !v)}>
              ☰
            </button>
            <button className="btn" onClick={() => navigate('/discover')} style={{ fontSize: 13 }}>
              ← 발견하기
            </button>
          </div>
          <div className="dc-header-title">🎬 AI 큐레이터</div>
          <div className="dc-header-token">🪙 {balance ?? '···'}</div>
        </div>

        {/* 메시지 영역 */}
        <div className="dc-messages">
          {histLoading && (
            <div className="dc-loading-msg">대화 불러오는 중...</div>
          )}

          {/* 빈 화면 — 예시 질문 */}
          {isEmpty && (
            <div className="dc-empty">
              <div className="dc-empty-icon">🎬</div>
              <h3 className="dc-empty-title">어떤 작품을 찾고 계세요?</h3>
              <p className="dc-empty-sub">
                기분·장르·상황을 자유롭게 말해보세요.<br />
                대화를 통해 딱 맞는 작품을 찾아드려요.
              </p>
              <div className="dc-starters">
                {STARTERS.map(s => (
                  <button key={s} className="dc-starter-btn" onClick={() => sendMessage(s)}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="dc-cost-note">🪙 2토큰/회</div>
            </div>
          )}

          {/* 메시지 목록 */}
          {messages.map((msg, i) =>
            msg.role === 'user'
              ? <UserBubble key={i} content={msg.content} />
              : <AssistantBubble key={i} msg={msg} />
          )}

          {/* 로딩 */}
          {loading && (
            <div className="dc-bubble-wrap dc-bubble-ai">
              <div className="dc-avatar">🎬</div>
              <div className="dc-bubble dc-bubble-left dc-typing">
                <span />  <span /> <span />
              </div>
            </div>
          )}

          <div ref={bottomRef} style={{ height: 16 }} />
        </div>

        {/* 입력창 */}
        <div className="dc-input-bar">
          <input
            ref={inputRef}
            className="dc-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="어떤 작품을 찾고 계신가요? (예: 오늘 기분에 맞는 영화)"
            disabled={loading}
          />
          <button
            className="dc-send-btn"
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            전송
          </button>
        </div>
      </div>

      {/* 토큰 부족 모달 */}
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
