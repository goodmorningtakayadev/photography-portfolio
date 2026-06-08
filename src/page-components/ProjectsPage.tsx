'use client';

import Link from 'next/link';
import { useRevealAll } from '../hooks/useReveal';
import { useViewCursor } from '../hooks/useViewCursor';
import { getImageUrl, getImageSrcSet, getFallbackUrl } from '../utils/imageHelpers';
import type { PhotoView } from '@/lib/public-views';
import './ProjectsPage.css';

type ProjectCard = {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverPhoto: PhotoView | null;
  photoCount: number;
};

export function ProjectsPage({ projects }: { projects: ProjectCard[] }) {
  useRevealAll();
  const { containerRef, cursorRef } = useViewCursor();

  return (
    <div className="proj-listing">
      <header className="proj-listing-header">
        <div className="proj-listing-header-inner reveal">
          <span className="proj-listing-tag mono">CURATED SETS</span>
          <h1 className="proj-listing-title">Projects</h1>
        </div>
        <div className="proj-listing-line" />
      </header>

      {projects.length === 0 ? (
        <div className="proj-listing-empty reveal">
          <p className="proj-listing-empty-msg">No projects published yet.</p>
        </div>
      ) : (
        <>
          <div className="view-cursor" ref={cursorRef}><span>VIEW</span></div>
          <div className="proj-listing-grid" ref={containerRef}>
            {projects.map((project, i) => (
              <Link
                key={project.id}
                href={`/projects/${project.slug}`}
                className={`proj-card reveal reveal-d${Math.min(i + 1, 5)}`}
              >
                <div className="proj-card-img">
                  {project.coverPhoto ? (
                    <img
                      src={getImageUrl(project.coverPhoto, 'display')}
                      srcSet={getImageSrcSet(project.coverPhoto)}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      alt={project.coverPhoto.description || project.title}
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.srcset = '';
                        target.src = getFallbackUrl(project.coverPhoto!);
                      }}
                    />
                  ) : (
                    <div className="proj-card-placeholder" />
                  )}
                </div>

                <div className="proj-card-overlay">
                  <h2 className="proj-card-name">{project.title}</h2>
                  {project.description && (
                    <p className="proj-card-desc">{project.description}</p>
                  )}
                </div>

                <span className="proj-card-line" />
                <div className="proj-card-border" />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
