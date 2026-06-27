## Goal
Return a list of {platform} games released in {year} whose Metascore is greater than or equal to {min_metascore}, sorted by Metascore descending.

## Preconditions
- No login required.
- The task start page is https://www.metacritic.com/.

## Strategy (read this first — do NOT skip)
The browse URL encodes platform, year, and sort order directly. A single `goto` to `/browse/game/{platform}/all/{year}/metascore/` lands on the correct pre-sorted listing. Each visible row on this page already shows the game title and its Metascore — no drilling into detail pages is needed. Read rows top-to-bottom and stop when the Metascore in the row drops below {min_metascore}.

## Credentials
None required.

## Steps
1. On the task start page (Metacritic homepage), navigate directly to:
   `https://www.metacritic.com/browse/game/{platform}/all/{year}/metascore/`
   This opens the full listing of {platform} games for {year}, sorted by Metascore descending.
2. If a cookie-consent banner is present, click the "Accept Cookies" button (button id `onetrust-accept-btn-handler`) to dismiss it and expose the full list.
3. On the listing page, scan each game row from top to bottom. For each row, read:
   - The game title (link text in the title cell)
   - The Metascore (numeric score displayed in the score badge)
4. Record every game whose Metascore is >= {min_metascore}. Maintain a running ledger: `[(title, metascore), ...]`.
5. Stop reading rows as soon as a row's Metascore is strictly less than {min_metascore} — all lower rows are also below the threshold because the list is already sorted descending.
6. If the listing spans multiple pages (pagination controls visible at the bottom), navigate to the next page and repeat steps 3–5, stopping the moment the first below-threshold score is encountered.
7. Stop and answer with the collected ledger of matching games and their Metascores.

## Hard Stop Rule
- Read at most 5 pages of results; a score >= {min_metascore} is unlikely to appear after a long contiguous block of lower scores.
- Do NOT open any individual game detail page — all required data (title, Metascore) is visible in the listing.
- If zero rows have Metascore >= {min_metascore}, answer with an empty list or "None found".
- If you have visited the same page URL already in this trajectory, do NOT visit it again — stop and report what you have.

## Stop Rule
Task is complete when the first row with Metascore < {min_metascore} is encountered (or the last page is exhausted), and the collected ledger is reported as the answer.

## UI Control and Filter Guardrails
- Prefer the direct URL `/browse/game/{platform}/all/{year}/metascore/` over any manual dropdown/filter interactions on the site.
- Verify the filter took effect by confirming: (a) the URL contains `/{year}/metascore/`, and (b) the page heading or breadcrumb reflects the correct platform and year.
- If the page loads without a visible score column or shows zero results unexpectedly, reload once; if still empty after reload, answer "None found".
- Do not interact with sort dropdowns or filter controls — the URL already encodes the correct sort and scope.

## Extraction and Verification Guardrails
- Maintain an explicit ledger: each entry must have both a title string and an integer Metascore before being recorded.
- Do not infer or guess Metascores — only record values explicitly displayed in the score badge of each row.
- Before reporting, re-read the ledger and confirm every entry has Metascore >= {min_metascore}.
- Report titles in the order they appear on the page (highest Metascore first).
