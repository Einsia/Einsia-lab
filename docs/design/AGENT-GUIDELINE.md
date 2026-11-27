# Navers Lab — Agent design specification

Version: Einsia UI v0.4. Scope: the entire Navers Lab website, including independently
published research pages. Source: `approved-v0.4.html`, supplied and approved for
implementation by the user in this session. The source artifact is retained verbatim;
its original “review draft” wording does not require another approval. The former
v0.1 proposal is superseded, especially its Georgia/Inter typography.

The rules below also incorporate accepted fixes from the Research list, RoboUniverse,
EmbodiedEvo, Visual Cipher and PhysLastExam. Their causes and measured verification
results are recorded in [the implementation log](IMPLEMENTATION.md).

## 1. Start here

1. Identify the page: project overview, results, task/case explorer, or article.
2. Read the shared components and neighboring page before adding new markup.
3. Reuse the production tokens, shell, resource actions, tables and interaction behaviors.
4. Keep all research numbers, definitions, real citations, resource URLs and media intact.
5. Verify the affected UI and record outcomes using section 12 below.

The reviewed artifact's section IDs are stable lookup points: `f-colour`, `f-type`,
`f-layout`, `c-controls`, `ui-state-matrix`, `ui-forms`, `ui-overlays`, `ui-tabs`,
`ui-data`, `ui-page-errors`, `f-evidence`, `c-header`, `c-results`, `c-explorer`,
`ui-delivery`, and `ui-acceptance`. Component rules take priority over illustrative
sample markup. Explicit user changes take priority over this document.

## 2. Single maintenance source and implementation map

- Approved visual reference: `docs/design/approved-v0.4.html`.
- Editable production token JSON: `src/design/tokens.json`.
- Generator: `scripts/design-tokens.mjs`. It emits `public/design/tokens.css` and
  the two reviewed local WOFF2 heading fonts. `--check` detects stale output.
- Shared UI foundation and existing-page mappings: `public/design/site.css`.
- Shared progressive behavior: `public/design/site.js`.
- Astro shell: `src/layouts/Layout.astro`; shared navbar, footer, container and UI controls
  remain in `src/components/`. Tailwind's legacy color/font aliases map to the same tokens.
- EmbodiedEvo renders its own documents in `src/components/embodiedrsi/`; it must use
  the same foundation. Its project navigation remains a research-specific component.
- Static research sites use the same `/design/` assets with relative paths that respect
  the deployment base. WorkflowArena's editable source is `resources/workflowarena/`;
  publish it through `npm run sync:workflowarena`, not manual edits to its generated copy.
- Design ownership: the project's design reviewer. Named individual owner and Figma
  node mappings were not provided; do not invent them. Record ownership when supplied.

Production class/data hooks identify the shared shell, project headings, action groups,
wide result regions and interactive controls. Prefer these hooks for new UI. Existing
project selectors in site.css are compatibility mappings, not permission to add new themes.

## 3. Principles and forbidden patterns

The content provides the visual center. Explain the research question, show evidence,
then provide paper, code and reproducibility resources. Group prose with headings and
spacing. Use cards only for independently selectable objects or interaction boundaries.

Share type, action semantics, tables and state behavior. Research-specific information
architecture and visualizations are extensions. A model's plot color is not its button color.

Do not use decorative gradients, glowing effects, particle backgrounds, glass cards,
random icons, emoji UI, huge video-backed heroes, automatic marquees, animated counters,
scroll reveals, hover lifts or fake terminals. Continuous scales inside a labeled data
plot and genuine recorded agent traces are allowed evidence.

Write concrete research descriptions. Avoid unsupported promotional claims. Preserve
official project/paper names; do not rewrite scientific conclusions during a design edit.

## 4. Semantic tokens and typography

All UI colors and dimensions use shared `--lab-*` tokens. Tailwind aliases such as
paper, ink and accent resolve to these same values. Do not override them per page.

- Page `#f4efe4`; surface `#ebebe0`; selected `#e3e8db`.
- Text and primary action `#273d32`; muted text `#56675a`; action hover `#192c22`;
  text on primary `#f4efe4`.
- Structural border `#b8c2ac`; control boundary `#758a71`; focus `#273d32`.
- White is for paper figures/screenshots; deep `#243e34` is for media viewports.
- Success, warning and danger use the semantic tokens plus a visible text/symbol label.
- Light is the complete supported theme. Do not independently invert a project for dark mode.

English headings use Hanken Grotesk at 600; Chinese headings use Noto Sans SC at 700.
Body, navigation, fields and captions use SF Pro / the platform sans-serif, with PingFang
SC and system Chinese fallback. Use the bundled heading fonts; do not fetch Google Fonts
at runtime. Code uses system monospace. Numbers use tabular figures.

