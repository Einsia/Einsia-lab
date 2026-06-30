# Navers lab

Lab homepage for [lab.einsia.ai](https://lab.einsia.ai), built with
[Astro](https://astro.build) on the
[Astroship](https://github.com/surjithctly/astroship) starter (Astro +
Tailwind CSS v4). Styling mirrors the monochrome
[einsia-homepage](https://einsia.ai) design system — Georgia serif headings,
Inter body, black ink on near-white paper.

## Project Structure

```
/
├── public/
│   ├── frontier-eng/         # FE-Leaderboard (static, untouched by Astro)
│   └── browserbc/            # BrowserBC paper showcase (static)
└── src/
    ├── styles/global.css     # Tailwind v4 + design tokens (colors, fonts)
    ├── layouts/Layout.astro  # <head>, SEO, Navbar + Footer
    ├── components/           # navbar, footer, container, sectionhead, ui/*
    ├── content/
    │   ├── config.ts         # Blog collection schema
    │   └── blog/*.md         # Blog posts (one Markdown file per post)
    └── pages/
        ├── index.astro       # Homepage
        ├── blog.astro        # Blog index
        └── blog/[slug].astro # Generated post pages
```

`/news` and `/benchmarks` redirect to `/blog`.

## Tech stack

- **Astro 5** (static output)
- **Tailwind CSS v4** via `@tailwindcss/vite`
- **Content Collections** for the blog (`src/content/blog`)
- `astro-navbar`, `astro-seo`, `astro-icon`, `@astrojs/sitemap`, `@astrojs/mdx`

## Contributing (Design)

### First-time setup

**Prerequisites**: Node.js 18.17.1+ (20.3+ or 22+ recommended). Check with
`node -v`.

```bash
git clone https://github.com/Einsia/Einsia-lab.git
cd Einsia-lab
npm install
```

### Local preview

```bash
npm run dev
```

Open [http://localhost:4321/](http://localhost:4321/) in your browser. Changes
to files under `src/` are reflected instantly.

### Workflow

```bash
# 1. Create a branch for your changes
git checkout -b design/your-change-name

# 2. Make changes, preview at localhost:4321

# 3. Commit and push
git add .
git commit -m "style: describe what you changed"
git push origin design/your-change-name

# 4. Open a Pull Request to main on GitHub
#    Production deploys automatically once merged to main
```

> **Note**: Only `main` branch triggers a production deploy. Your branch is safe
> to push freely.

## Files to edit

| What you want to change            | File                            |
| ---------------------------------- | ------------------------------- |
| Homepage layout / copy             | `src/pages/index.astro`         |
| Add / edit a blog post             | `src/content/blog/*.md`         |
| Blog index layout                  | `src/pages/blog.astro`          |
| Nav / footer                       | `src/components/`               |
| Colors, fonts, global styles       | `src/styles/global.css`         |
| Leaderboard / paper pages (static) | `public/frontier-eng/`, `public/browserbc/` |

### Adding a blog post

Create a Markdown file in `src/content/blog/`:

```yaml
---
draft: false
title: "Post title"
snippet: "One-line summary shown on the blog index."
publishDate: "2026-06-30"
author: "Navers lab"
category: "Benchmarks"
tags: [tag-one, tag-two]
links: # optional call-to-action buttons
  - label: "Open benchmark"
    href: "/frontier-eng/index.html"
    style: "primary"
---

Markdown body goes here.
```
