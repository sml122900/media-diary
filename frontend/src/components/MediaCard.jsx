/**
 * @file MediaCard.jsx
 * 미디어 항목 카드 컴포넌트 — 그리드에서 사용
 */

/**
 * @param {{ item: object, posterUrl: string, onClick: Function }} props
 */
export default function MediaCard({ item, posterUrl, onClick }) {
  const hasReview = item.rating > 0 || item.review_text;
  return (
    <div className="card" onClick={onClick}>
      <div className="poster">
        {posterUrl && (
          <img
            src={posterUrl}
            alt={item.title}
            loading="lazy"
            onError={e => { e.target.style.display = 'none'; }}
          />
        )}
        <span className="poster-ph">🎬</span>
        {hasReview && <div className="badge-dot" />}
      </div>
      <div className="card-body">
        <div className="card-title">{item.title}</div>
        <div className="card-sub">{item.year}{item.director ? ' · ' + item.director : ''}</div>
        {item.rating > 0 && <div className="card-stars">{'★'.repeat(item.rating)}</div>}
      </div>
    </div>
  );
}
