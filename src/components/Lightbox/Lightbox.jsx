'use client';

import { useEffect, useCallback } from 'react';
import { getImageUrl, getImageSrcSet, getFallbackUrl, getAltText } from '../../utils/imageHelpers';
import './Lightbox.css';

const Lightbox = ({ photo, photos, onClose, onNavigate }) => {
  if (!photo || !photos || photos.length === 0) return null;
  const idx = photos.findIndex(p => p.id === photo.id);

  const prev = useCallback(() => { if (idx > 0) onNavigate(photos[idx - 1]); }, [idx, photos, onNavigate]);
  const next = useCallback(() => { if (idx < photos.length - 1) onNavigate(photos[idx + 1]); }, [idx, photos, onNavigate]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose, prev, next]);

  return (
    <div className="lb" onClick={(e) => e.target.classList.contains('lb') && onClose()} role="dialog" aria-label="Photo viewer">
      {/* Close */}
      <button className="lb-close" onClick={onClose} aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.2">
          <line x1="16" y1="4" x2="4" y2="16" /><line x1="4" y1="4" x2="16" y2="16" />
        </svg>
      </button>

      {/* Nav */}
      {idx > 0 && (
        <button className="lb-nav lb-prev" onClick={prev} aria-label="Previous">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <polyline points="16 4 8 12 16 20" />
          </svg>
        </button>
      )}
      {idx < photos.length - 1 && (
        <button className="lb-nav lb-next" onClick={next} aria-label="Next">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <polyline points="8 4 16 12 8 20" />
          </svg>
        </button>
      )}

      {/* Image */}
      <div className="lb-stage">
        <img
          key={photo.id}
          src={getImageUrl(photo, 'full')}
          srcSet={getImageSrcSet(photo)}
          alt={getAltText(photo)}
          className="lb-img"
          sizes="100vw"
          onError={(e) => { e.target.srcset = ''; e.target.src = getFallbackUrl(photo); }}
        />
      </div>

      {/* Bar */}
      <div className="lb-bar">
        <div className="lb-info">
          <span className="lb-cat mono">{photo.category}</span>
          <span className="lb-slash">/</span>
          <span className="lb-name">{photo.title}</span>
        </div>
        <span className="lb-counter mono">{String(idx + 1).padStart(2, '0')} — {String(photos.length).padStart(2, '0')}</span>
      </div>

      {/* Metadata */}
      {(photo.description || (photo.tags && photo.tags.length > 0)) && (
        <div className="lb-meta">
          <div className="lb-meta-left">
            {photo.date && (
              <span className="lb-date mono">
                {new Date(photo.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </span>
            )}
            {photo.description && (
              <p className="lb-desc">{photo.description}</p>
            )}
          </div>
          {photo.tags && photo.tags.length > 0 && (
            <div className="lb-tags">
              {photo.tags.map((tag) => (
                <span key={tag} className="lb-tag mono">{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Lightbox;
