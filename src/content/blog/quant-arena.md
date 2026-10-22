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
  # The /research card reads the teaser from src/lib/quant-arena.js; this is
  # the fallback for any other place that renders the banner.
  src: "/quant-arena/teaser.jpg"
  alt: "Quant-Arena teaser"
links:
  - label: "Paper"
    href: "https://arxiv.org/abs/2610.30113"
    style: "outline"
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

Nine frontier models are evaluated, and no model beats the equal-weight market
in 2024: the stocks a model ranks highest typically underperform, and the
strongest model gains mainly by learning when to stay out of the market. See the [overview](/quant-arena/) and the
[full leaderboard](/quant-arena/leaderboard/).
