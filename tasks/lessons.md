# Lessons

## 2026-06-09 — External design handoffs: site tokens win
When implementing a design handoff (external HTML/CSS spec), the user corrected my plan to use the handoff's color palette: **map to the site's existing design tokens** (`--accent`, `--ink`, `--ink-mute`, `--line`) instead of importing the handoff's colors, and map fonts to the site's loaded faces rather than adding new ones. Default rule: handoff supplies *layout and behavior*; the site's token system supplies *color and type*. Ask only if a handoff value has no reasonable token equivalent.

## 2026-06-09 — Missing CMS metadata: render "Missing"
For CMS-driven fields with no value (project TYPE/YEAR), the user prefers a literal "Missing" placeholder over omitting the field. Makes content gaps visible to the single admin.

## 2026-06-09 — Watch for stale editor buffers clobbering refactors
After I replaced a section component (and deleted the old one), the user's editor saved an older buffer of `Home.jsx`, restoring imports of the deleted component and breaking the build. When a file I refactored reverts unexpectedly: keep the user's *new* content edits, re-apply the structural integration, and verify the build — don't blind-revert either direction.
