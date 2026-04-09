# Navers lab

Lab homepage for [lab.einsia.ai](https://lab.einsia.ai), built with Astro.

## Project Structure

```
/
├── public/
│   └── frontier-eng/     # FE-Leaderboard (static, untouched by Astro)
└── src/
    ├── layouts/
    │   └── Layout.astro  # Shared nav + footer
    └── pages/
        └── index.astro   # Homepage
```

## Contributing (Design)

### First-time setup

**Prerequisites**: Node.js 22+. Check with `node -v`. If below 22, install from [nodejs.org](https://nodejs.org).

```bash
git clone https://github.com/Einsia/Einsia-lab.git
cd Einsia-lab
npm install
```

### Local preview

```bash
npm run dev
```

Open [http://localhost:4321/Einsia-lab/](http://localhost:4321/Einsia-lab/) in your browser. Changes to files under `src/` are reflected instantly without refreshing.

### Workflow

```bash
# 1. Create a branch for your changes
git checkout -b design/your-change-name

# 2. Make changes, preview at localhost:4321/Einsia-lab/

# 3. Commit and push
git add .
git commit -m "style: describe what you changed"
git push origin design/your-change-name

# 4. Open a Pull Request to main on GitHub
#    Production deploys automatically once merged to main
```

> **Note**: Only `main` branch triggers a production deploy. Your branch is safe to push freely.

## Files to edit

| What you want to change | File |
|------------------------|------|
| Homepage layout / copy | `src/pages/index.astro` |
| Nav, footer, global styles | `src/layouts/Layout.astro` |
| Leaderboard pages | `public/frontier-eng/` |
