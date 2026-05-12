/**
 * @file MemoryChatPage.jsx
 * AI 대화형 기억 복원 페이지 (/restore/chat) — Phase 6.2
 * Claude와 대화하며 과거에 본 작품을 찾아 일괄 추가
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const BASE = `${import.meta.env.VITE_API_URL}/api/restore`;
const IMG_BASE = 'https://image.tmdb.org/t/p/w200';
const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

// 채팅 빠른 시작 예시 질문
const STARTER_PROMPTS = [
  '마블 영화 거의 다 봤어요',
  '고등학생 때 봤던 한국 드라마가 기억 안 나요',
  '지브리 작품 좋아해요',
  '90년대 한국 영화 많이 봤어요',
  '넷플릭스 오리지널 드라마 몇 개 봤어요',
  '일본 애니메이션 좋아해요 (성인 취향)',
];

/** AI 제안 작품 카드 */
function WorkCard({ work, selected, onToggle }) {
  const hasPoster = !!work.poster_path;
  return (
    <div
      onClick={() => onToggle(work)}
      style={{
        cursor: 'pointer', borderRadius: 8, overflow: 'hidden',
        border: selected ? '3px solid #1565C0' : '2px solid transparent',
        background: hasPoster ? '#000' : '#3949AB',
        position: 'relative', aspectRatio: '2/3',
        transition: 'transform .15s, border-color .15s',
        transform: selected ? 'scale(1.04)' : 'scale(1)',
      }}
    >
      {hasPoster ? (
        <img
          src={`${IMG_BASE}${work.poster_path}`}
          alt={work.title}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 6 }}>
          <div style={{ fontSize: 10, color: '#fff', textAlign: 'center', lineHeight: 1.3, fontWeight: 600 }}>
            {work.title}
          </div>
          {work.year && <div style={{ fontSize: 9, color: 'rgba(255,255,255,.7)', marginTop: 2 }}>{work.year}</div>}
        </div>
      )}

      {/* 선택 체크 */}
      {selected && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(21,101,192,.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1565C0',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14 }}>
            ✓
          </div>
        </div>
      )}

      {/* 하단 제목 (포스터 있을 때) */}
      {hasPoster && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,.85))',
          padding: '14px 5px 5px', color: '#fff', fontSize: 9, textAlign: 'center', lineHeight: 1.3 }}>
          {work.title}<br />
          <span style={{ color: 'rgba(255,255,255,.7)' }}>{work.year}</span>
        </div>
      )}
    </div>
  );
}

