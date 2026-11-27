# Navers Lab — Einsia UI v0.4

For UI work, first read `docs/design/AGENT-GUIDELINE.md`.
It applies to every Astro page, component, research article and standalone HTML subsite.

The user approved the supplied v0.4 artifact for this project. Its retained “draft”
labels describe its original packaging, not an additional approval requirement.
`docs/design/approved-v0.4.html` is the exact reviewed source. Earlier v0.1 design
drafts under `docs/design/` are historical and must not guide new UI changes.

- Use `src/design/tokens.json` as the production token source and run
  `node scripts/design-tokens.mjs` after edits. Never hand-edit generated tokens/fonts.
- Shared styles and behaviors live under `public/design/`, used by Astro and static pages.
- English headings: Hanken Grotesk 600. Chinese headings: Noto Sans SC 700.
  Body and controls: system sans. No Georgia or Inter overrides.
- Keep paper backgrounds, green actions, readable metadata, flat panels and visible focus.
- Use one primary action per group. Preserve research data, citations and working routes.
- Media and charts are evidence. Keep their data colors; do not turn them into page themes.
- No automatic marquees, background-video heroes, decorative animation or fake UI.
- Modify WorkflowArena source in `resources/workflowarena/`, then run its sync command.
- Verify the changed pages at 320/390/768/1024/1440px and run the checks listed in
  the guideline. Record actual results and any remaining limitations.
