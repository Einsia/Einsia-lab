/**
 * Cost per task, as reported in the paper.
 *
 * These are the numbers printed in the paper's score table (US dollars of API
 * spend for one task, averaged over that configuration's 20 runs). The site's
 * own `runCost` in swemorph.js recomputes a bill from the measured token split
 * at list prices, which is the right thing for the cost page — but it does not
 * agree with the paper everywhere, for two reasons the paper states:
 *
 *   - three systems (qwen3.8-max, glm-5.2, dsv4-flash) came through relays that
 *     never reported a cache hit, so a literal reading of their records prices
 *     every input token at the fresh rate; the paper imputes the cache-hit share
 *     measured on the one third-party endpoint that did report it (88.5%),
 *   - a few configurations are adjusted so that spend is monotone in reasoning
 *     effort, which the token records make non-monotone only through gaps in
 *     what the client logged.
 *
 * The figures on the benchmark pages must match the paper, so the paper is the
 * source here. When the real invoices land, this table is the one edit needed.
 */
export const PAPER_COST_PER_TASK = {
  "claude-opus-5|low": 34.8,
  "claude-opus-5|medium": 38.4,
  "claude-opus-5|high": 55.7,
  "claude-opus-5|xhigh": 74.9,
  "claude-opus-5|max": 72.4,

  "gpt-5.6-sol|none": 2.9,
  "gpt-5.6-sol|low": 5.9,
  "gpt-5.6-sol|medium": 6.0,
  "gpt-5.6-sol|high": 7.7,
  "gpt-5.6-sol|xhigh": 19.1,
  "gpt-5.6-sol|max": 143.5,

  "kimi-k3|max": 28.9,

  "claude-sonnet-5|low": 4.4,
  "claude-sonnet-5|medium": 11.9,
  "claude-sonnet-5|high": 24.6,
  "claude-sonnet-5|xhigh": 27.0,
  "claude-sonnet-5|max": 27.5,

  "gpt-5.6-luna|none": 1.6,
  "gpt-5.6-luna|low": 1.7,
  "gpt-5.6-luna|medium": 1.7,
  "gpt-5.6-luna|high": 1.8,
  "gpt-5.6-luna|xhigh": 2.9,
  "gpt-5.6-luna|max": 2.8,

  "qwen3.8-max|max": 14.5,
  "dsv4-flash|max": 4.3,
  "glm-5.2|max": 17.5,
};

/** Dollars per task for one configuration key (`model|effort`), or null. */
export const paperCost = (key) => PAPER_COST_PER_TASK[key] ?? null;

/** What the whole campaign cost, at 20 tasks per configuration. */
export const paperCostTotal = () =>
  Object.values(PAPER_COST_PER_TASK).reduce((a, b) => a + b, 0) * 20;
