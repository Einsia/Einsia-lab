/**
 * Frontier-Engineering Bench Evolution Dashboard
 * Routes: #/ | #/domain/:id | #/task/:id | #/test/:id
 * Language: zh | en (persisted in localStorage)
 */

(function () {
  const DATA_URL = 'data/bench_evolution.json';
  const LANG_KEY = 'site-lang';
  let benchData = null;
  let chartInstance = null;
  let lang = (localStorage && localStorage.getItem(LANG_KEY)) || (navigator.language && navigator.language.startsWith('zh') ? 'zh' : 'en');
  if (lang !== 'zh' && lang !== 'en') lang = 'en';

  const i18n = {
    zh: {
      navTitle: 'Frontier-Engineering Bench · 演化',
      backToLeaderboard: '← 排行榜',
      evolution: '演化',
      loading: '正在加载数据…',
      loadError: '加载数据失败，请检查 data/bench_evolution.json 是否存在。',
      scoreVsStep: '得分随迭代步数变化',
      description: '说明',
      byDomain: '按领域浏览',
      tasks: '任务',
      tests: '测试',
      subLevel: '下级',
      taskCount: '任务',
      testCount: '测试',
      overallTitle: '整体平均得分演化',
      overallSub: '各方法在全 Benchmark 上的平均归一化得分随迭代步数的变化',
      domainSuffix: ' 领域',
      taskSuffix: ' 任务',
      testPrefix: '测试 · ',
      langZh: '中文',
      langEn: 'English'
    },
    en: {
      navTitle: 'Frontier-Engineering Bench · Evolution',
      backToLeaderboard: '← Leaderboard',
      evolution: 'Evolution',
      loading: 'Loading…',
      loadError: 'Failed to load data. Check that data/bench_evolution.json exists.',
      scoreVsStep: 'Score vs iteration step',
      description: 'Description',
      byDomain: 'Browse by domain',
      tasks: 'Tasks',
      tests: 'Tests',
      subLevel: 'Sub-level',
      taskCount: 'tasks',
      testCount: 'tests',
      overallTitle: 'Overall average score evolution',
      overallSub: 'Normalized average score by method across the benchmark over iteration steps.',
      domainSuffix: ' domain',
      taskSuffix: ' task',
      testPrefix: 'Test · ',
      langZh: '中文',
      langEn: 'English'
    }
  };

  function t(key) {
    const set = i18n[lang] || i18n.en;
    return set[key] != null ? set[key] : (i18n.en[key] || key);
  }

  function nameFor(entity) {
    if (!entity) return '';
    if (lang === 'zh' && entity.name_zh) return entity.name_zh;
    return entity.name || entity.name_zh || '';
  }

  const ROUTES = {
    home: { re: /^#\/?$/, level: 'overall' },
    domain: { re: /^#\/domain\/([^/]+)\/?$/, level: 'domain' },
    task: { re: /^#\/task\/([^/]+)\/?$/, level: 'task' },
    test: { re: /^#\/test\/([^/]+)\/?$/, level: 'test' }
  };

  function parseRoute() {
    const hash = window.location.hash || '#/';
    for (const [name, { re, level }] of Object.entries(ROUTES)) {
      const m = hash.match(re);
      if (m) return { name, level, id: m[1] || null };
    }
    return { name: 'home', level: 'overall', id: null };
  }

  function getDomain(id) {
    return (benchData && benchData.domains) ? benchData.domains.find(d => d.id === id) : null;
  }

  function getTask(id) {
    return (benchData && benchData.tasks) ? benchData.tasks.find(t => t.id === id) : null;
  }

  function getTest(id) {
    return (benchData && benchData.tests) ? benchData.tests.find(t => t.id === id) : null;
  }

  function getEvolutionData(level, id) {
    if (!benchData || !benchData.evolution) return null;
    const evo = benchData.evolution;
    if (level === 'overall') return evo.overall || null;
    if (level === 'domain') return (evo.by_domain && evo.by_domain[id]) ? evo.by_domain[id] : null;
    if (level === 'task') return (evo.by_task && evo.by_task[id]) ? evo.by_task[id] : null;
    if (level === 'test') return (evo.by_test && evo.by_test[id]) ? evo.by_test[id] : null;
    return null;
  }

  function renderBreadcrumb(route) {
    const parts = [{ label: t('evolution'), href: '#/' }];
    if (route.name === 'domain' && route.id) {
      const d = getDomain(route.id);
      parts.push({ label: nameFor(d) || route.id, href: null });
    } else if (route.name === 'task' && route.id) {
      const task = getTask(route.id);
      const d = task ? getDomain(task.domain_id) : null;
      if (d) parts.push({ label: nameFor(d), href: '#/domain/' + d.id });
      parts.push({ label: nameFor(task) || route.id, href: null });
    } else if (route.name === 'test' && route.id) {
      const test = getTest(route.id);
      const task = test ? getTask(test.task_id) : null;
      const d = task ? getDomain(task.domain_id) : null;
      if (d) parts.push({ label: nameFor(d), href: '#/domain/' + d.id });
      if (task) parts.push({ label: nameFor(task), href: '#/task/' + task.id });
      parts.push({ label: (test && test.name) || route.id, href: null });
    }
    return parts.map((p) => {
      if (p.href) return `<a href="${p.href}">${escapeHtml(p.label)}</a>`;
      return `<span class="current">${escapeHtml(p.label)}</span>`;
    }).join('<span class="sep"> / </span>');
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function simpleMarkdownToHtml(md) {
    if (!md || typeof md !== 'string') return '';
    let html = md
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*?<\/li>\n?)+/gs, m => '<ul>' + m.trim() + '</ul>');
    html = html.split(/\n\n+/).map(block => {
      block = block.trim();
      if (!block) return '';
      if (block.startsWith('<')) return block;
      return '<p>' + block.replace(/\n/g, ' ') + '</p>';
    }).join('');
    return html;
  }

  function buildChartData(evolutionObj) {
    if (!evolutionObj || !benchData || !benchData.methods) return null;
    const methods = benchData.methods;
    const datasets = methods.map(m => {
      const series = evolutionObj[m.id];
      const data = Array.isArray(series) ? series.map(p => ({ x: p.step, y: p.score })) : [];
      return {
        label: m.name,
        data,
        borderColor: m.color || '#b8a060',
        backgroundColor: (m.color || '#b8a060') + '20',
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6
      };
    }).filter(d => d.data.length > 0);
    return datasets;
  }

  function drawChart(containerId, evolutionObj) {
    const canvas = document.getElementById(containerId);
    if (!canvas || !evolutionObj) return;
    const datasets = buildChartData(evolutionObj);
    if (!datasets || datasets.length === 0) return;

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    const ctx = canvas.getContext('2d');
    const allSteps = new Set();
    Object.values(evolutionObj).forEach(series => {
      if (Array.isArray(series)) series.forEach(p => allSteps.add(p.step));
    });
    const labels = Array.from(allSteps).sort((a, b) => a - b);

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets.map(d => ({
          ...d,
          data: labels.map(step => {
            const pt = d.data.find(p => p.x === step);
            return pt != null ? pt.y : null;
          })
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { color: 'rgba(0, 0, 0, 0.06)' },
            ticks: { color: '#6e6e80', maxTicksLimit: 12, font: { family: 'Inter, Noto Sans SC, -apple-system, sans-serif' } }
          },
          y: {
            min: 0,
            max: 1,
            grid: { color: 'rgba(0, 0, 0, 0.06)' },
            ticks: {
              color: '#6e6e80',
              font: { family: 'Inter, Noto Sans SC, -apple-system, sans-serif' },
              callback: v => (v * 100).toFixed(0) + '%'
            }
          }
        }
      }
    });
  }

  function renderLegend(evolutionObj) {
    if (!benchData || !benchData.methods || !evolutionObj) return '';
    return benchData.methods
      .filter(m => Array.isArray(evolutionObj[m.id]) && evolutionObj[m.id].length > 0)
      .map(m => `<span><span class="dot" style="background:${m.color || '#b8a060'}"></span>${escapeHtml(m.name)}</span>`)
      .join('');
  }

  function renderChildren(route) {
    if (route.name === 'home') {
      const domains = benchData.domains || [];
      return domains.map(d => {
        const n = (d.task_ids || []).length;
        const meta = lang === 'zh' ? `${d.name} · ${n} ${t('taskCount')}` : `${n} ${t('taskCount')}`;
        return `
        <a href="#/domain/${escapeHtml(d.id)}" class="evo-child-card">
          <div class="name">${escapeHtml(nameFor(d))}</div>
          <div class="meta">${escapeHtml(meta)}</div>
        </a>
      `;
      }).join('');
    }
    if (route.name === 'domain' && route.id) {
      const d = getDomain(route.id);
      const taskIds = (d && d.task_ids) ? d.task_ids : [];
      const tasks = taskIds.map(tid => getTask(tid)).filter(Boolean);
      return tasks.map(task => {
        const n = (task.test_ids || []).length;
        const meta = lang === 'zh' ? `${n} ${t('testCount')}` : `${n} ${t('testCount')}`;
        return `
        <a href="#/task/${escapeHtml(task.id)}" class="evo-child-card">
          <div class="name">${escapeHtml(nameFor(task))}</div>
          <div class="meta">${escapeHtml(meta)}</div>
        </a>
      `;
      }).join('');
    }
    if (route.name === 'task' && route.id) {
      const task = getTask(route.id);
      const testIds = (task && task.test_ids) ? task.test_ids : [];
      const tests = testIds.map(tid => getTest(tid)).filter(Boolean);
      return tests.map(test => `
        <a href="#/test/${escapeHtml(test.id)}" class="evo-child-card">
          <div class="name">${escapeHtml(test.name)}</div>
          <div class="meta">${escapeHtml(t('tests'))}</div>
        </a>
      `).join('');
    }
    return '';
  }

  function getTitleAndDesc(route) {
    if (route.name === 'home') {
      const metaDesc = (benchData && benchData.meta && benchData.meta.description) ? benchData.meta.description : null;
      return {
        title: t('overallTitle'),
        sub: t('overallSub'),
        desc: metaDesc
      };
    }
    if (route.name === 'domain' && route.id) {
      const d = getDomain(route.id);
      return {
        title: nameFor(d) || route.id,
        sub: d ? (d.name + t('domainSuffix')) : '',
        desc: d ? d.description_md : null
      };
    }
    if (route.name === 'task' && route.id) {
      const task = getTask(route.id);
      return {
        title: nameFor(task) || route.id,
        sub: task ? (task.name + t('taskSuffix')) : '',
        desc: task ? task.readme_md : null
      };
    }
    if (route.name === 'test' && route.id) {
      const test = getTest(route.id);
      const task = test ? getTask(test.task_id) : null;
      return {
        title: (test && test.name) || route.id,
        sub: test ? (t('testPrefix') + nameFor(task)) : '',
        desc: task ? task.readme_md : null
      };
    }
    return { title: '', sub: '', desc: null };
  }

  function render(route) {
    const breadcrumbEl = document.getElementById('evo-breadcrumb');
    const titleEl = document.getElementById('evo-title');
    const subEl = document.getElementById('evo-sub');
    const chartCard = document.getElementById('evo-chart-card');
    const chartWrap = document.getElementById('evo-chart-wrap');
    const legendEl = document.getElementById('evo-legend');
    const descCard = document.getElementById('evo-desc-card');
    const descBody = document.getElementById('evo-desc-body');
    const childrenSection = document.getElementById('evo-children-section');
    const childrenGrid = document.getElementById('evo-children-grid');

    if (!breadcrumbEl || !titleEl) return;

    breadcrumbEl.innerHTML = renderBreadcrumb(route);
    const { title, sub, desc } = getTitleAndDesc(route);
    titleEl.textContent = title;
    if (subEl) subEl.textContent = sub;

    const evolutionObj = getEvolutionData(route.level, route.id);
    if (chartCard && chartWrap) {
      if (evolutionObj) {
        chartCard.style.display = 'block';
        chartWrap.innerHTML = '<canvas id="evo-chart"></canvas>';
        drawChart('evo-chart', evolutionObj);
        if (legendEl) legendEl.innerHTML = renderLegend(evolutionObj);
      } else {
        chartCard.style.display = 'none';
        if (legendEl) legendEl.innerHTML = '';
      }
    }

    if (descCard && descBody) {
      if (desc) {
        descCard.style.display = 'block';
        descBody.innerHTML = simpleMarkdownToHtml(desc);
      } else {
        descCard.style.display = 'none';
      }
    }

    const chartTitleEl = chartCard ? chartCard.querySelector('h3') : null;
    if (chartTitleEl) chartTitleEl.textContent = t('scoreVsStep');
    const descTitleEl = descCard ? descCard.querySelector('h3') : null;
    if (descTitleEl) descTitleEl.textContent = t('description');

    if (childrenSection && childrenGrid) {
      const childHtml = renderChildren(route);
      const sectionTitle = childrenSection.querySelector('h3');
      if (childHtml) {
        childrenSection.style.display = 'block';
        childrenGrid.innerHTML = childHtml;
        if (sectionTitle) {
          sectionTitle.textContent = route.name === 'home' ? t('byDomain') : route.name === 'domain' ? t('tasks') : route.name === 'task' ? t('tests') : t('subLevel');
        }
      } else {
        childrenSection.style.display = 'none';
      }
    }
  }

  function updateNavLang() {
    const navTitle = document.getElementById('evo-nav-title');
    const backLink = document.getElementById('evo-back-link');
    const langZhBtn = document.getElementById('evo-lang-zh');
    const langEnBtn = document.getElementById('evo-lang-en');
    if (navTitle) navTitle.textContent = t('navTitle');
    if (backLink) backLink.textContent = t('backToLeaderboard');
    if (langZhBtn) { langZhBtn.textContent = t('langZh'); langZhBtn.classList.toggle('active', lang === 'zh'); }
    if (langEnBtn) { langEnBtn.textContent = t('langEn'); langEnBtn.classList.toggle('active', lang === 'en'); }
  }

  function runWithTransition(callback) {
    const inner = document.getElementById('evo-content-inner');
    if (!inner) {
      callback();
      return;
    }
    inner.classList.add('evo-leaving');
    const done = () => {
      callback();
      requestAnimationFrame(() => {
        inner.classList.remove('evo-leaving');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    };
    setTimeout(done, 240);
  }

  function setLang(newLang) {
    if (newLang === lang) return;
    lang = newLang;
    if (localStorage) localStorage.setItem(LANG_KEY, lang);
    if (document.documentElement) document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    updateNavLang();
    runWithTransition(() => render(parseRoute()));
  }

  function init() {
    const app = document.getElementById('evo-app');
    if (!app) return;
    app.innerHTML = `
      <nav class="evo-nav">
        <div class="container">
          <h1 id="evo-nav-title">${escapeHtml(t('navTitle'))}</h1>
          <div class="evo-nav-right">
            <span class="evo-lang-switch">
              <button type="button" id="evo-lang-zh" class="evo-lang-btn ${lang === 'zh' ? 'active' : ''}" aria-label="中文">${escapeHtml(t('langZh'))}</button>
              <button type="button" id="evo-lang-en" class="evo-lang-btn ${lang === 'en' ? 'active' : ''}" aria-label="English">${escapeHtml(t('langEn'))}</button>
            </span>
            <a href="index.html" id="evo-back-link">${escapeHtml(t('backToLeaderboard'))}</a>
            <a href="contact.html">Contact</a>
          </div>
        </div>
      </nav>
      <div class="container">
        <div id="evo-loading" class="evo-loading">
          <div class="evo-spinner"></div>
          <p>${escapeHtml(t('loading'))}</p>
        </div>
        <div id="evo-content" style="display:none;">
          <div id="evo-content-inner" class="evo-content-inner">
            <div id="evo-breadcrumb" class="evo-breadcrumb"></div>
            <div class="evo-title-block">
              <h2 id="evo-title"></h2>
              <p id="evo-sub" class="sub"></p>
            </div>
            <div class="evo-main-layout">
              <div>
                <div id="evo-chart-card" class="evo-chart-card" style="display:none;">
                  <h3>${escapeHtml(t('scoreVsStep'))}</h3>
                  <div id="evo-chart-wrap" class="evo-chart-wrap"></div>
                  <div id="evo-legend" class="evo-legend"></div>
                </div>
              </div>
              <div>
                <div id="evo-desc-card" class="evo-desc-card" style="display:none;">
                  <h3>${escapeHtml(t('description'))}</h3>
                  <div id="evo-desc-body" class="md-body"></div>
                </div>
              </div>
            </div>
            <div id="evo-children-section" class="evo-children-section" style="display:none;">
              <h3></h3>
              <div id="evo-children-grid" class="evo-child-grid"></div>
            </div>
          </div>
        </div>
        <div id="evo-error" class="evo-error" style="display:none;">
          <p>${escapeHtml(t('loadError'))}</p>
        </div>
      </div>
    `;

    document.getElementById('evo-lang-zh').addEventListener('click', (e) => { e.preventDefault(); setLang('zh'); });
    document.getElementById('evo-lang-en').addEventListener('click', (e) => { e.preventDefault(); setLang('en'); });

    fetch(DATA_URL)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Network error')))
      .then(data => {
        benchData = data;
        document.getElementById('evo-loading').style.display = 'none';
        document.getElementById('evo-content').style.display = 'block';
        render(parseRoute());
      })
      .catch(() => {
        document.getElementById('evo-loading').style.display = 'none';
        document.getElementById('evo-error').style.display = 'block';
      });

    window.addEventListener('hashchange', () => {
      runWithTransition(() => render(parseRoute()));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
