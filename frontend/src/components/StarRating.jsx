/**
 * @file StarRating.jsx
 * 별점 입력/표시 컴포넌트 (1~5점)
 */

import { useState } from 'react';

/**
 * @param {{ value: number, onChange: Function, readonly?: boolean }} props
 */
export default function StarRating({ value, onChange, readonly }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="stars-row">
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          className={`star ${n <= (hovered || value) ? 'on' : ''}`}
          onClick={() => !readonly && onChange(n)}
          onMouseEnter={() => !readonly && setHovered(n)}
          onMouseLeave={() => !readonly && setHovered(0)}
          style={{ cursor: readonly ? 'default' : 'pointer' }}
        >★</span>
      ))}
    </div>
  );
}
