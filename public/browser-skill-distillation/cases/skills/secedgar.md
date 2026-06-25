## Goal
Identify the {count} companies that filed 10-K reports in {year} containing the exact phrase "{search_phrase}" using the SEC EDGAR full-text search index.

## Preconditions
- No login required.
- The task start page is the EFTS search index at https://efts.sec.gov/LATEST/search-index (no parameters).

## Strategy (read this first — do NOT skip)
The SEC EFTS `/LATEST/search-index` endpoint returns a JSON object; its `hits.hits` array holds one entry per matching filing. Each entry exposes `_source.entity_name` (company name), `_source.form_type`, and `_source.file_date` directly — **the company name is readable from the search result JSON without opening any individual filing document**. Navigate once to the parameterized search URL, read the `hits.hits` array, and collect the first {count} distinct `entity_name` values whose `form_type` is `10-K` and `file_date` falls within {year}. Open individual filing documents only as a last resort if `entity_name` is absent from the JSON.

## Steps
1. On the task start page (EFTS search index, no parameters), navigate to the parameterized search URL:
   `https://efts.sec.gov/LATEST/search-index?q=%22{search_phrase_encoded}%22&forms=10-K&startdt={year}-01-01&enddt={year}-12-31`
   Default example: `https://efts.sec.gov/LATEST/search-index?q=%22cybersecurity%20incident%22&forms=10-K&startdt=2024-01-01&enddt=2024-12-31`
2. Read the JSON response. Locate `hits.hits`. Verify the array is non-empty before proceeding.
3. Iterate over `hits.hits` entries (at most the first 10). For each entry:
   a. Confirm `_source.form_type` is `10-K` (skip `10-K/A` amendments unless no pure `10-K` exists).
   b. Confirm `_source.file_date` falls within {year}-01-01 to {year}-12-31.
   c. Read `_source.entity_name` and add to the company name ledger if not already present.
   d. Stop iterating once {count} distinct names are collected.
4. Format the answer as a slash-separated list of the collected company names in order of appearance in the results.

## Hard Stop Rule
- Scan at most the first 10 entries of `hits.hits` to find {count} distinct qualifying company names.
- If `hits.hits` contains fewer than {count} qualifying entries, report however many were found.
- Do NOT open individual filing documents unless `_source.entity_name` is missing from the JSON; if forced to open documents, open at most {count} and read the company name from the document header.
- If the JSON response is empty or returns an error, retry the URL once; if still empty, answer `0 results found`.
- If you have navigated to the same filing URL already in this trajectory, do NOT navigate to it again — move to the next hit.

## Stop Rule
Stop as soon as {count} distinct qualifying company names have been collected and the slash-separated answer is ready.

## UI Control and Filter Guardrails
- The entire filter (phrase, form type, date range) is encoded directly in the query URL — no dropdown, date-picker, or form interaction is needed.
- Verify the filter took effect by confirming the loaded URL contains `q=%22{search_phrase_encoded}%22`, `forms=10-K`, `startdt={year}-01-01`, and `enddt={year}-12-31`.
- If the URL is correct but the response key structure differs (e.g. no `hits` key), try the EDGAR full-text search UI fallback: `https://efts.sec.gov/LATEST/search-index?q=%22{search_phrase_encoded}%22&dateRange=custom&startdt={year}-01-01&enddt={year}-12-31&forms=10-K`.
- Do NOT manually interact with any filter dropdowns or date pickers; always use the URL parameter approach.
- After two failed URL attempts with different parameter orderings, stop and answer with whatever company names have been collected.

## Extraction and Verification Guardrails
- Maintain a ledger: for each result accepted, record `entity_name`, `form_type`, and `file_date`.
- Only include entries where `form_type` equals `10-K` (exact) and `file_date` is within the {year} range.
- Deduplicate by `entity_name`; the same company may have multiple hits for amendments.
- After collecting {count} names, re-read your ledger and verify each name was read directly from `_source.entity_name` in the JSON, not inferred or recalled.
- For the final slash-separated answer, use the exact `entity_name` strings as returned by EFTS without abbreviation or reformatting.
