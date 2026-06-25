## Goal
Identify co-op strategy games priced under ${maxprice} released since {release_year} that carry Very Positive user reviews on Steam, and return their titles.

## Preconditions
- Browser can reach store.steampowered.com.
- No login is required.

## Strategy (read this first — do NOT skip)
All filtering is done via URL query parameters in a single navigation step, which is the most reliable approach. The search listing page already exposes each game's title, release date, price, and review summary badge (e.g. 'Very Positive') without needing to open individual game pages. Sort by User Reviews descending so the best-reviewed titles surface first. Candidate rows are those whose visible release date is {release_year} or later AND whose review badge reads 'Very Positive' (or better). Read all qualifying titles from the first page of results (typically the first 10–25 rows); do NOT paginate unless the task explicitly asks for exhaustive enumeration.

## Credentials
None required.

## Steps
1. On the task start page (Steam search), navigate directly to the pre-filtered search URL:
   `https://store.steampowered.com/search/?tags=9%2C1685&category2=9&maxprice={maxprice}&supportedlang=english&ndl=1`
   This applies: Strategy tag (9), Co-op tag (1685), Online Co-op feature (category2=9), max price {maxprice}.
2. Verify the filter took effect: the URL in the address bar contains `tags=9%2C1685`, `category2=9`, and `maxprice={maxprice}`. If results are empty or the URL does not match, reload once.
3. Click the sort dropdown trigger (labelled 'Relevance' by default).
4. Click the 'User Reviews' sort option (element name `Reviews_DESC`). Confirm the URL now contains `sort_by=Reviews_DESC` and the result list re-ordered.
5. Scan each result row on the current page (do NOT click into game pages). For each row, read:
   - Title
   - Release date (visible in the row, e.g. 'Nov 16, 2023')
   - Review badge text (e.g. 'Very Positive', 'Overwhelmingly Positive')
   - Price
6. Build a candidate list of rows where ALL of the following are true:
   a. Release date year >= {release_year}
   b. Review badge is 'Very Positive' OR better (e.g. 'Overwhelmingly Positive')
   c. Price <= ${maxprice} (already enforced by filter, but verify)
7. If a release date is NOT visible in a row (rare), skip that row.
8. Stop scanning after the first page (scroll down once if necessary to reveal all rows in the initial load; do not navigate to page 2).
9. Report all qualifying titles found in step 6.

## Hard Stop Rule
- Do NOT open individual game detail pages; all needed data is visible in the search listing.
- Scan at most the first page of results (approximately 25 rows); do NOT follow pagination links.
- If zero rows match both the release-year and review-badge criteria, answer 'None found'.
- If you have attempted the sort control twice without the URL updating to include `sort_by=Reviews_DESC`, read results in default order and apply the review-badge and date filters manually from visible row data.

## Stop Rule
Task is complete when you have read all qualifying titles from the first result page and can state them.

## UI Control and Filter Guardrails
- Preferred approach: single `goto` to `https://store.steampowered.com/search/?tags=9%2C1685&category2=9&maxprice={maxprice}&supportedlang=english&ndl=1` — skip manual tag/category UI interaction entirely.
- Verify filter applied: URL must contain `tags=9%2C1685`, `category2=9`, `maxprice={maxprice}`. If any are missing, re-navigate with the full URL.
- Verify sort applied: URL must contain `sort_by=Reviews_DESC` after clicking 'User Reviews'. Observable signal: top result should have a review badge of 'Very Positive' or higher.
- If the sort dropdown does not respond after two clicks, proceed with the unsorted list and manually filter by the review badge text visible on each row.
- Do NOT use the review_score query parameter (e.g. `review_score=8`) — the human's trajectory showed this did not reliably filter results and was ultimately dropped.

## Extraction and Verification Guardrails
- For each candidate row, record: Title | Release Year | Review Badge | Price.
- Include a row only if review badge text contains 'Very Positive' or 'Overwhelmingly Positive' AND release year >= {release_year}.
- Do not infer review sentiment from numeric scores; read the badge label exactly as displayed.
- Final answer: list all qualifying titles, comma-separated. Cross-check count against the number of rows you recorded in your candidate ledger before stopping.
