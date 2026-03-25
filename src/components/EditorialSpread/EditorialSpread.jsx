'use client';

import { useState } from 'react';
import { useRevealAll } from '../../hooks/useReveal';
import { useViewCursor } from '../../hooks/useViewCursor';
import { getImageUrl, getImageSrcSet, getFallbackUrl, getAltText } from '../../utils/imageHelpers';
import './EditorialSpread.css';

const EditorialSpread = ({ photos, onPhotoClick }) => {
  useRevealAll('.ed-reveal');
  const [hovered, setHovered] = useState(null);
  const { containerRef, cursorRef } = useViewCursor();

  if (!photos || photos.length === 0) return null;

  return (
    <>
    <div className="view-cursor" ref={cursorRef}><span>VIEW</span></div>
    <div className="ed-grid ed-reveal" ref={containerRef}>
      {photos.map((photo, i) => (
        <article
          key={photo.id}
          className={`ed-card ${hovered === i ? 'is-active' : ''} ${hovered !== null && hovered !== i ? 'is-dimmed' : ''}`}
          style={{ '--idx': i }}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onPhotoClick(photo)}
        >
          <div className="ed-card-img">
            <img
              src={getImageUrl(photo, 'display')}
              srcSet={getImageSrcSet(photo)}
              sizes={i === 0 ? '(max-width: 768px) 90vw, 55vw' : '(max-width: 768px) 90vw, 28vw'}
              alt={getAltText(photo)}
              loading="lazy"
              onError={(e) => { e.target.srcset = ''; e.target.src = getFallbackUrl(photo); }}
            />
            <div className="ed-card-overlay" />
          </div>

          <div className="ed-card-content">
            <div className="ed-card-text">
              <h3 className="ed-card-title">{photo.title}</h3>
              <span className="ed-card-cat mono">{photo.category}</span>
            </div>
            <span className="ed-card-line" />
          </div>

          <span className="ed-card-tag mono">FEATURED</span>
        </article>
      ))}
    </div>
    </>
  );
};

export default EditorialSpread;
