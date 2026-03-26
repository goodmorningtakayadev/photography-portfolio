'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Gallery from '../components/Gallery';
import CategoryFilter from '../components/CategoryFilter';
import Lightbox from '../components/Lightbox';
import './GalleryPage.css';

const PHOTOS_PER_PAGE = 12;

const GalleryPage = ({ photos, categories }) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [filteredPhotos, setFilteredPhotos] = useState(photos);
  const [visibleCount, setVisibleCount] = useState(PHOTOS_PER_PAGE);

  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat && categories.some(c => c.id === cat)) {
      setActiveCategory(cat);
    }
  }, [searchParams, categories]);

  useEffect(() => {
    setFilteredPhotos(
      activeCategory === 'all' ? photos : photos.filter(p => p.category === activeCategory)
    );
    setVisibleCount(PHOTOS_PER_PAGE);
  }, [activeCategory, photos]);

  const handleCategory = (cat) => {
    setActiveCategory(cat);
    router.replace(cat === 'all' ? '/gallery' : '/gallery?' + new URLSearchParams({ category: cat }).toString());
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
  const catInfo = categories.find(c => c.id === activeCategory);

  return (
    <div className="gp">
      <header className="gp-header">
        <div className="gp-header-inner">
          <span className="gp-tag mono">THE COLLECTION</span>
          <h1 className="gp-title">
            {activeCategory === 'all'
              ? 'All Work'
              : catInfo?.name || 'Gallery'}
          </h1>
        </div>
        <div className="gp-header-line" />
      </header>

      <CategoryFilter
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={handleCategory}
      />

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
