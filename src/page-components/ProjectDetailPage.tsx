'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { getImageUrl, getImageSrcSet, getFallbackUrl, getAltText } from '../utils/imageHelpers';
import type { PhotoView } from '@/lib/photo-adapter';
import './ProjectDetailPage.css';

type SpreadType = 'title' | 'hero' | 'diptych' | 'editorial' | 'detail' | 'end';

type Spread = {
  type: SpreadType;
  photos: PhotoView[];
  editorialSide?: 'left' | 'right';
};

function buildSpreads(photos: PhotoView[]): Spread[] {
  const spreads: Spread[] = [{ type: 'title', photos: [] }];

  if (photos.length === 0) {
    spreads.push({ type: 'end', photos: [] });
    return spreads;
  }

  // First photo is always hero
  spreads.push({ type: 'hero', photos: [photos[0]] });

  const cycle: SpreadType[] = ['diptych', 'editorial', 'detail', 'hero'];
  let cycleIdx = 0;
  let photoIdx = 1;
  let editorialFlip = false;

  while (photoIdx < photos.length) {
    const remaining = photos.length - photoIdx;
    let template = cycle[cycleIdx % cycle.length];

    // Skip diptych if fewer than 2 photos remain
    if (template === 'diptych' && remaining < 2) {
      cycleIdx++;
      template = cycle[cycleIdx % cycle.length];
      if (template === 'diptych' && remaining < 2) template = 'detail';
    }

    if (template === 'diptych') {
      spreads.push({
        type: 'diptych',
        photos: [photos[photoIdx], photos[photoIdx + 1]],
      });
      photoIdx += 2;
    } else if (template === 'editorial') {
      spreads.push({
        type: 'editorial',
        photos: [photos[photoIdx]],
        editorialSide: editorialFlip ? 'right' : 'left',
      });
      editorialFlip = !editorialFlip;
      photoIdx += 1;
    } else if (template === 'detail') {
      spreads.push({ type: 'detail', photos: [photos[photoIdx]] });
      photoIdx += 1;
    } else {
      // hero
      spreads.push({ type: 'hero', photos: [photos[photoIdx]] });
      photoIdx += 1;
    }
    cycleIdx++;
  }

  spreads.push({ type: 'end', photos: [] });
  return spreads;
}

type Props = {
  title: string;
  slug: string;
  description: string;
  publishedAt: string | null;
  photos: PhotoView[];
  coverPhoto: PhotoView | null;
  photoCount: number;
  prevProject: { slug: string; title: string } | null;
  nextProject: { slug: string; title: string } | null;
};

