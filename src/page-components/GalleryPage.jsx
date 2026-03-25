'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Gallery from '../components/Gallery';
import CategoryFilter from '../components/CategoryFilter';
import Lightbox from '../components/Lightbox';
import { useViewCursor } from '../hooks/useViewCursor';
import { getCollections, getCollectionById, getCollectionCoverPhoto, getCollectionPhotos } from '../utils/collectionHelpers';
import { getImageUrl, getImageSrcSet, getFallbackUrl, getAltText } from '../utils/imageHelpers';
import photoData from '../data/photos.json';
import './GalleryPage.css';

const PHOTOS_PER_PAGE = 12;
const publishedPhotos = photoData.photos.filter(p => p.published !== false);

const PROJECTS_CATEGORY = { id: 'projects', name: 'Projects', description: 'Curated series and sessions' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatCollectionDate(dateStr) {
  if (!dateStr) return null;
  const [year, month] = dateStr.split('-');
  const m = parseInt(month, 10);
  if (!year || !m || m < 1 || m > 12) return null;
  return `${MONTHS[m - 1]} ${year}`;
}

const GalleryPage = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [filteredPhotos, setFilteredPhotos] = useState(publishedPhotos);
  const [visibleCount, setVisibleCount] = useState(PHOTOS_PER_PAGE);
  const [selectedCollection, setSelectedCollection] = useState(null);

  const allCategories = [PROJECTS_CATEGORY, ...photoData.categories];

  useEffect(() => {
    const cat = searchParams.get('category');
    const col = searchParams.get('collection');

    if (col) {
      const collection = getCollectionById(col);
      if (collection) {
        setActiveCategory('projects');
        setSelectedCollection(collection);
        return;
      }
    }

    if (cat === 'projects') {
      setActiveCategory('projects');
      setSelectedCollection(null);
    } else if (cat && photoData.categories.some(c => c.id === cat)) {
      setActiveCategory(cat);
      setSelectedCollection(null);
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeCategory === 'projects' && selectedCollection) {
      setFilteredPhotos(getCollectionPhotos(selectedCollection));
    } else if (activeCategory === 'projects') {
      setFilteredPhotos([]);
    } else {
      setFilteredPhotos(
        activeCategory === 'all' ? publishedPhotos : publishedPhotos.filter(p => p.category === activeCategory)
      );
    }
    setVisibleCount(PHOTOS_PER_PAGE);
  }, [activeCategory, selectedCollection]);

  const handleCategory = (cat) => {
    setActiveCategory(cat);
    setSelectedCollection(null);
    router.replace(cat === 'all' ? '/gallery' : '/gallery?' + new URLSearchParams({ category: cat }).toString());
  };

  const handleCollectionClick = (collection) => {
    setSelectedCollection(collection);
    router.replace('/gallery?' + new URLSearchParams({ category: 'projects', collection: collection.id }).toString());
  };

  const handleBackToProjects = () => {
    setSelectedCollection(null);
    router.replace('/gallery?' + new URLSearchParams({ category: 'projects' }).toString());
  };

  const handleLightboxClose = useCallback(() => {
    if (selectedPhoto) {
      const photoIdx = filteredPhotos.findIndex(p => p.id === selectedPhoto.id);
      if (photoIdx >= visibleCount) {
        setVisibleCount(photoIdx + 1);
      }
    }
    setSelectedPhoto(null);
  }, [selectedPhoto, filteredPhotos, visibleCount]);

  const visiblePhotos = filteredPhotos.slice(0, visibleCount);
  const remaining = filteredPhotos.length - visibleCount;
  const catInfo = activeCategory === 'projects' ? PROJECTS_CATEGORY : photoData.categories.find(c => c.id === activeCategory);

  const isProjectsView = activeCategory === 'projects' && !selectedCollection;
  const isCollectionView = activeCategory === 'projects' && selectedCollection;
  const collections = getCollections();
  const { containerRef: projRef, cursorRef: projCursorRef } = useViewCursor();

  return (
    <div className="gp">
      <header className="gp-header">
        <div className="gp-header-inner">
          <span className="gp-tag mono">
            {isCollectionView ? 'PROJECT' : 'THE COLLECTION'}
          </span>
          <h1 className="gp-title">
            {isCollectionView
              ? selectedCollection.name
              : activeCategory === 'all'
                ? 'All Work'
                : catInfo?.name || 'Gallery'}
          </h1>
          {isCollectionView && (
            <p className="gp-desc">{selectedCollection.description}</p>
          )}
          {isCollectionView && (
            <div className="gp-col-meta">
              {formatCollectionDate(selectedCollection.date) && (
                <span className="gp-col-date mono">
                  {formatCollectionDate(selectedCollection.date)}
                </span>
              )}
              {selectedCollection.tags?.length > 0 && (
                <div className="gp-col-tags">
                  {selectedCollection.tags.map((tag) => (
                    <span key={tag} className="gp-col-tag mono">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="gp-header-line" />
      </header>

      <CategoryFilter
        categories={allCategories}
        activeCategory={activeCategory}
        onCategoryChange={handleCategory}
      />

      {isCollectionView && (
        <div className="gp-back-wrap">
          <button className="gp-back" onClick={handleBackToProjects}>
            <span className="gp-back-arrow">←</span>
            <span className="gp-back-text mono">All Projects</span>
          </button>
        </div>
      )}

      {isProjectsView ? (
        <>
        <div className="view-cursor" ref={projCursorRef}><span>VIEW</span></div>
        <div className="gp-projects-grid" ref={projRef}>
          {collections.length === 0 ? (
            <div className="gp-projects-empty">
              <p className="gp-projects-empty-msg">No collections yet</p>
            </div>
          ) : (
            collections.map((collection) => {
              const coverPhoto = getCollectionCoverPhoto(collection);
              const photos = getCollectionPhotos(collection);

              return (
                <article
                  key={collection.id}
                  className="gp-proj-card"
                  tabIndex={0}
                  role="button"
                  aria-label={`View ${collection.name} — ${photos.length} photos`}
                  onClick={() => handleCollectionClick(collection)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCollectionClick(collection);
                    }
                  }}
                >
                  <div className="gp-proj-img">
                    {coverPhoto && (
                      <img
                        src={getImageUrl(coverPhoto, 'display')}
                        srcSet={getImageSrcSet(coverPhoto)}
                        sizes="(max-width: 768px) 100vw, 50vw"
                        alt={getAltText(coverPhoto)}
                        loading="lazy"
                        onError={(e) => {
                          e.target.srcset = '';
                          e.target.src = getFallbackUrl(coverPhoto);
                        }}
                      />
                    )}
                  </div>

                  <div className="gp-proj-overlay">
                    <span className="gp-proj-count mono">
                      {String(photos.length).padStart(2, '0')} photos
                    </span>
                    <h2 className="gp-proj-name">{collection.name}</h2>
                    <p className="gp-proj-desc">{collection.description}</p>
                  </div>

                  <div className="gp-proj-border" />
                </article>
              );
            })
          )}
        </div>
        </>
      ) : (
        <>
          <Gallery
            photos={visiblePhotos}
            onPhotoClick={(p) => setSelectedPhoto(p)}
          />

          {remaining > 0 && (
            <div className="gp-load-more-wrap">
              <button
                className="gp-load-more"
                onClick={() => setVisibleCount(prev => prev + PHOTOS_PER_PAGE)}
              >
                <span className="gp-load-more-text mono">Load More</span>
                <span className="gp-load-more-count mono">({remaining} remaining)</span>
              </button>
            </div>
          )}
        </>
      )}

      {selectedPhoto && (
        <Lightbox
          photo={selectedPhoto}
          photos={filteredPhotos}
          onClose={handleLightboxClose}
          onNavigate={(p) => setSelectedPhoto(p)}
        />
      )}
    </div>
  );
};

export default GalleryPage;
