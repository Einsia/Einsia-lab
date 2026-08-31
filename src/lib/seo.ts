export interface LabSeo {
  title: string;
  ogTitle: string;
  description: string;
  canonical: string;
  image: string;
  imageAlt: string;
  ogType: "website" | "article";
  schemaTypes: readonly string[];
}

export const LAB_SITE_URL = "https://lab.einsia.ai";
export const LAB_SITE_NAME = "Navers Lab - Einsia";
export const INDEX_ROBOTS =
  "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";

export const LAB_SEO_ROUTES: Record<string, LabSeo> = {
  "/": {
    title: "Frontier AI Research & Benchmarks | Navers Lab - Einsia",
    ogTitle: "Frontier AI Research & Benchmarks",
    description:
      "Navers Lab - Einsia benchmarks frontier AI agents, builds open tools and frameworks, and studies what it takes for agents to do real work.",
    canonical: `${LAB_SITE_URL}/`,
    image: `${LAB_SITE_URL}/og/home.png`,
    imageAlt:
      "Navers Lab - Einsia: benchmark, build, and break frontier AI agents",
    ogType: "website",
    schemaTypes: ["Organization"],
  },
  "/research": {
    title: "AI Agent Benchmarks & Research | Navers Lab - Einsia",
    ogTitle: "AI Agent Benchmarks & Research",
    description:
      "Explore Navers Lab - Einsia research on real-world AI agent evaluation, software engineering, browser use, algorithmic design, and engineering optimization.",
    canonical: `${LAB_SITE_URL}/research/`,
    image: `${LAB_SITE_URL}/og/research.png`,
    imageAlt:
      "Navers Lab - Einsia research projects and AI agent benchmarks",
    ogType: "website",
    schemaTypes: ["CollectionPage"],
  },
  "/about": {
    title: "About Navers Lab - Einsia | Real-World AI Agent Research",
    ogTitle: "About Navers Lab - Einsia | Real-World AI Agent Research",
    description:
      "Navers Lab - Einsia studies the limits of AI agents on real work, building rigorous benchmarks, agent systems, and open research infrastructure.",
    canonical: `${LAB_SITE_URL}/about/`,
    image: `${LAB_SITE_URL}/og/about.png`,
    imageAlt: "About Navers Lab - Einsia and real-world AI agent research",
    ogType: "website",
    schemaTypes: ["AboutPage"],
  },
  "/swe-refactor-bench": {
    title: "SWE Refactor Bench | AI Code Migration Benchmark",
    ogTitle: "SWE Refactor Bench | AI Code Migration Benchmark",
    description:
      "Evaluate coding agents on 20 whole-repository migrations with audits, behavioral tests, and adversarial verification—not just passing tests.",
    canonical: `${LAB_SITE_URL}/swe-refactor-bench/`,
    image: `${LAB_SITE_URL}/og/swe-refactor-bench.png`,
    imageAlt:
      "SWE Refactor Bench three-stage software migration evaluation",
    ogType: "article",
    schemaTypes: ["Dataset", "ScholarlyArticle"],
  },
  "/swe-refactor-bench/leaderboard": {
    title: "SWE Refactor Bench Leaderboard | Coding Agents",
    ogTitle: "SWE Refactor Bench Leaderboard | Coding Agents",
    description:
      "Compare coding agents on SWE Refactor Bench: 20 whole-repository migrations evaluated for real migration, behavior preservation, and verification.",
    canonical: `${LAB_SITE_URL}/swe-refactor-bench/leaderboard/`,
    image: `${LAB_SITE_URL}/og/swe-refactor-bench-leaderboard.png`,
    imageAlt: "SWE Refactor Bench coding agent leaderboard",
    ogType: "website",
    schemaTypes: ["Dataset"],
  },
  "/swe-refactor-bench/tasks": {
    title: "SWE Refactor Bench Tasks | 20 Software Migrations",
    ogTitle: "SWE Refactor Bench Tasks | 20 Software Migrations",
    description:
      "Browse 20 real software stack-migration tasks for evaluating long-horizon coding agents across language, framework, platform, and toolchain rewrites.",
    canonical: `${LAB_SITE_URL}/swe-refactor-bench/tasks/`,
    image: `${LAB_SITE_URL}/og/swe-refactor-bench-tasks.png`,
    imageAlt:
      "Twenty whole-repository software migration tasks in SWE Refactor Bench",
    ogType: "website",
    schemaTypes: ["CollectionPage", "Dataset"],
  },
  "/ai4ai": {
    title: "AI4AI-Bench | AI Agent Algorithm Design Benchmark",
    ogTitle: "AI4AI-Bench | AI Agent Algorithm Design Benchmark",
    description:
      "AI4AI-Bench evaluates whether coding agents can improve real AI training methods across ten frozen research codebases and sealed evaluations.",
    canonical: `${LAB_SITE_URL}/ai4ai/`,
    image: `${LAB_SITE_URL}/og/ai4ai.png`,
    imageAlt: "AI4AI-Bench: agents improving AI training methods",
    ogType: "article",
    schemaTypes: ["Dataset", "ScholarlyArticle"],
  },
  "/ai4ai/tasks": {
    title: "AI4AI-Bench Task Gallery | Algorithm Design Tasks",
    ogTitle: "AI4AI-Bench Task Gallery | Algorithm Design Tasks",
    description:
      "Browse ten frozen research-codebase tasks that test whether AI agents can improve training methods under sealed, held-out evaluation.",
    canonical: `${LAB_SITE_URL}/ai4ai/tasks/`,
    image: `${LAB_SITE_URL}/og/ai4ai-tasks.png`,
    imageAlt: "AI4AI-Bench algorithm-design task gallery",
    ogType: "website",
    schemaTypes: ["CollectionPage", "Dataset"],
  },
  "/ai4ai/trajectories": {
    title: "AI4AI-Bench Trajectories | Agent Experiment Explorer",
    ogTitle: "AI4AI-Bench Trajectories | Agent Experiment Explorer",
    description:
      "Explore 290 redacted AI4AI-Bench agent trajectories, including candidate methods, proxy evidence, formal replays, and audit records.",
    canonical: `${LAB_SITE_URL}/ai4ai/trajectories/`,
    image: `${LAB_SITE_URL}/og/ai4ai-trajectories.png`,
    imageAlt: "AI4AI-Bench agent trajectory explorer",
    ogType: "website",
    schemaTypes: ["Dataset"],
  },
  "/browserbc": {
    title: "BrowserBC | Browser Agent Skill Distillation",
    ogTitle: "BrowserBC | Browser Agent Skill Distillation",
    description:
      "BrowserBC distills human browser trajectories into reusable skills to improve browser-agent success rates and interaction efficiency.",
    canonical: `${LAB_SITE_URL}/browserbc/`,
    image: `${LAB_SITE_URL}/og/browserbc.png`,
    imageAlt:
      "BrowserBC workflow: human browser trajectories distilled into reusable agent skills",
    ogType: "article",
    schemaTypes: ["ScholarlyArticle", "ResearchProject"],
  },
  "/browserbc/cases": {
    title: "BrowserBC Live Demos | Browser Agent Skills",
    ogTitle: "BrowserBC Live Demos | Browser Agent Skills",
    description:
      "Watch BrowserBC skill-guided agents complete real browser tasks with fewer actions, from public-data research to shopping and travel workflows.",
    canonical: `${LAB_SITE_URL}/browserbc/cases/`,
    image: `${LAB_SITE_URL}/og/browserbc-cases.png`,
    imageAlt: "BrowserBC live browser-agent task demonstrations",
    ogType: "website",
    schemaTypes: ["CollectionPage"],
  },
  "/openchronicle": {
    title: "OpenChronicle | Open-Source Local-First Agent Memory",
    ogTitle: "OpenChronicle | Open-Source Local-First Agent Memory",
    description:
      "OpenChronicle is open-source, local-first memory for tool-using AI agents—private by default, model-agnostic, inspectable, and hackable.",
    canonical: `${LAB_SITE_URL}/openchronicle/`,
    image: `${LAB_SITE_URL}/og/openchronicle.png`,
    imageAlt: "OpenChronicle local-first, open-source memory for AI agents",
    ogType: "website",
    schemaTypes: ["SoftwareApplication", "SoftwareSourceCode"],
  },
  "/frontier-eng": {
    title: "Frontier-Engineering | AI Agent Optimization Benchmark",
    ogTitle: "Frontier-Engineering | AI Agent Optimization Benchmark",
    description:
      "Frontier-Engineering evaluates AI agents on 47 real engineering optimization tasks with frozen domain verifiers and iterative feedback.",
    canonical: `${LAB_SITE_URL}/frontier-eng/`,
    image: `${LAB_SITE_URL}/og/frontier-eng.png`,
    imageAlt: "Frontier-Engineering benchmark for AI agent optimization",
    ogType: "article",
    schemaTypes: ["Dataset", "ScholarlyArticle"],
  },
  "/frontier-eng/leaderboard": {
    title: "Frontier-Engineering Leaderboard | AI Agent Benchmark",
    ogTitle: "Frontier-Engineering Leaderboard | AI Agent Benchmark",
    description:
      "Compare frontier AI models on 47 real engineering optimization tasks using average rank, medal score, and frozen domain-verifier results.",
    canonical: `${LAB_SITE_URL}/frontier-eng/leaderboard/`,
    image: `${LAB_SITE_URL}/og/frontier-eng-leaderboard.png`,
    imageAlt: "Frontier-Engineering AI agent benchmark leaderboard",
    ogType: "website",
    schemaTypes: ["Dataset"],
  },
  "/frontier-eng/tasks": {
    title: "Frontier-Engineering Tasks | 47 Engineering Problems",
    ogTitle: "Frontier-Engineering Tasks | 47 Engineering Problems",
    description:
      "Browse 47 engineering optimization tasks across 18 subfields, each evaluated by a frozen domain verifier and per-task leaderboard.",
    canonical: `${LAB_SITE_URL}/frontier-eng/tasks/`,
    image: `${LAB_SITE_URL}/og/frontier-eng-tasks.png`,
    imageAlt:
      "Frontier-Engineering task directory across 18 engineering subfields",
    ogType: "website",
    schemaTypes: ["CollectionPage", "Dataset"],
  },
};