- H1 English: 56/64px desktop, 36/44px mobile.
- H1 Chinese: 48/62px desktop, 36/48px mobile; set the language on Chinese headings.
- H2: 32/40px desktop, 28/36px mobile. H3: 24/32px, 22/30px mobile.
- Long prose: 18/28px, 16/28px on mobile. Regular descriptions: 16/26px.
- Controls, metadata and captions: 14/22px. Small secondary data labels: at least 12/18px.
- Control-area headings: system sans 16/24px, 600. Do not style every panel heading like H1.
- One H1 per page. Keep semantic heading levels separate from appearance.
- Text column maximum 720px. No justified text, Chinese italics, or compressed tracking.
  Space Chinese/Latin boundaries and numbers/units; keep % and degree symbols adjacent.

## 5. Layout, rhythm, navigation and resources

Standard outer container: 1120px including gutters; wide results/explorers: 1280px.
Gutters: 20px below 768, 24px at 768–1023, 32px at 1024+. Use these two breakpoints.
Header, title, sections and footer align. A right-side contents/filter column is 240px
with a 40px gap; stack below 1024. Never hide overflow on the body to mask a layout bug.

Keep the page container and prose measure separate. Article pages may center a narrower
reading column inside the shared outer container. About explicitly retains its original
`max-w-3xl mx-auto pt-20` article: a centered 768px maximum column with 80px top spacing,
an approved exception to the default 720px prose measure and hero spacing. Its title and
sections align with that reading column. Do not force article content onto the Home or
Research heading edge; verify balanced margins and responsive fit for its page type.

Header minimum height 64px. Hero top space 64px desktop/40px mobile. Title to summary
24px; summary to metadata 16px; resource group 24px. Sections 64px apart, 40px on mobile;
heading-to-text 16px, text-to-figure 24px, paragraph gap 16px. Spacing scale:
4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80px. Intrinsic media sizes, percentage data
coordinates, zero and 1px structural lines are valid non-spacing values.

Radius: labels 4px, controls 6px, media/panels 8px, dialogs 12px. Cards, buttons and
data panels are flat. Shadow belongs only to actual overlays.

Give each visible divider one owner. In nested catalogues, the last row, catalogue and
outer section must not each draw a closing border or add the same section gap. PhysLastExam
uses row top borders and one catalogue bottom border, with spacing supplied by the next
section. Check the last *visible* row after filtering, an empty list, an expanded row and
a collapsed catalogue; a `:last-child` rule alone does not handle filtered rows.

The site name is “Navers Lab”. Reuse its existing SVG mark. Global navigation is Home,
Research, About, Einsia Home; provide a real accessible mobile menu. Indicate current
section with text/underline and aria-current. Keep the logo/home destination stable.

Project opening: Research breadcrumb → project H1 → research summary → real attribution
and date → resources → optional 2–4 factual metrics. Left align; no forced title breaks.
Paper → Code → Dataset (if present); project links use Results, Tasks/Cases, Method,
Citation as appropriate. At most one primary action per group. Forthcoming resources
are visible status text, never `href="#"` or a fake download. Facts use dt=label, dd=value.

## 6. Controls and forms

Links navigate; buttons perform actions. Buttons have primary, secondary and quiet
variants, stable dimensions and an 8px icon/text gap. Minimum height 40px, touch target
44×44px. Icon-only controls have an accessible name and discoverable explanation.

Define the applicable states: default, hover, active, focus-visible, disabled, pending,
selected/checked/expanded, invalid and read-only. Disabled controls cannot activate and
explain why nearby. Pending states prevent duplicate submissions, retain input and width,
and set aria-busy. Read-only fields remain copyable and focusable.

Fields have persistent labels and 44px height. Placeholder is only a hint. Required
fields have visible “required” and the native attribute. Checkbox groups use fieldset /
legend; radios share name; switches are only for immediate binary settings. Prefer native
select; searchable comboboxes require their complete keyboard contract. Textareas resize
vertically. Do not impose invented limits.

Validate on first submit, focus the first invalid field, then revalidate existing errors
on editing. Preserve IME composition. Associate errors using aria-invalid/describedby.
Retain values and context on failure; client validation never substitutes server checks.
Reset restores documented initial values; protect unsaved work when applicable.

## 7. Tabs, overlays and keyboard behavior

Navigation, panel tabs and data filters are different controls. Tabs require tablist/tab/
tabpanel links, roving tabIndex, aria-selected, arrows and Home/End. Instant local panels
may activate automatically; slow remote panels confirm with Enter/Space. Hidden panels
cannot contain focusable active content. Keep entered state. Shareable query/sort/page
state belongs in the URL with history restoration.

Inline errors stay next to the object. Nonurgent completion uses role=status; urgent
failure uses alert. Toasts do not steal focus; normal success can dismiss after 5 seconds,
but actionable/critical notices persist. Hover help also works on focus and Escape;
required touch help has a click-accessible alternative.

