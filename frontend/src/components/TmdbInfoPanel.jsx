/**
 * @file TmdbInfoPanel.jsx
 * TMDB 정보 표시 패널 — 런타임, 장르, OTT 스트리밍, 줄거리
 */

import { IMG_ORIG } from '../utils/constants';

/** OTT 제공사 로고 한 행 */
function ProviderRow({ list, label }) {
  if (!list.length) return null;
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ fontSize: 11, color: '#aaa', fontWeight: 500, marginRight: 6 }}>{label}</span>
      {list.map(pr => (
        <img
          key={pr.name}
          src={IMG_ORIG + pr.logo}
          alt={pr.name}
          title={pr.name}
          style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', marginRight: 4, verticalAlign: 'middle' }}
          onError={e => e.target.remove()}
        />
      ))}
    </div>
  );
}

/**
 * TMDB 세부 정보 패널
 * @param {{ detail: object|null }} props
 */
export default function TmdbInfoPanel({ detail }) {
  if (!detail) return null;
  const p = detail.providers || {};
  const hasProviders = p.flatrate?.length || p.rent?.length || p.buy?.length;

  return (
    <>
      {(detail.runtime || detail.score || detail.genres?.length > 0) && (
        <div className="tmdb-info">
          {detail.runtime && <span className="tmdb-badge">⏱ {detail.runtime}</span>}
          {detail.score && <span className="tmdb-score">★ {detail.score}</span>}
          {(detail.genres || []).map(g => <span key={g} className="tmdb-badge">{g}</span>)}
        </div>
      )}
      {hasProviders ? (
        <div className="ott-box">
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            📺 한국에서 보기
            {p.link && (
              <a href={p.link} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, fontWeight: 400, color: '#888', textDecoration: 'none' }}>
                TMDB에서 보기 ↗
              </a>
            )}
          </div>
          <ProviderRow list={p.flatrate || []} label="구독" />
          <ProviderRow list={p.rent || []} label="대여" />
          <ProviderRow list={p.buy || []} label="구매" />
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#bbb', marginBottom: 8 }}>🚫 한국 OTT 정보 없음</div>
      )}
      {detail.overview && (
        <div className="tmdb-overview">{detail.overview}</div>
      )}
    </>
  );
}
