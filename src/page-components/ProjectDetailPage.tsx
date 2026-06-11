'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { getImageUrl, getImageSrcSet, getFallbackUrl, getAltText } from '../utils/imageHelpers';
import type { PhotoView } from '@/lib/public-views';
import './ProjectDetailPage.css';

const pad2 = (n: number) => String(n).padStart(2, '0');

/* ── Composition algorithm (handoff §4) ──
   photos[0] = hero; middle photos alternate Panel/Field starting B-left,
   panel sides alternating; the last photo is always the End Field. Wipe
   directions: B-left from-left, B-right from-right, Field opposite of the
   previous horizontal wipe, End from below — Shannon-exact. */
type Wipe = 'left' | 'right' | 'up';

type Scene = {
  type: 'panel-left' | 'panel-right' | 'field' | 'end';
  photo: PhotoView;
  no: number;
  wipe: Wipe;
};

/* Scene figures show the whole frame — the figure reserves the photo's own
   aspect ratio (no crop, no layout shift). Only the hero crops (full-bleed). */
const figureStyle = (photo: PhotoView): React.CSSProperties | undefined =>
  photo.width && photo.height
    ? { aspectRatio: `${photo.width} / ${photo.height}` }
    : undefined;

function buildScenes(photos: PhotoView[]): Scene[] {
  const n = photos.length;
  if (n < 2) return [];
  const scenes: Scene[] = [];
  let panelRight = false;
  let wantPanel = true;
  let prevHorizontal: 'left' | 'right' = 'left';
  for (let i = 1; i < n - 1; i++) {
    const no = i + 1;
    if (wantPanel) {
      const wipe: Wipe = panelRight ? 'right' : 'left';
      scenes.push({
        type: panelRight ? 'panel-right' : 'panel-left',
        photo: photos[i],
        no,
        wipe,
      });
      prevHorizontal = wipe;
      panelRight = !panelRight;
    } else {
      const wipe: Wipe = prevHorizontal === 'left' ? 'right' : 'left';
      scenes.push({ type: 'field', photo: photos[i], no, wipe });
      prevHorizontal = wipe;
    }
    wantPanel = !wantPanel;
  }
  scenes.push({
    type: 'end',
    photo: photos[n - 1],
    no: n,
    wipe: 'up',
  });
  return scenes;
}

/* Display titles break at the midpoint; B-right titles carry the second
   half in an accent <em> ("Leg's Length<br><em>Away II</em>"). */
function splitTitle(title: string): [string, string | null] {
  const words = title.trim().split(/\s+/);
  if (words.length < 2) return [title, null];
  const cut = Math.ceil(words.length / 2);
  return [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
}

const wipeClass = (wipe: Wipe) =>
  wipe === 'right' ? 'wipe wipe--r' : wipe === 'up' ? 'wipe wipe--u' : 'wipe';

/* Hide-when-empty: these return null when the data is absent and the
   caller omits the element — no "Missing" placeholders on the public page. */
const exifLine = (photo: PhotoView) => {
  const parts = [photo.focal, photo.aperture].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(' · ') : null;
};

const sceneNote = (photo: PhotoView) =>
  photo.sceneNote ||
  (photo.description && photo.description !== photo.title ? photo.description : null);

const sceneCategory = (photo: PhotoView) => photo.categoryName || null;

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
  nextCoverUrl: string | null;
};

