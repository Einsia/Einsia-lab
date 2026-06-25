## Goal
Find the per-capita renewable energy consumption value for {country} in {target_year} from the Our World in Data grapher at slug `{slug}`, and confirm the CSV download URL.

## Preconditions
- No login is required; the site is public.
- The grapher slug `{slug}` is known (see Strategy for how to discover it via search if not).

## Strategy (read this first — do NOT skip)
The grapher page `/grapher/{slug}` holds all data needed. After filtering to {country} and switching to the Table view, the year-by-year values are visible directly in the table — no drill-in is required. The CSV download URL is always `https://ourworldindata.org/grapher/{slug}.csv` and is confirmed by opening the Download panel. The slug itself is the path segment after `/grapher/` in the browser URL.

## Credentials
None required (public site).

## Steps
1. On the task start page (ourworldindata.org homepage), if a cookie-consent banner is present, click **Reject optional cookies** to dismiss it.
2. Navigate directly to `https://ourworldindata.org/grapher/{slug}`. (If the slug is unknown: type `{search_term}` into the homepage search input, press Enter, click **Submit search**, then identify the grapher link whose title matches the indicator and read its URL path to extract `{slug}`.)
3. On the grapher page, locate the input labelled **Search for a country or region**. Type `{country}` and press Enter. Confirm the country name appears as a selected series label on the chart or legend.
4. Click the **Table** tab (chart-view toggle, labelled "Table"). The view switches to a year-indexed table showing values for {country}.
5. Scan the table rows to find the row whose Year column equals `{target_year}`. Read the numeric value in that row — this is the per-capita figure (in kWh or the indicator's unit).
6. Click the **Download** button (toolbar of the grapher). The download panel opens and displays a CSV link. Confirm the link follows the pattern `https://ourworldindata.org/grapher/{slug}.csv`.
7. Stop and answer with: (a) the slug, (b) the {target_year} value for {country}, and (c) the CSV URL.

## Hard Stop Rule
- There is exactly one grapher page to visit; do not open multiple grapher URLs.
- If the Table tab shows no row for `{target_year}`, report the most recent year available and note the discrepancy.
- If the country search returns no match, try the official English country name variant (e.g. "Brazil" not "Brasil").
- If you have attempted the country search twice without a visible series, stop and report what years and countries are visible.

## Stop Rule
Stop as soon as you have read the `{target_year}` value from the Table view and confirmed the CSV URL from the Download panel.

## UI Control and Filter Guardrails
- Prefer navigating directly to `https://ourworldindata.org/grapher/{slug}` over searching, because the search flow requires multiple clicks and the slug is predictable.
- Verify the country filter took effect by checking that the legend or chart title includes `{country}` before switching to Table view.
- Verify the Table tab is active by confirming that a year-indexed grid (not a map or line chart) is now visible.
- If the Download panel does not open after one click on **Download**, click once more; do not click a third time — instead read the URL from the browser address bar and append `.csv`.

## Extraction and Verification Guardrails
- Candidate fields to record: slug (from URL path), target-year row value, CSV URL.
- The slug is the path segment between `/grapher/` and any `?` query separator in the browser URL.
- The CSV URL is always `https://ourworldindata.org/grapher/{slug}.csv` — verify it matches the link shown in the Download panel.
- Do not confuse the total energy figure with the per-capita figure; confirm the page title or indicator label contains "per capita" before recording the value.
- Cross-check: the value in the `{target_year}` table row must be a plausible kWh-per-person figure (hundreds to tens of thousands); if it appears to be in EJ or TWh, you are likely on the wrong indicator page.
