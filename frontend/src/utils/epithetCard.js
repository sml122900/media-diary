/**
 * @file epithetCard.js
 * "나의 인생영화들" 공유 카드 렌더러 (Phase 13.2) — Canvas API로 1080x1920 PNG 생성
 * html2canvas 등 외부 의존성 없이 직접 그린다. 다크 팔레트는 index.css [data-theme="dark"] 값 재사용.
 */

const W = 1080;
const H = 1920;

const COLOR_BG = '#111';
const COLOR_ROW_BG = '#1c1c1c';
const COLOR_ROW_BORDER = '#2e2e2e';
const COLOR_TEXT = '#e8e8e8';
const COLOR_TEXT_MUTED = '#999';
const COLOR_POSTER_PLACEHOLDER = '#2a2a2a';
const COLOR_WATERMARK = '#666';
const COLOR_BADGE_BG = 'rgba(0,0,0,.7)';
const COLOR_BADGE_TEXT = '#fff';

const FONT_STACK = '"Noto Sans KR", "Malgun Gothic", -apple-system, sans-serif';

/** 텍스트를 maxWidth에 맞춰 말줄임(…) — 문자 단위 이진탐색이라 한글/영문 공용 */
function truncateToWidth(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = '…';
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid) + ellipsis).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + ellipsis;
}

/** 최대 maxLines줄까지 문자 단위로 줄바꿈, 넘치면 마지막 줄에 말줄임 */
function wrapLines(ctx, text, maxWidth, maxLines) {
  const lines = [];
  let remaining = text;
  while (remaining && lines.length < maxLines) {
    if (ctx.measureText(remaining).width <= maxWidth) { lines.push(remaining); remaining = ''; break; }
    let lo = 1, hi = remaining.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (ctx.measureText(remaining.slice(0, mid)).width <= maxWidth) lo = mid; else hi = mid - 1;
    }
    lines.push(remaining.slice(0, lo));
    remaining = remaining.slice(lo);
  }
  if (remaining) lines.push(truncateToWidth(ctx, lines.pop() + remaining, maxWidth));
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** object-fit: cover로 이미지를 대상 영역에 그린다 */
function drawCover(ctx, img, dx, dy, dw, dh) {
  const ir = img.width / img.height;
  const dr = dw / dh;
  let sx, sy, sw, sh;
  if (ir > dr) { sh = img.height; sw = sh * dr; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = sw / dr; sx = 0; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/**
 * 포스터 로드 + taint(오염) 여부 확인. crossOrigin="anonymous"로 받아도
 * 서버가 CORS 헤더를 안 주면 drawImage 자체는 성공하지만 이후 toBlob에서
 * SecurityError가 난다 — 그러면 카드 전체가 실패하므로, 작은 오프스크린
 * 캔버스에 먼저 그려 getImageData로 오염 여부를 개별 확인한다.
 *
 * TMDB(image.tmdb.org)는 실제로 Access-Control-Allow-Origin을 보내지만,
 * 같은 포스터가 앱 다른 화면에서 이미 crossOrigin 없이 <img>로 로드된 적
 * 있으면 브라우저가 그 오염된 캐시 항목을 재사용해 crossOrigin 요청이
 * 실패한다(실측 확인). 캐시 키를 분리하는 더미 쿼리 파라미터로 우회.
 * @returns {Promise<HTMLImageElement|null>} 실패 시 null (호출부가 폴백 타일 처리)
 */
function loadPosterSafe(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const test = document.createElement('canvas');
        test.width = 2; test.height = 2;
        const tctx = test.getContext('2d');
        tctx.drawImage(img, 0, 0, 2, 2);
        tctx.getImageData(0, 0, 1, 1);
        resolve(img);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url + (url.includes('?') ? '&' : '?') + '_cors=1';
  });
}

/** 포스터 대신 그리는 제목 텍스트 타일 (이미지 없음/로드 실패 공용) */
function drawFallbackTile(ctx, x, y, w, h, title) {
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = COLOR_POSTER_PLACEHOLDER;
  ctx.fill();

  const fontSize = Math.max(14, Math.round(w * 0.14));
  ctx.font = `600 ${fontSize}px ${FONT_STACK}`;
  ctx.fillStyle = COLOR_TEXT_MUTED;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = wrapLines(ctx, title || '', w - 16, 3);
  const lineHeight = fontSize * 1.3;
  const startY = y + h / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, x + w / 2, startY + i * lineHeight));
}

