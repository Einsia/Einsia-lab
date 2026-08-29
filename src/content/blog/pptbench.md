---
draft: false
title: "PPTBench"
snippet: "A benchmark for faithful, editable reconstruction of scientific flow diagrams: 500 frozen tasks, native PowerPoint artifacts, and staged semantic and visual evaluation."
url: "/pptbench/"
publishDate: "2026-08-28"
author: "Navers lab · Einsia.AI"
category: "Benchmarks"
tags: [benchmark, powerpoint, diagrams, agents]
banner:
  src: "/pptbench/assets/task_0168-sol-max.png"
  alt: "PPTBench reference reconstruction preview"
links:
  - label: "Leaderboard"
    href: "/pptbench/leaderboard/"
    style: "outline"
  - label: "GitHub"
    href: "https://github.com/Einsia/PPTBench"
    style: "outline"
---

**PPTBench** measures whether an agent can turn a scientific flow diagram into a
one-page PowerPoint document that remains faithful, legible, and editable.

The frozen benchmark contains 500 answerable tasks across 13 source domains. It
reports artifact validity, process semantics, and structured visual detail
separately, so a plausible-looking slide cannot hide a broken process.
