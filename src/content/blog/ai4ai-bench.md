---
draft: false
title: "AI4AI-Bench"
snippet: "Give a coding agent a real research codebase and four hours to improve how it trains a model. Most tune the settings around the existing method; few rewrite the method itself."
url: "/ai4ai/"
publishDate: "2026-08-21"
author: "Navers lab · Einsia.AI"
category: "Benchmark"
tags: [coding-agents, training-algorithms, benchmark, recursive-self-improvement]
banner:
  src: "/ai4ai/figures/logo-banner.webp"
  alt: "AI4AI-Bench"
links:
  - label: "GitHub"
    href: "https://github.com/Einsia/AI4AI-Bench"
    style: "outline"
  - label: "Tasks"
    href: "/ai4ai/tasks/"
    style: "outline"
  - label: "Trajectories"
    href: "/ai4ai/trajectories/"
    style: "outline"
---

Ten frozen research codebases, each with the training code its authors actually
ran. An agent gets four hours to rewrite that code; the rewrite is then trained
from scratch in a container the agent cannot reach and scored on a held-out test
it never saw. Every task is placed on one axis where 0.1 is the code that was
already there and 1.0 is a perfect result.
