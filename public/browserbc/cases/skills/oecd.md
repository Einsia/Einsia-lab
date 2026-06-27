## Goal
Find the PISA {year} mathematics mean score (indicator PEE_PISA_M) for {countries} from the OECD Data Explorer and report the value(s).

## Preconditions
- No authentication required.
- The task start page is https://data-explorer.oecd.org/.

## Strategy (read this first — do NOT skip)
The PISA mathematics mean score is stored in the OECD SDMX dataflow `DSD_GOV_INT@DF_GOV_SPS_2025` under the agency `OECD.GOV.GIP`, indicator code `PEE_PISA_M`. The fastest and most reliable path is to construct and navigate to the direct `/vis` URL with the correct dimension query (`dq`) that filters by country ISO-3 codes and the indicator, then read the table. The table view (`vw=tb`) shows one row per time period and one column per country. All required values are visible directly in the table — no further drill-in is needed.

## Steps
1. On the task start page (OECD Data Explorer home), do NOT interact with the search box. Instead, navigate directly to the following URL, substituting the ISO-3 country codes for `{country_codes}` (e.g. `JPN%2BKOR%2BUSA` for Japan, Korea, USA):

   `https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_GOV_INT%40DF_GOV_SPS_2025&df[ag]=OECD.GOV.GIP&df[vs]=1.1&dq=A.{country_codes}.PEE_PISA_M......&lom=LASTNPERIODS&lo=5&to[TIME_PERIOD]=false&vw=tb`

   For the default task (Japan / Korea / USA), the ready-to-use URL is:
   `https://data-explorer.oecd.org/vis?df[ds]=dsDisseminateFinalDMZ&df[id]=DSD_GOV_INT%40DF_GOV_SPS_2025&df[ag]=OECD.GOV.GIP&df[vs]=1.1&dq=A.JPN%2BKOR%2BUSA.PEE_PISA_M......&lom=LASTNPERIODS&lo=5&to[TIME_PERIOD]=false&vw=tb`

2. Wait for the table to fully render. Verify the filter took effect by confirming:
   - The page title or dataset label references "Government at a Glance" or `DSD_GOV_INT` / `DF_GOV_SPS_2025`.
   - The table has columns for each requested country (e.g. Japan, Korea, United States).
   - The TIME_PERIOD column lists years including {year}.

3. In the table, locate the row where `TIME_PERIOD` equals `{year}` (e.g. 2022).

4. For each requested country, read the numeric value in the column corresponding to that country in the `{year}` row. Record these values as your candidate ledger:
   - Japan (JPN): `<value>`
   - Korea (KOR): `<value>`
   - United States (USA): `<value>`

5. Cross-check: confirm each value is a 3-digit number in the range 350–650 (typical PISA math scores). If a cell is blank or shows `..`, the data is unavailable for that country/year — report `N/A` for that entry.

6. Stop and answer with the values in the format: `JP <value> KR <value> US <value>`.

## Hard Stop Rule
- Navigate to the direct `/vis` URL at most once; do NOT reload or re-search if the table renders.
- Do NOT click into individual data cells or drill down further; all required values are visible in the top-level table.
- If the table does not render after one navigation attempt, try removing `&to[TIME_PERIOD]=false` from the URL and reload once. If still broken, answer with whatever partial values are visible.
- If zero rows match `{year}`, report the most recent available year's values and note the year used.

## Stop Rule
The task is complete when you have read and recorded the numeric PISA mathematics mean score for every requested country from the `{year}` row of the table.

## UI Control and Filter Guardrails
- Prefer the direct `/vis` URL over any search-box or dropdown workflow; it bypasses unreliable date-picker and facet-filter controls.
- Verify the URL loaded correctly by checking the browser address bar contains `PEE_PISA_M` and the ISO-3 codes for the requested countries.
- If the dataset selector shows a different `df[id]`, the wrong dataflow loaded — navigate again with the exact URL above.
- Do not attempt to change filters via the UI sidebar; the query string already encodes all required filters.
- If the table shows more columns than the requested countries, ignore the extra columns and read only the target country columns.

## Extraction and Verification Guardrails
- Candidate ledger fields: Country (ISO-3), TIME_PERIOD (year), Score (numeric, 2 decimal places).
- Evidence required before recording a value: the row's TIME_PERIOD cell must equal `{year}` AND the column header must match the requested country name or ISO-3 code.
- For numeric answers, read the cell value exactly as displayed (do not round). If the table shows `535.58`, record `535.58`.
- Recompute check: after reading all values, verify the count of non-null values equals the count of requested countries. If any are missing, scroll down at most once to see if additional rows are present before reporting `N/A`.
- Final answer format: list each country's score in the order requested, e.g. `JP 535.58 KR 527.30 US 464.89`.
