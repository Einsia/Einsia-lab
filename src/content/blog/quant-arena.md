---
draft: false
title: "Quant-Arena: Benchmarking LLM Agents for Quantitative Trading Research"
snippet: "A benchmark for quantitative research with LLMs: each model researches on 2022–2023 with bounded feedback, commits one strategy, and is assessed once on a sealed 2024 window in a cash account."
url: "/quant-arena/"
publishDate: "2026-10-21"
author: "LaPlace's Eye · Einsia AI"
category: "Benchmarks"
tags: [benchmark, quantitative-finance, research, agents]
banner:
  src: "/quant-arena/fig-nav-max.webp"
  alt: "2024 cash-account NAV of each model's strategy against Kepler-1 and the equal-weight market"
links:
  - label: "Overview"
    href: "/quant-arena/"
    style: "outline"
  - label: "Leaderboard"
    href: "/quant-arena/leaderboard/"
    style: "outline"
---

**Quant Arena** measures whether a language model can act as a quantitative
researcher: research a strategy on 2022–2023 with bounded feedback, commit to
one strategy, and have it hold up when it is assessed once on a sealed 2024
window in a cash account.

Nine models are evaluated at every available reasoning effort in two settings,
iterative research and one-shot generation. Every model trails Kepler-1, a
proprietary strategy developed by Einsia AI whose construction is not
disclosed, by a wide margin, and no model beats the equal-weight market in
2024. See the [overview](/quant-arena/) and the
[full leaderboard](/quant-arena/leaderboard/).