Use details/summary for disclosure. Do not put role=menu on a list of ordinary links.
Dialogs have an accessible title, safe initial focus, modal background, Escape, a reachable
close control and return focus. Protect dirty inputs before closing. Simple no-input
previews may close on backdrop. Use native dialog where possible.

Figure previews use the single dialog managed by `public/design/site.js` and styled in
`public/design/site.css`, on both Astro and standalone pages. Use `data-lab-preview="original-url"`
for explicit triggers; direct image links retain a real `href` for the no-JS fallback.
An ordinary image-preview click opens that dialog without navigation or a new tab.
Preserve project-thumbnail navigation, downloads, modified link clicks and existing media
controls; use `data-no-lightbox` for media regions that already own their interaction.
Do not add a second page-specific preview controller.

Center the dialog explicitly after CSS resets (`position: fixed; inset: 0; margin: auto`),
constrain it with the shared preview's viewport margin (currently 20px), and preserve the image aspect ratio.
Check its bounds at all required widths and after resizing while open. Keep loading,
failure/retry, close and focus-return behavior available. Queued close or image events
from an earlier opening must not clear or overwrite a newly opened preview; exercise
rapid close/reopen as well as successful image loading.

## 8. Tables, lists and state restoration

Use semantic table/caption/thead/tbody and scope attributes. Names left, numbers right;
consistent precision, units and missing-value notation. Put sort actions in column headers
with aria-sort. Sort complete rows, keep ties stable, put missing values after real values
in either direction. Zero is a real value. Best scores may be bold, not reordered for branding.

Research uses consistent project rows with real optional thumbnails, one sentence, category,
date and independent resource links. Avoid nested anchors and alternating oversized cards.

Paginate large sortable collections; preserve query, sort and page in one model. Filtering
or sorting returns to page one without losing other conditions. Reset restores documented
defaults; Back restores state. Keep existing rows while refreshing. Distinguish no data,
no matches and network failure; provide context-specific retry/reset actions.

Only tables, code and local tabs may scroll horizontally. The containing page must reflow.
Scrollable regions need a name and keyboard access. Do not squeeze dense labels below 12px.

Size columns using the loaded shared font, cell padding, label, sort arrow/gap and units.
RoboUniverse and EmbodiedEvo retained narrow columns after their labels grew to 14px;
long headers then painted over neighboring cells. Allocate a content-based table minimum
width and scroll inside its container. Do not shrink the shared control font, truncate
research labels or hide overflow to make the table appear to fit. Keep headers and body
cells aligned in every result view; one page's minimum width is not a site-wide constant.