export function ProjectDetailPage({
  title,
  description,
  publishedAt,
  photos,
  photoCount,
  prevProject,
  nextProject,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [visibleSections, setVisibleSections] = useState<Set<number>>(new Set([0]));

  const spreads = buildSpreads(photos);

  // Scroll progress
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const p = scrollHeight - clientHeight;
      setProgress(p > 0 ? scrollTop / p : 0);
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  // IntersectionObserver for reveal
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const sections = container.querySelectorAll('[data-spread]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-spread'));
            setVisibleSections((prev) => new Set(prev).add(idx));
          }
        });
      },
      { root: container, threshold: 0.2 },
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [spreads.length]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const container = containerRef.current;
    if (!container) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const sections = container.querySelectorAll('[data-spread]');
      const containerRect = container.getBoundingClientRect();
      const currentScroll = container.scrollTop;

      // Find current section
      let currentIdx = 0;
      sections.forEach((s, i) => {
        if ((s as HTMLElement).offsetTop <= currentScroll + 10) currentIdx = i;
      });

      const targetIdx = e.key === 'ArrowDown'
        ? Math.min(currentIdx + 1, sections.length - 1)
        : Math.max(currentIdx - 1, 0);

      sections[targetIdx]?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const publishedYear = publishedAt ? new Date(publishedAt).getFullYear() : null;

  return (
    <div className="proj-detail" ref={containerRef}>
      {/* Progress indicator */}
      <div className="proj-progress" aria-hidden="true">
        <div className="proj-progress-fill" style={{ height: `${progress * 100}%` }} />
      </div>

      {/* Spreads */}
      {spreads.map((spread, i) => {
        const isVisible = visibleSections.has(i);
        const revealClass = isVisible ? 'spread-visible' : '';

        if (spread.type === 'title') {
          return (
            <section key={i} data-spread={i} className={`spread spread-title ${revealClass}`} aria-label="Project title">
              <div className="spread-title-inner">
                <div className="spread-title-neon" />
                <span className="spread-title-tag mono">PROJECT</span>
                <h1 className="spread-title-h1">{title}</h1>
                {description && <p className="spread-title-desc">{description}</p>}
                <div className="spread-title-meta">
                  <span className="mono">{photoCount} {photoCount === 1 ? 'photo' : 'photos'}</span>
                  {publishedYear && <span className="mono">{publishedYear}</span>}
                </div>
              </div>
              <div className="spread-title-scroll">
                <span className="mono">SCROLL</span>
                <span className="spread-title-scroll-bar" />
              </div>
            </section>
          );
        }

        if (spread.type === 'hero') {
          const photo = spread.photos[0];
          return (
            <section key={i} data-spread={i} className={`spread spread-hero ${revealClass}`} aria-label={`Photo: ${photo.title}`}>
              <img
                src={photo.url}
                srcSet={getImageSrcSet(photo)}
                sizes="100vw"
                alt={getAltText(photo)}
                className="spread-hero-img"
                loading={i <= 2 ? 'eager' : 'lazy'}
                onError={(e) => { (e.target as HTMLImageElement).srcset = ''; (e.target as HTMLImageElement).src = getFallbackUrl(photo); }}
              />
              <div className="spread-hero-caption">
                <span className="mono">{photo.title}</span>
              </div>
            </section>
          );
        }

        if (spread.type === 'diptych') {
          const [left, right] = spread.photos;
          return (
            <section key={i} data-spread={i} className={`spread spread-diptych ${revealClass}`} aria-label="Photo pair">
              <div className="spread-diptych-grid">
                <div className="spread-diptych-item spread-diptych-left">
                  <img
                    src={getImageUrl(left, 'display')}
                    srcSet={getImageSrcSet(left)}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    alt={getAltText(left)}
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).srcset = ''; (e.target as HTMLImageElement).src = getFallbackUrl(left); }}
                  />
                  <span className="spread-diptych-cap mono">{left.title}</span>
                </div>
                <div className="spread-diptych-item spread-diptych-right">
                  <img
                    src={getImageUrl(right, 'display')}
                    srcSet={getImageSrcSet(right)}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    alt={getAltText(right)}
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).srcset = ''; (e.target as HTMLImageElement).src = getFallbackUrl(right); }}
                  />
                  <span className="spread-diptych-cap mono">{right.title}</span>
                </div>
              </div>
            </section>
          );
        }

        if (spread.type === 'editorial') {
          const photo = spread.photos[0];
          const isRight = spread.editorialSide === 'right';
          return (
            <section key={i} data-spread={i} className={`spread spread-editorial ${isRight ? 'spread-editorial-right' : ''} ${revealClass}`} aria-label={`Photo: ${photo.title}`}>
              <div className="spread-editorial-grid">
                <div className="spread-editorial-photo">
                  <img
                    src={getImageUrl(photo, 'display')}
                    srcSet={getImageSrcSet(photo)}
                    sizes="(max-width: 768px) 100vw, 60vw"
                    alt={getAltText(photo)}
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).srcset = ''; (e.target as HTMLImageElement).src = getFallbackUrl(photo); }}
                  />
                </div>
                <div className="spread-editorial-text">
                  <div className="spread-editorial-rule" />
                  <p className="spread-editorial-quote">{photo.title}</p>
                  {photo.description && photo.description !== photo.title && (
                    <p className="spread-editorial-body">{photo.description}</p>
                  )}
                  <div className="spread-editorial-meta">
                    {photo.categoryName && <span className="mono">{photo.categoryName}</span>}
                  </div>
                </div>
              </div>
            </section>
          );
        }

        if (spread.type === 'detail') {
          const photo = spread.photos[0];
          return (
            <section key={i} data-spread={i} className={`spread spread-detail ${revealClass}`} aria-label={`Photo: ${photo.title}`}>
              <div className="spread-detail-inner">
                <img
                  src={getImageUrl(photo, 'display')}
                  srcSet={getImageSrcSet(photo)}
                  sizes="(max-width: 768px) 100vw, 70vw"
                  alt={getAltText(photo)}
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).srcset = ''; (e.target as HTMLImageElement).src = getFallbackUrl(photo); }}
                />
                <span className="spread-detail-cap mono">{photo.title}</span>
              </div>
            </section>
          );
        }

        if (spread.type === 'end') {
          return (
            <section key={i} data-spread={i} className={`spread spread-end ${revealClass}`} aria-label="End of project">
              <div className="spread-end-inner">
                <span className="spread-end-tag mono">END</span>
                <h2 className="spread-end-title">{title}</h2>
                <div className="spread-end-rule" />
                <div className="spread-end-nav">
                  <Link href="/projects" className="spread-end-link mono">
                    <span>&larr;</span> All Projects
                  </Link>
                  {nextProject && (
                    <Link href={`/projects/${nextProject.slug}`} className="spread-end-link spread-end-next mono">
                      {nextProject.title} <span>&rarr;</span>
                    </Link>
                  )}
                </div>
                {prevProject && (
                  <Link href={`/projects/${prevProject.slug}`} className="spread-end-prev mono">
                    <span>&larr;</span> {prevProject.title}
                  </Link>
                )}
              </div>
            </section>
          );
        }

        return null;
      })}

    </div>
  );
}
