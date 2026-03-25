# Roadmap: photography-portfolio

## Overview
Build a personal photography portfolio website that showcases work in an aesthetic gallery format, provides a contact form for visitors, and serves as an ongoing photo dump for future photos and projects. The app already has a working Home, Gallery, and About page with a dark cinematic brutalism design system.

## Current Milestone
**v0.1 Initial Release** (v0.1.0)
Status: In progress
Phases: 4 of 5 complete

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 1 | Contact Form | 1 | Complete | 2026-03-23 |
| 2 | Photo Storage & Gallery Enhancement | 2 | Complete | 2026-03-23 |
| 3 | Projects & Collections | 2 | Complete | 2026-03-23 |
| 4 | Content Management | 1 | Complete | 2026-03-23 |
| 5 | Polish & Deploy | 1-2 | Planning | - |

## Phase Details

### Phase 1: Contact Form
**Goal:** Working contact form with validation, integrated into the About page's existing contact section
**Depends on:** Nothing (first phase)
**Research:** Unlikely (standard form pattern, existing design system)

**Scope:**
- ContactForm component with name, email, message fields
- Client-side validation with error states
- Form submission via external service (Web3Forms/Formspree)
- Success/error feedback states
- Matches existing dark cinematic brutalism design

**Plans:**
- [x] 01-01: Create ContactForm component and integrate into About page

### Phase 2: Photo Storage & Gallery Enhancement
**Goal:** Scalable photo storage system supporting many photos with easy additions
**Depends on:** Phase 1
**Research:** Likely (storage approach — filesystem vs CMS vs cloud)
**Research topics:** Photo hosting strategy, image optimization pipeline

**Scope:**
- Scalable photo data structure (beyond 6 hardcoded entries)
- Image optimization and lazy loading improvements
- Gallery pagination or infinite scroll
- Photo metadata (EXIF, descriptions, tags)

**Plans:**
- [x] 02-01: Photo data architecture and storage system
- [x] 02-02: Gallery enhancements (pagination, metadata display)

### Phase 3: Projects & Collections
**Goal:** Organize photos into named projects/series with dedicated pages
**Depends on:** Phase 2 (photo system must be scalable first)
**Research:** Unlikely (internal patterns, routing)

**Scope:**
- Project data model (name, description, cover photo, photos)
- Project listing page
- Individual project detail page
- Navigation updates

**Plans:**
- [x] 03-01: Project data model and gallery integration (scope pivoted: gallery category filter instead of separate page)
- [x] 03-02: Collection drill-down metadata (scope reduced: header nav dropped per user)

### Phase 4: Content Management
**Goal:** Easy workflow for adding new photos and projects without code changes
**Depends on:** Phase 3 (projects must exist first)
**Research:** Likely (CMS options — headless CMS vs markdown vs admin UI)
**Research topics:** Headless CMS selection, content workflow design

**Scope:**
- Content authoring workflow
- Photo upload and organization
- Project creation and editing
- Draft/publish states

**Plans:**
- [x] 04-01: Content management CLI tool + draft/publish support (04-02 not needed — all scope covered)

### Phase 5: Polish & Deploy
**Goal:** Production-ready site deployed and accessible
**Depends on:** Phase 4
**Research:** Unlikely (deployment is standard)

**Scope:**
- Performance optimization (Lighthouse audit)
- SEO metadata
- Responsive edge cases
- Deployment to hosting platform (Vercel)

**Plans:**
- [ ] 05-01: Performance and SEO polish
- [ ] 05-02: Deployment and go-live

---
*Roadmap created: 2026-03-23*
*Last updated: 2026-03-23 (Phase 4 complete)*