/**
 * 수식어 카드 이미지 생성
 * @param {Array<{id:number,label:string,emoji:string|null,items:Array}>} epithets - 선택된 3~6개, 각 items[0]=대표작
 * @param {string} [displayName] - 카드 상단에 쓸 표시명 (없으면 "나의 인생영화들")
 * @returns {Promise<Blob>} image/png blob
 */
export async function renderEpithetCard(epithets, displayName) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 배경
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, W, H);

  const sideMargin = 64;
  const headerHeight = 220;
  const footerHeight = 100;

  // 헤더 타이틀
  const title = displayName ? `${displayName}의 인생영화들` : '나의 인생영화들';
  ctx.font = `700 52px ${FONT_STACK}`;
  ctx.fillStyle = COLOR_TEXT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(truncateToWidth(ctx, title, W - sideMargin * 2), sideMargin, headerHeight - 40);

  // 대표작 포스터 병렬 로드 (개별 실패가 전체를 막지 않도록 Promise.all + 각자 null 폴백)
  const posters = await Promise.all(
    epithets.map(ep => loadPosterSafe(ep.items[0]?.poster_url))
  );

  // 본문 — 부문 행
  const n = epithets.length;
  const bodyTop = headerHeight;
  const bodyBottom = H - footerHeight;
  const rowGap = 24;
  const rowHeight = (bodyBottom - bodyTop - rowGap * (n - 1)) / n;
  const rowPadding = 20;
  const posterHeight = rowHeight - rowPadding * 2;
  const posterWidth = posterHeight * (2 / 3);

  const labelFontSize = Math.max(22, Math.min(40, Math.round(rowHeight * 0.15)));
  const metaFontSize = Math.round(labelFontSize * 0.6);
  const badgeFontSize = Math.round(metaFontSize * 0.85);

  epithets.forEach((ep, i) => {
    const rowY = bodyTop + i * (rowHeight + rowGap);
    const rep = ep.items[0];
    const img = posters[i];

    // 행 배경
    roundRect(ctx, sideMargin, rowY, W - sideMargin * 2, rowHeight, 16);
    ctx.fillStyle = COLOR_ROW_BG;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLOR_ROW_BORDER;
    ctx.stroke();

    // 포스터 (또는 폴백 타일)
    const posterX = sideMargin + rowPadding;
    const posterY = rowY + rowPadding;
    if (img) {
      ctx.save();
      roundRect(ctx, posterX, posterY, posterWidth, posterHeight, 10);
      ctx.clip();
      drawCover(ctx, img, posterX, posterY, posterWidth, posterHeight);
      ctx.restore();
    } else {
      drawFallbackTile(ctx, posterX, posterY, posterWidth, posterHeight, rep?.title);
    }

    // N회 관람 배지 (포스터 좌하단 오버레이)
    if (rep?.max_rewatch_count >= 2) {
      const badgeText = `${rep.max_rewatch_count}회 관람`;
      ctx.font = `700 ${badgeFontSize}px ${FONT_STACK}`;
      const badgeW = ctx.measureText(badgeText).width + 20;
      const badgeH = badgeFontSize + 14;
      const badgeX = posterX + 8;
      const badgeY = posterY + posterHeight - badgeH - 8;
      roundRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
      ctx.fillStyle = COLOR_BADGE_BG;
      ctx.fill();
      ctx.fillStyle = COLOR_BADGE_TEXT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, badgeX + 10, badgeY + badgeH / 2 + 1);
    }

    // 텍스트 영역 (포스터 오른쪽)
    const textX = posterX + posterWidth + 28;
    const textMaxWidth = sideMargin + (W - sideMargin * 2) - rowPadding - textX;

    const labelLine = `${ep.emoji || ''} ${ep.label}`.trim();
    ctx.font = `700 ${labelFontSize}px ${FONT_STACK}`;
    ctx.fillStyle = COLOR_TEXT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const labelY = rowY + rowHeight / 2 - metaFontSize * 0.6;
    ctx.fillText(truncateToWidth(ctx, labelLine, textMaxWidth), textX, labelY);

    if (rep) {
      const metaLine = `${rep.title}${rep.year ? ` · ${rep.year}` : ''}`;
      ctx.font = `500 ${metaFontSize}px ${FONT_STACK}`;
      ctx.fillStyle = COLOR_TEXT_MUTED;
      const metaY = labelY + metaFontSize * 1.7;
      ctx.fillText(truncateToWidth(ctx, metaLine, textMaxWidth), textX, metaY);
    }
  });

  // 하단 워터마크
  ctx.font = `600 24px ${FONT_STACK}`;
  ctx.fillStyle = COLOR_WATERMARK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('미디어 다이어리', W / 2, H - 44);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}
