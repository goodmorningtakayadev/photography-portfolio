# Selected Works section — replace homepage Featured Projects

Plan: `~/.claude/plans/compiled-leaping-feigenbaum.md` (approved 2026-06-09)

- [ ] `src/lib/public-views.ts` — add `publishedAt` to `ProjectCardView` + populate in `toProjectCardView`
- [ ] Create `src/components/SelectedWorks/SelectedWorks.jsx` (markup per reference HTML, DB-driven meta, "Missing" fallbacks)
- [ ] Create `src/components/SelectedWorks/SelectedWorks.css` (reference CSS, site font/color tokens, `.visible` reveal class)
- [ ] `src/page-components/Home.jsx` — swap feat-section for `<SelectedWorks />`, drop EditorialSpread + useRouter
- [ ] `src/page-components/Home.css` — remove `.feat-section` + dead `.feat-proj-*` block
- [ ] Delete `src/components/EditorialSpread/`
- [ ] Verify ancestors don't clip horizontal overflow
- [ ] `pnpm build` + dev-server visual check against handoff acceptance checklist

## Review

(to be filled after implementation)