export function normalizeLabPath(pathname: string) {
  return pathname !== "/" ? pathname.replace(/\/+$/, "") : "/";
}

export function getLabSeo(pathname: string) {
  return LAB_SEO_ROUTES[normalizeLabPath(pathname)];
}

export function getLabStructuredData(seo: LabSeo) {
  const organization = {
    "@type": "Organization",
    "@id": `${LAB_SITE_URL}/#organization`,
    name: LAB_SITE_NAME,
    url: `${LAB_SITE_URL}/`,
    parentOrganization: {
      "@type": "Organization",
      name: "Einsia",
      url: "https://einsia.ai/",
    },
    sameAs: ["https://github.com/Einsia"],
  };

  const graph: Record<string, unknown>[] = [organization];
  if (!seo.schemaTypes.includes("Organization")) {
    const entity: Record<string, unknown> = {
      "@type":
        seo.schemaTypes.length === 1 ? seo.schemaTypes[0] : seo.schemaTypes,
      "@id": `${seo.canonical}#entity`,
      name: seo.ogTitle,
      headline: seo.ogTitle,
      description: seo.description,
      url: seo.canonical,
      mainEntityOfPage: seo.canonical,
      publisher: { "@id": `${LAB_SITE_URL}/#organization` },
    };

    if (seo.schemaTypes.includes("SoftwareApplication")) {
      entity.applicationCategory = "DeveloperApplication";
      entity.operatingSystem = "Cross-platform";
    }
    if (seo.schemaTypes.includes("SoftwareSourceCode")) {
      entity.codeRepository = "https://github.com/Einsia/OpenChronicle";
      entity.license = "https://opensource.org/licenses/MIT";
    }

    graph.push(entity);
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}