/** AI 메시지 버블 (작품 카드 포함) */
function AssistantBubble({ msg, onAccept }) {
  const [selected, setSelected] = useState(new Set());
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState(false);

  const toggle = useCallback((work) => {
    setSelected(prev => {
      const next = new Set(prev);
      const key = work.tmdb_id || work.title;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const works = msg.suggested_works || [];
  const isSelected = (w) => selected.has(w.tmdb_id || w.title);

  const handleAccept = async () => {
    const toAdd = works.filter(w => isSelected(w));
    if (!toAdd.length) return;
    setAdding(true);
    await onAccept(toAdd);
    setAdding(false);
    setDone(true);
    setSelected(new Set());
  };

  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'flex-start' }}>
      {/* AI 아바타 */}
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1565C0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, flexShrink: 0, marginTop: 2 }}>
        🤖
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 말풍선 */}
        <div style={{ background: 'var(--card-bg, #f5f5f5)',
          border: '1px solid var(--border-color, #e0e0e0)',
          borderRadius: '0 12px 12px 12px', padding: '12px 14px',
          fontSize: 14, color: 'var(--text-primary, #111)', lineHeight: 1.6,
          marginBottom: works.length ? 10 : 0, whiteSpace: 'pre-wrap' }}>
          {msg.content}
        </div>

        {/* 작품 카드 그리드 */}
        {works.length > 0 && (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
              gap: 8, marginBottom: 10,
            }}>
              {works.map((w, i) => (
                <WorkCard
                  key={`${w.tmdb_id || w.title}-${i}`}
                  work={w}
                  selected={isSelected(w)}
                  onToggle={toggle}
                />
              ))}
            </div>

            {/* 추가 버튼 */}
            {!done ? (
              <button
                onClick={handleAccept}
                disabled={selected.size === 0 || adding}
                style={{
                  padding: '8px 18px', fontSize: 13, fontWeight: 700, borderRadius: 8,
                  border: 'none', cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
                  background: selected.size > 0 ? '#1565C0' : '#ccc',
                  color: '#fff', transition: 'background .15s',
                }}
              >
                {adding ? '추가 중...' : selected.size > 0 ? `${selected.size}개 내 목록에 추가` : '작품을 선택하세요'}
              </button>
            ) : (
              <div style={{ fontSize: 13, color: '#4CAF50', fontWeight: 600 }}>✓ 추가 완료</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** 사용자 메시지 버블 */
function UserBubble({ content }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
      <div style={{
        background: '#1565C0', color: '#fff',
        borderRadius: '12px 0 12px 12px', padding: '10px 14px',
        fontSize: 14, maxWidth: '75%', lineHeight: 1.5,
      }}>
        {content}
      </div>
    </div>
  );
}

export default function MemoryChatPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);   // { role, content, suggested_works }
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [remaining, setRemaining] = useState(30);
  const [toast, setToast] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // 히스토리 로드
  useEffect(() => {
    fetch(`${BASE}/chat/history`, { headers: headers() })
      .then(r => r.json())
      .then(json => {
        if (json.success) setMessages(json.data);
      })
      .finally(() => setHistoryLoading(false));
  }, []);

  // 새 메시지 시 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const sendMessage = useCallback(async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    // 사용자 메시지 즉시 표시
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${BASE}/chat`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ message: trimmed }),
      });
      const json = await res.json();

      if (json.success) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: json.data.message,
          suggested_works: json.data.works,
        }]);
        setRemaining(json.data.remaining);
      } else if (res.status === 429) {
        showToast(json.message);
      } else {
        showToast('오류가 발생했습니다. 다시 시도해주세요.');
      }
    } catch (e) {
      showToast('네트워크 오류: ' + e.message);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, showToast]);

  const handleAccept = useCallback(async (works) => {
    try {
      const res = await fetch(`${BASE}/chat/accept`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ works }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`${json.data.added}개 추가됨${json.data.skipped > 0 ? ` (${json.data.skipped}개 중복)` : ''}`);
      }
    } catch (e) {
      showToast('추가 오류: ' + e.message);
    }
  }, [showToast]);

  const handleClearHistory = async () => {
    if (!confirm('대화 기록을 모두 삭제할까요?')) return;
    await fetch(`${BASE}/chat/history`, { method: 'DELETE', headers: headers() });
    setMessages([]);
  };

  const isEmpty = !historyLoading && messages.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh',
      maxWidth: 700, margin: '0 auto' }}>

      {/* 상단 헤더 */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-color, #e0e0e0)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--card-bg, #fff)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/restore')}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary, #666)', fontSize: 14, padding: 0 }}>
            ←
          </button>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary, #111)' }}>
              🤖 AI 기억 복원
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary, #888)' }}>
              오늘 남은 횟수: {remaining}회
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={handleClearHistory}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: '#999', fontSize: 12 }}>
            기록 삭제
          </button>
        )}
      </div>

      {/* 메시지 영역 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0' }}>

        {historyLoading && (
          <div style={{ textAlign: 'center', color: '#888', fontSize: 13, paddingTop: 40 }}>
            불러오는 중...
          </div>
        )}

        {/* 빈 화면 — 예시 질문 */}
        {isEmpty && (
          <div style={{ paddingTop: 20 }}>
            <div style={{ textAlign: 'center', fontSize: 32, marginBottom: 12 }}>🎬</div>
            <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 700,
              color: 'var(--text-primary, #111)', marginBottom: 6 }}>
              과거에 본 작품이 기억 안 나세요?
            </div>
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary, #888)',
              marginBottom: 24, lineHeight: 1.5 }}>
              막연하게 말해도 괜찮아요.<br />AI가 구체적인 작품 후보를 찾아드립니다.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {STARTER_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  style={{
                    padding: '10px 12px', fontSize: 13, textAlign: 'left',
                    background: 'var(--card-bg, #f5f5f5)',
                    border: '1px solid var(--border-color, #e0e0e0)',
                    borderRadius: 10, cursor: 'pointer',
                    color: 'var(--text-primary, #333)', lineHeight: 1.4,
                    transition: 'background .1s',
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 메시지 목록 */}
        {messages.map((msg, i) => (
          msg.role === 'user'
            ? <UserBubble key={i} content={msg.content} />
            : <AssistantBubble key={i} msg={msg} onAccept={handleAccept} />
        ))}

        {/* 로딩 인디케이터 */}
        {loading && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-start' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1565C0',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
              🤖
            </div>
            <div style={{ background: 'var(--card-bg, #f5f5f5)',
              border: '1px solid var(--border-color, #e0e0e0)',
              borderRadius: '0 12px 12px 12px', padding: '12px 14px', fontSize: 13,
              color: '#888', display: 'flex', gap: 4, alignItems: 'center' }}>
              <span>작품 찾는 중</span>
              <span style={{ animation: 'pulse 1s infinite' }}>...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} style={{ height: 16 }} />
      </div>

      {/* 입력창 */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color, #e0e0e0)',
        background: 'var(--card-bg, #fff)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="기억나는 것을 자유롭게 말해보세요... (예: 90년대 SF 영화)"
            disabled={loading}
            style={{
              flex: 1, padding: '10px 14px', fontSize: 14,
              border: '1px solid var(--border-color, #ddd)', borderRadius: 22,
              background: 'transparent', color: 'inherit', fontFamily: 'inherit', outline: 'none',
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            style={{
              padding: '10px 18px', fontSize: 14, fontWeight: 700,
              background: input.trim() && !loading ? '#1565C0' : '#ccc',
              color: '#fff', border: 'none', borderRadius: 22, cursor: 'pointer',
              transition: 'background .15s', flexShrink: 0,
            }}
          >
            전송
          </button>
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#323232', color: '#fff', padding: '10px 20px', borderRadius: 20,
          fontSize: 13, zIndex: 9999, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,.3)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
