'use client';

import Link from 'next/link';
import { getImageUrl, getFallbackUrl, getAltText } from '../../utils/imageHelpers';
import './SelectedWorks.css';

const pad2 = (n) => String(n).padStart(2, '0');

/* Multi-word titles break before the last word ("Lost In<br>Nagoya");
   single-word titles render on one line. */
function TitleLines({ title }) {
  const words = title.trim().split(/\s+/);
  if (words.length < 2) return title;
  const last = words[words.length - 1];
  return (
    <>
      {words.slice(0, -1).join(' ')}
      <br />
      {last}
    </>
  );
}

/* Hide-when-empty: null when the data is absent — the meta line is omitted
   rather than rendering a "Missing" placeholder. */
function projectType(project) {
  const cats = project.coverPhoto?.categories ?? [];
  return cats.length > 0 ? cats.join(' · ') : null;
}

function projectYear(project) {
  if (project.publishedAt) {
    return String(new Date(project.publishedAt).getFullYear());
  }
  if (project.coverPhoto?.date) {
    return String(new Date(project.coverPhoto.date).getFullYear());
  }
  return null;
}

const SelectedWorks = ({ projects }) => {
  return (
    <section className="works" id="projects">
      <div className="works-head reveal">
        <div>
          <span className="mono eyebrow">
            SELECTED WORKS <i>·</i> 2015—2026
          </span>
          <h2>
            Featured
            <br />
            Projects
          </h2>
        </div>
        <div className="count">
          <span className="mono">ON THE SHEET</span>
          <b>{pad2(projects.length)}</b>
        </div>
      </div>

      {projects.length > 0 ? (
        projects.map((project, i) => {
          const photo = project.coverPhoto;
          const type = projectType(project);
          const projYear = projectYear(project);
          return (
            <Link
              key={project.id}
              href={`/projects/${project.slug}`}
              className={`plate ${i % 2 === 0 ? 'plate--left' : 'plate--right'} reveal`}
              aria-label={`View project: ${project.title}`}
            >
              <div className="plate-img">
                {photo && (
                  <img
                    src={getImageUrl(photo, 'display')}
                    alt={getAltText(photo)}
                    loading="lazy"
                    onError={(e) => {
                      e.target.src = getFallbackUrl(photo);
                    }}
                  />
                )}
              </div>
              <div className="plate-title">
                <span className="no">PROJECT {pad2(i + 1)}</span>
                <h3>
                  <TitleLines title={project.title} />
                </h3>
              </div>
              <div className="plate-meta">
                {type && (
                  <span className="mono">
                    TYPE — <b>{type}</b>
                  </span>
                )}
                {projYear && (
                  <span className="mono">
                    YEAR — <b>{projYear}</b>
                  </span>
                )}
                <span className="mono">
                  FRAMES — <b>{pad2(project.photoCount)} SELECTS</b>
                </span>
                <span className="view">
                  View project <span className="tick" />
                </span>
              </div>
            </Link>
          );
        })
      ) : (
        <div className="works-empty reveal">
          <p className="mono">No projects published yet.</p>
        </div>
      )}

      <div className="works-foot">
        <span className="mono">MORE ON THE WAY</span>
        <Link href="/projects">
          <span>All projects</span>
          <span>→</span>
        </Link>
      </div>
    </section>
  );
};

export default SelectedWorks;
