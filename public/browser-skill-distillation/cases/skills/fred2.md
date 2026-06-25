## Goal
Identify the FRED series ID for {search_query} (e.g. Texas Total Nonfarm Employment, seasonally adjusted), record it, set the date range from {start_date} to {end_date}, and download the series data as a CSV file.

## Preconditions
- Browser is open at https://fred.stlouisfed.org/
- No authentication required

## Strategy (read this first — do NOT skip)
FRED exposes a direct CSV download URL of the form `/graph/fredgraph.csv?id={series_id}&cosd={start_date}&coed={end_date}`. Once you have identified the series ID from the search results page or series detail page URL, you can construct and navigate to this URL directly — bypassing all date-picker interactions — to both confirm the answer and trigger the download. The series ID is always visible in the `/series/{series_id}` URL after clicking a result. The date range fields on the series page are plain text inputs; clear them fully before typing.

## Steps
1. On the FRED homepage, locate the search input labeled "Search FRED Data..." and type "{search_query}" (e.g. "Texas Total Nonfarm Employment seasonally adjusted"), then press Enter.
2. On the /searchresults page, scan the result links for the entry whose title most closely matches the desired indicator and region (e.g. "All Employees: Total Nonfarm in Texas"). Click that link.
3. On the /series/{series_id} page, read the series ID from the page URL (the segment after /series/). Record it — this is the answer's series identifier (e.g. TXNA).
4. Locate the "Change start date" input field. Click it, press Meta+a (or Ctrl+a) to select all, press Backspace to clear, then type "{start_date}" (format YYYY-MM-DD), then press Enter.
5. Locate the "Change end date" input field. Click it, press Meta+a (or Ctrl+a) to select all, press Backspace to clear, then type "{end_date}" (format YYYY-MM-DD), then press Enter.
6. Verify the date range was applied: the start date field should now display {start_date} and the end date field should display {end_date}. If either field still shows the old value, repeat the clear-and-type step once more for that field only.
7. **Preferred shortcut**: Navigate directly to `https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}&cosd={start_date}&coed={end_date}`. This both downloads the CSV and confirms the series ID and date parameters in the URL.
8. If the direct URL navigation is not possible, click the "Download" button on the series page, then click the "CSV (data)" link in the dropdown that appears.
9. Stop and report: the series ID (e.g. TXNA) and the CSV download URL with query parameters `cosd={start_date}&coed={end_date}`.

## Hard Stop Rule
- Search results may return multiple series; click only the single best-matching result. Do not iterate through multiple series.
- If no search result matches the desired indicator and region, refine the search query by removing words (e.g. drop "seasonally adjusted") and try once more. If still no match after two attempts, stop and report "not found".
- Attempt to clear and set each date field at most twice. If the field still shows the wrong value after two attempts, proceed with the direct CSV URL shortcut using the correct date parameters.
- Do not re-open the search results page once you have identified the series ID from the /series/ URL.

## Stop Rule
The task is complete when: (a) the series ID has been read from the /series/{series_id} URL, and (b) the browser has navigated to or downloaded from `/graph/fredgraph.csv?id={series_id}&cosd={start_date}&coed={end_date}`.

## UI Control and Filter Guardrails
- The date inputs on FRED series pages often contain a pre-filled default date. Always clear the entire field (Meta+a then Backspace) before typing the new date to avoid appending to the existing value.
- After pressing Enter on a date field, verify the input now displays the intended date. If it reverted to the default, the Enter key may not have committed the change — try clicking elsewhere on the page and then re-read the field.
- The most reliable method is the direct CSV URL: `https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}&cosd={start_date}&coed={end_date}`. Prefer this over manual date-picker steps whenever the series ID is known.
- Proof that the date filter was applied: the CSV URL query string contains the exact `cosd` and `coed` values you specified.

## Extraction and Verification Guardrails
- The series ID is the path segment in the URL `/series/XXXX` — read it character-by-character if needed; do not guess or paraphrase it.
- The final answer must include: (1) the literal series ID string, (2) the CSV download URL or confirmation that `cosd={start_date}&coed={end_date}` are present in the downloaded file's URL.
- Do not report a series ID from the search results page title alone; confirm it from the /series/ URL after clicking through.
- If multiple series appear plausible, prefer the one whose title contains both the region name and the exact indicator phrase from the task.