export function ProjectDetailPage({
  title,
  description,
  publishedAt,
  photos,
  photoCount,
  nextProject,
  nextCoverUrl,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const railNoRef = useRef<HTMLElement>(null);
  const railNameRef = useRef<HTMLSpanElement>(null);
  const railBarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // reveals (wipes + fades) — one-shot; panels follow their image.
    // Chromium zeroes the intersection rect of an element fully clipped by
    // its OWN clip-path, so a `.wipe` observed directly never intersects
    // (the reference HTML has this bug). Observe each wipe's unclipped
    // parent as a proxy instead; fades observe themselves. A fade can be a
    // wipe's parent (field scenes), so one observed node may reveal several.
    const revealMap = new Map<Element, Element[]>();
    const register = (observed: Element, target: Element) => {
      const list = revealMap.get(observed);
      if (list) list.push(target);
      else revealMap.set(observed, [target]);
    };
    root.querySelectorAll('.fade').forEach((el) => register(el, el));
    root.querySelectorAll('.wipe').forEach((el) => register(el.parentElement ?? el, el));
    const revealIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          revealMap.get(entry.target)?.forEach((target) => {
            target.classList.add('in');
            target.closest('[data-panel-scene]')?.classList.add('played');
          });
          revealIO.unobserve(entry.target);
        });
      },
      { threshold: 0.18 },
    );
    revealMap.forEach((_targets, observed) => revealIO.observe(observed));

    // scene rail — active scene = section crossing the viewport's middle band
    const sceneIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            if (railNoRef.current) railNoRef.current.textContent = target.dataset.scene ?? '';
            if (railNameRef.current) railNameRef.current.textContent = target.dataset.name ?? '';
          }
        });
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    root.querySelectorAll<HTMLElement>('[data-scene]').forEach((s) => sceneIO.observe(s));

    // parallax + rail progress — single rAF, passive listener, skip offscreen
    const paras = [...root.querySelectorAll<HTMLImageElement>('img[data-para]')];
    let rafId = 0;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      rafId = requestAnimationFrame(() => {
        const vh = window.innerHeight;
        const doc = document.documentElement;
        if (railBarRef.current) {
          const max = doc.scrollHeight - vh;
          const pct = max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0;
          railBarRef.current.style.height = `${pct}%`;
        }
        if (!reduceMotion) {
          for (const img of paras) {
            const wrap = img.parentElement;
            if (!wrap) continue;
            const rect = wrap.getBoundingClientRect();
            if (rect.bottom < 0 || rect.top > vh) continue;
            const center = (rect.top + rect.height / 2 - vh / 2) / vh;
            img.style.transform = `translateY(${center * -100 * parseFloat(img.dataset.para || '0')}px)`;
          }
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      revealIO.disconnect();
      sceneIO.disconnect();
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const hero = photos[0] ?? null;
  const heroName = hero ? hero.title : 'Untitled';
  const year = publishedAt ? String(new Date(publishedAt).getFullYear()) : null;
  const projectType =
    hero && hero.categories.length > 0 ? hero.categories.join(' · ') : null;
  const scenes = buildScenes(photos);

  return (
    <div className="proj-scenes" ref={rootRef}>
      <div className="psc-grain" aria-hidden="true" />

      {photos.length > 0 && (
        <aside className="rail" aria-hidden="true">
          <span className="mono sc">
            <b ref={railNoRef}>SC.01</b>
            <span ref={railNameRef}>{heroName}</span>
          </span>
          <div className="track">
            <i ref={railBarRef} />
          </div>
          <span className="mono">{pad2(photoCount)} SCENES</span>
        </aside>
      )}

      {/* ── SC.01 — hero ── */}
      <section
        className={`hero ${hero ? '' : 'hero--empty'}`}
        id="sc-01"
        data-scene="SC.01"
        data-name={heroName}
      >
        {hero && (
          <div className="para">
            <img
              data-para="0.12"
              src={getImageUrl(hero, 'full')}
              srcSet={getImageSrcSet(hero)}
              sizes="100vw"
              alt={getAltText(hero)}
              fetchPriority="high"
              decoding="async"
              onError={(e) => {
                e.currentTarget.srcset = '';
                const display = getImageUrl(hero, 'display');
                if (e.currentTarget.src !== display) e.currentTarget.src = display;
              }}
            />
          </div>
        )}
        <div className="hero-inner">
          <Link className="crumb mono" href="/projects">
            <span>←</span>
            <span>All projects</span>
          </Link>
          {hero && (
            /* contained copy of the hero frame floating over its own
               full-bleed blow-up; decorative duplicate, so no alt */
            <figure className="hero-frame" style={figureStyle(hero)} aria-hidden="true">
              <img
                src={getImageUrl(hero, 'display')}
                srcSet={getImageSrcSet(hero)}
                sizes="40vw"
                alt=""
                onError={(e) => {
                  e.currentTarget.srcset = '';
                  e.currentTarget.src = getFallbackUrl(hero);
                }}
              />
            </figure>
          )}
          <h1>
            <span className="sub">SC.01 — {heroName}</span>
            {title}
          </h1>
          <div className="hero-strip">
            {projectType && (
              <span className="mono">
                TYPE — <b>{projectType}</b>
              </span>
            )}
            {year && (
              <span className="mono">
                YEAR — <b>{year}</b>
              </span>
            )}
            <span className="mono">
              FRAMES — <b>{pad2(photoCount)} SELECTS</b>
            </span>
          </div>
        </div>
      </section>

      {/* ── statement ── */}
      {description && (
        <section className="statement">
          <div className="rule fade" />
          <div className="fade">
            <p>{description}</p>
          </div>
        </section>
      )}

      {photos.length === 0 && (
        <p className="psc-empty mono">No photos in this project yet.</p>
      )}

      {/* ── scenes ── */}
      {scenes.map((scene) => {
        const { photo, no } = scene;
        const sc = `SC.${pad2(no)}`;
        const id = `sc-${pad2(no)}`;

        const note = sceneNote(photo);
        const cat = sceneCategory(photo);

        if (scene.type === 'panel-left' || scene.type === 'panel-right') {
          const right = scene.type === 'panel-right';
          const [head, tail] = splitTitle(photo.title);
          const exif = exifLine(photo);
          return (
            <section
              key={photo.id}
              className={`scene sc-panel ${right ? 'sc-panel--right' : 'sc-panel--left'}`}
              id={id}
              data-scene={sc}
              data-name={photo.title}
              data-panel-scene=""
            >
              <div className="ghost" aria-hidden="true">
                {pad2(no)}
              </div>
              <div className="stage">
                <div className="panel" />
                <figure className={wipeClass(scene.wipe)} style={figureStyle(photo)}>
                  <img
                    loading="lazy"
                    src={getImageUrl(photo, 'display')}
                    srcSet={getImageSrcSet(photo)}
                    sizes={
                      right
                        ? '(max-width: 820px) calc(100vw - 56px), min(67vw, 990px)'
                        : '(max-width: 820px) calc(100vw - 56px), min(58vw, 860px)'
                    }
                    alt={getAltText(photo)}
                    onError={(e) => {
                      e.currentTarget.srcset = '';
                      e.currentTarget.src = getFallbackUrl(photo);
                    }}
                  />
                </figure>
                <div className="cap">
                  <span className="mono fno">{sc}</span>
                  {!right && <h3>{photo.title}</h3>}
                  {exif && <span className="mono">{exif}</span>}
                </div>
              </div>
              <div className="side fade">
                <span className="mono">
                  {sc}
                  {cat && <> — {cat}</>}
                </span>
                {right && (
                  <h3>
                    {head}
                    {tail && (
                      <>
                        <br />
                        <em>{tail}</em>
                      </>
                    )}
                  </h3>
                )}
                {note && <p>{note}</p>}
              </div>
            </section>
          );
        }

        if (scene.type === 'field') {
          return (
            <section
              key={photo.id}
              className="scene sc-field"
              id={id}
              data-scene={sc}
              data-name={photo.title}
            >
              <div className="field fade">
                <span className="field-echo" aria-hidden="true">
                  {photo.title}
                </span>
                <div className="side">
                  <span className="mono">
                    {sc}
                    {cat && (
                      <>
                        {' — '}
                        <b>{cat}</b>
                      </>
                    )}
                  </span>
                  <h3>{photo.title}</h3>
                  {note && <p>{note}</p>}
                </div>
                <figure className={wipeClass(scene.wipe)} style={figureStyle(photo)}>
                  <img
                    loading="lazy"
                    src={getImageUrl(photo, 'display')}
                    srcSet={getImageSrcSet(photo)}
                    sizes="(max-width: 820px) calc(100vw - 96px), min(56vw, 830px)"
                    alt={getAltText(photo)}
                    onError={(e) => {
                      e.currentTarget.srcset = '';
                      e.currentTarget.src = getFallbackUrl(photo);
                    }}
                  />
                </figure>
              </div>
            </section>
          );
        }

        // end field
        return (
          <section
            key={photo.id}
            className="scene sc-end"
            id={id}
            data-scene={sc}
            data-name={photo.title}
          >
            <div className="field fade">
              <span className="field-num" aria-hidden="true">
                {pad2(no)}
              </span>
              <div className="side">
                <span className="mono">
                  {sc}
                  {cat && <> — {cat}</>}
                </span>
                <span className="endmark">
                  End of Roll <i>·</i> {pad2(no)}/{pad2(photoCount)}
                </span>
                {note && <p>{note}</p>}
                <span className="mono">
                  {title} — {year && <>{year} — </>}
                  {pad2(photoCount)} FRAMES
                </span>
              </div>
              <figure className={wipeClass(scene.wipe)} style={figureStyle(photo)}>
                <img
                  loading="lazy"
                  src={getImageUrl(photo, 'display')}
                  srcSet={getImageSrcSet(photo)}
                  sizes="(max-width: 820px) min(420px, calc(100vw - 96px)), min(40vw, 590px)"
                  alt={getAltText(photo)}
                  onError={(e) => {
                    e.currentTarget.srcset = '';
                    e.currentTarget.src = getFallbackUrl(photo);
                  }}
                />
              </figure>
            </div>
          </section>
        );
      })}

      {/* N=1 — the hero is the only frame; close the roll without a figure */}
      {photos.length === 1 && (
        <section className="scene sc-end">
          <div className="field fade">
            <span className="field-num" aria-hidden="true">
              01
            </span>
            <div className="side">
              <span className="mono">SC.01 — END</span>
              <span className="endmark">
                End of Roll <i>·</i> 01/01
              </span>
              <span className="mono">
                {title} — {year && <>{year} — </>}
                01 FRAMES
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ── ticker ── */}
      <div className="psc-ticker" aria-hidden="true">
        <div className="psc-ticker-track">
          {[0, 1, 2, 3].map((k) => (
            <span className="mono" key={k}>
              {title} <i>·</i> {pad2(photoCount)} SCENES
              {projectType && (
                <>
                  {' '}
                  <i>·</i> {projectType}
                </>
              )}
              {year && (
                <>
                  {' '}
                  <i>·</i> {year}
                </>
              )}{' '}
              <i>·</i> GOOD MORNING TAKAYA <i>·</i>
            </span>
          ))}
        </div>
      </div>

      {/* ── next project ── */}
      {nextProject && (
        <Link className="psc-next" href={`/projects/${nextProject.slug}`}>
          <div className="psc-next-inner">
            {nextCoverUrl && (
              <div className="psc-next-slice" aria-hidden="true">
                <img loading="lazy" src={nextCoverUrl} alt="" />
              </div>
            )}
            <div className="psc-next-copy">
              <span className="mono">NEXT PROJECT</span>
              <h2>{nextProject.title}&nbsp;→</h2>
            </div>
          </div>
        </Link>
      )}
    </div>
  );
}
