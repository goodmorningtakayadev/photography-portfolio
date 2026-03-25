import { useState } from 'react';
import { useViewCursor } from '../../hooks/useViewCursor';
import { getImageUrl, getImageSrcSet, getFallbackUrl, getAltText } from '../../utils/imageHelpers';
import './Gallery.css';

const Gallery = ({ photos, onPhotoClick }) => {
  const [loaded, setLoaded] = useState(new Set());
  const { containerRef, cursorRef } = useViewCursor();

  const handleLoad = (id) => setLoaded(prev => new Set(prev).add(id));

  return (
    <>
      <div className="view-cursor" ref={cursorRef}>
        <span>VIEW</span>
      </div>

      <div className="gallery" ref={containerRef}>
        {photos.map((photo, i) => (
          <div
            key={photo.id}
            className={`g-item ${loaded.has(photo.id) ? 'loaded' : ''}`}
            style={{ animationDelay: `${Math.min(i * 0.07, 0.56)}s` }}
            onClick={() => onPhotoClick(photo)}
          >
            <div className="g-img">
              <img
                src={getImageUrl(photo, 'display')}
                srcSet={getImageSrcSet(photo)}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                alt={getAltText(photo)}
                loading="lazy"
                onLoad={() => handleLoad(photo.id)}
                onError={(e) => { e.target.srcset = ''; e.target.src = getFallbackUrl(photo); }}
              />
            </div>
            <div className="g-info">
              <span className="g-cat mono">{photo.category}</span>
              <h3 className="g-title">{photo.title}</h3>
            </div>
            <div className="g-border-flash" />
          </div>
        ))}
      </div>
    </>
  );
};

export default Gallery;