Choose wrapping by content: model identifiers (such as PhysLastExam's model headings)
and score/unit markers stay on one line. Long descriptive taxonomy headings may wrap
within their own cells when intended. Allow label flex items to shrink with `min-width: 0`,
keep sort arrows from shrinking, and reserve their gap. Verify the longest labels and
the final column, not just the first visible columns.

Sticky model columns must leave room to use the remaining columns; let them scroll with
the table on phones when they would cover the usable area. Share the sticky width with
the scroll container's `scroll-padding-inline-start`. Keep the full focused sort button
and its outline visible when moving both forward and backward through the table. Native
focus scrolling can leave a partially visible button clipped; use nearest scrolling on
keyboard focus where needed, with scroll margin for the focus outline. Verify actual
Tab / Shift+Tab / Enter behavior in addition to pointer clicks and `scrollIntoView` checks.

## 9. Research evidence, media and trajectories

Every figure has an accessible description and visible metric, units, conditions, source
and caption. Axes identify units; multiple series have a stable legend. Preserve published
series colors locally and explain them; default series uses plot-1 with a neutral baseline.
Use shapes/labels as well as color. Genuine syntax colors and scientific media are exceptions
to neutral UI chrome, not exceptions to readable contrast.

Distinguish tasks, runs, models and configurations. Report percentage-point gains correctly;
never turn missing scores into zero. Keep confidence intervals when published, never invent
them. Do not compare different budgets/protocols silently. Bars start at zero; truncated
line axes are explicit. Tables supply accessible values when charts are difficult to read.

Media keeps its original aspect and evidence content. No crop/filter to fit a theme.
Videos load metadata/none, have a poster and controls, and start only on user request.
3D loads on demand/visibility with a static preview and failure explanation. Spoken content
needs captions or a text equivalent. Respect reduced motion without removing manual controls.

Explorers order task selection → result → process. A selected task's video, code and feedback
must refer to the same run. Stack instruction, media, result and trace on mobile. Distinguish
an evaluated failure from a failed resource request. Keep expandable complete code and real
download links. Copy citation reports actual success or a selectable-text fallback.

## 10. Page templates and exceptions

- Overview: project opening, first evidence, local navigation, method/results, findings,
  limitations, citation/resources, footer. Reorder evidence for the actual research argument.
- Results: compact heading and protocol, filters/version, table, metric definitions, source.
  A score chart can supplement a full table; no podium-only ranking.
- Explorer: compact context, filters/count, task list and current media/code/feedback.
- Article/About: heading, introduction/real attribution, readable text column, figures,
  collapsible contents where needed and references. Omit missing metadata instead of guessing.

404 retains site context and a reliable return link. 403 only offers real permission/account
actions; service/offline/partial failures preserve context and explain recovery. Do not expose
stack traces or guess causes. UI state does not prove the server's HTTP status. Uncertain
submissions need result reconciliation/idempotency before inviting a repeat.

Record exceptions by component, purpose and scope. Preserve technical diagrams/canvas controls
where their interaction requires different geometry; keep their surrounding UI consistent.
Do not invent an owner, Figma URL or unimplemented backend capability.

## 11. Motion, access and performance

120ms hover/press, 180ms panel changes; no decorative loops. Reduced motion disables nonessential
transitions and smooth scrolling. All needed actions work by keyboard with a 2px focus outline
and 2px offset. Normal text meets 4.5:1; large text and required UI graphics meet 3:1.

Provide a skip link and landmarks. Keep headings, core results and resource links readable
without JS. Set media dimensions; lazy-load below-fold evidence. Avoid loading all case media
or a 3D library on the first screen. Do not claim performance numbers without measurement.

Research-list thumbnails use same-site responsive derivatives from
`scripts/build-research-images.mjs`, with accurate `srcset` / `sizes`; do not load full
research originals or remote GitHub Raw images just to fill a small list preview.
Refresh derivatives with `npm run build:research-images` after changing a source or
banner configuration, and preserve the original for full-size viewing.
Reserve the frame before the request starts using image dimensions and a container ratio
(8:5 for Research-list previews, with `object-fit: contain`). Loading, failure and no-JS
states must keep the same frame geometry and a working project link. Verify delayed and
failed requests explicitly; a warm-cache screenshot cannot expose a collapsing frame.

## 12. Delivery and verification

For UI/code changes, run `node scripts/design-tokens.mjs --check`, `npm run build`, and the
existing validators for affected research collections. WorkflowArena changes also run source synchronization
and its manifest/output validation. No dataset or media changes are needed for UI styling.

Check 320, 390, 768, 1024 and 1440px, long English/Chinese headings, dense tables, missing
values, 200% zoom and coarse-pointer controls. Exercise menu, form, sort/filter/reset, tabs,
dialogs, copy feedback, empty/error states and browser history. Verify no page-wide overflow,
no hidden focused controls, and coherent font/color tokens in every page family.

Include actual build/browser outcomes and known limitations in `IMPLEMENTATION.md`.
Separate local UI verification from untested live HTTP behavior, cross-platform system
font appearance and production performance. A screenshot alone is not proof of an interaction.

Select regression checks for the affected behavior against a production preview:

- `scripts/validate-research-images.mjs`: thumbnail geometry before/after loading and
  failure, responsive image selection, no-JS fallback, long titles and touch targets.
- `scripts/validate-research-layout.mjs`: RoboUniverse header bounds and data alignment,
  dialog centering/resizing, linked-image previews on standalone pages, retry and close.
- `scripts/validate-results-layout.mjs`: EmbodiedEvo and PhysLastExam heading line counts,
  data alignment, reachable sort controls, sorting/filter/reset and catalogue dividers.
- `scripts/validate-design-interactions.mjs`: shared menu, preview, filtering, media and
  keyboard behaviors when changing shared controls or scripts.

All four scripts accept `DESIGN_CHECK_URL` and `PLAYWRIGHT_MODULE`. The image script writes
to `.local/design-check/research-images/`; the other three also accept `DESIGN_CHECK_OUT`.
See the implementation log for invocation examples and the current macOS Chrome requirement.
Check canonical and legacy entry routes that share a component. Measure text bounds and
line counts after fonts load, table-local versus page overflow, focused-control visibility,
dialog bounds and frame dimensions across loading states. Inspect desktop and phone
screenshots as well. Record rapid preview reopen and other manual checks separately when
the script does not cover them. A 720 CSS px / DPR 2 reflow check is an equivalent layout
scenario, not proof that browser-native 200% zoom was exercised.

When a reported UI defect reveals a reusable rule, update the relevant section here with
the failure cause, prevention and acceptance check; retain case-specific measurements in
`IMPLEMENTATION.md`. For documentation-only updates, check the diff and referenced paths
and commands; rerun UI checks only if implementation changes or unresolved behavior warrant it.
