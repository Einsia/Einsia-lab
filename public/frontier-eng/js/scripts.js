// Main script file — supports dual experiment leaderboards (Model / Framework)

// ── Global state ─────────────────────────────────────────────────────────────
let currentSort = { key: null, direction: 'asc' };
let tasksList   = null;

// Active experiment: 'model' | 'framework'
let activeExp  = 'model';

// Overall rankings cache keyed by experiment
let overallCache = { model: null, framework: null };

// Currently displayed task name (for language-switch refresh)
let _currentTaskName = null;
let _currentMetadata = null;

// Keep frontend display consistent even when legacy YAML still contains old aliases.
const PARTICIPANT_DISPLAY_NAME_MAP = {
  'claude-opus-4.6': 'Claude Opus 4.6',
  'deepseek-v3.2': 'DeepSeek V3.2',
  'gemini-3.1-pro-preview': 'Gemini 3.1 Pro Preview',
  'glm-5': 'GLM-5',
  'gpt-5.4': 'GPT-5.4',
  'grok-4.20': 'Grok 4.20',
  'qwen3-coder-next': 'Qwen3 Coder Next',
  'seed-2.0-pro': 'SEED 2.0 Pro',
  'Opus4.6+abmcts': 'Claude Opus 4.6 + ABMCTS',
  'Opus4.6+openevolve': 'Claude Opus 4.6 + OpenEvolve',
  'Opus4.6+shinkaevolve': 'Claude Opus 4.6 + ShinkaiEvolve',
  'GPToss+abmcts': 'GPT-OSS + ABMCTS',
  'GPToss+openevolve': 'GPT-OSS + OpenEvolve',
  'GPToss+shinkaevolve': 'GPT-OSS + ShinkaiEvolve'
};

// Mean within-task ranks over 47 tasks under openevolve (lower is better).
const MODEL_AVERAGE_RANK_MAP = {
  'claude opus 4.6': 3.18,
  'qwen3 coder next': 6.68,
  'seed 2.0 pro': 5.63,
  'gpt-5.4': 5.68,
  'glm-5': 4.02,
  'deepseek v3.2': 4.41,
  'grok 4.20': 5.60,
  'gemini 3.1 pro preview': 5.34
};

function getDisplayParticipantName(name) {
  if (!name) return 'Unknown';
  return PARTICIPANT_DISPLAY_NAME_MAP[name] || name;
}

function getModelAverageRank(name) {
  var key = (name || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return Object.prototype.hasOwnProperty.call(MODEL_AVERAGE_RANK_MAP, key)
    ? MODEL_AVERAGE_RANK_MAP[key]
    : null;
}

// Map participant names to provider icon filenames
const MODEL_ICON_MAP = {
  // Anthropic / Claude
  'claude':       'anthropic',
  'opus':         'anthropic',
  // OpenAI / GPT
  'gptoss':       'openai',
  'gpt':          'openai',
  // Google / Gemini
  'gemini':       'gemini',
  // DeepSeek
  'deepseek':     'deepseek',
  // xAI / Grok
  'grok':         'grok',
  // Zhipu / GLM
  'glm':          'zhipu',
  // ByteDance / Seed
  'seed':         'bytedance',
  // Alibaba / Qwen
  'qwen':         'qwen',
};

// Brand colors for icon background pill
const BRAND_COLORS = {
  'anthropic': '#c77f5e',
  'openai':    '#10a37f',
  'gemini':    '#8b5cf6',
  'deepseek':  '#4d6bfe',
  'grok':      '#1a1a2e',
  'xai':       '#1a1a2e',
  'zhipu':     '#111111',
  'bytedance': '#1d53e8',
  'qwen':      '#5e59df',
};

// Slugs that use SVG instead of PNG (already colored, no filter needed)
const SVG_ICON_SLUGS = { 'zhipu': true, 'anthropic': true };

// CSS filters to colorize black PNG icons → brand color
// Generated via https://codepen.io/sosuke/pen/Pjoqqp logic for each hex
const BRAND_FILTERS = {
  'openai':    'invert(49%) sepia(72%) saturate(400%) hue-rotate(122deg) brightness(88%) contrast(91%)',   // #10a37f green
  'gemini':    'invert(37%) sepia(80%) saturate(600%) hue-rotate(240deg) brightness(95%) contrast(95%)',   // #8b5cf6 purple
  'deepseek':  'invert(35%) sepia(90%) saturate(600%) hue-rotate(215deg) brightness(105%) contrast(105%)', // #4d6bfe blue
  'grok':      'invert(10%) sepia(20%) saturate(300%) hue-rotate(200deg) brightness(30%) contrast(110%)',  // dark
  'xai':       'invert(10%) sepia(20%) saturate(300%) hue-rotate(200deg) brightness(30%) contrast(110%)',
  'bytedance': 'invert(25%) sepia(90%) saturate(700%) hue-rotate(215deg) brightness(100%) contrast(105%)', // #1d53e8 blue
  'qwen':      'invert(35%) sepia(70%) saturate(500%) hue-rotate(228deg) brightness(95%) contrast(100%)',  // #5e59df purple-blue
};

function getModelIconSlug(participantName) {
  if (!participantName) return null;
  var lower = participantName.toLowerCase();
  for (var keyword in MODEL_ICON_MAP) {
    if (lower.indexOf(keyword) !== -1) return MODEL_ICON_MAP[keyword];
  }
  return null;
}

function getIconImgTag(slug, cls, sizeStyle) {
  var ext = SVG_ICON_SLUGS[slug] ? 'svg' : 'png';
  var colorFilter = (!SVG_ICON_SLUGS[slug] && BRAND_FILTERS[slug])
    ? BRAND_FILTERS[slug]
    : 'drop-shadow(0 1px 3px rgba(0,0,0,0.18))';
  var style = (sizeStyle || '') + 'object-fit:contain;filter:' + colorFilter + ';';
  return '<img class="' + cls + '" src="img/models/' + slug + '.' + ext + '" alt="' + slug + '" loading="lazy" style="' + style + '">';
}

function getNameCellHtml(participantName) {
  var displayName = getDisplayParticipantName(participantName);
  var slug = getModelIconSlug(participantName);
  if (!slug) return displayName;
  var iconHtml = getIconImgTag(slug, 'model-icon');
  return '<span class="name-cell-inner">' + iconHtml + '<span>' + displayName + '</span></span>';
}

// ── Utilities ────────────────────────────────────────────────────────────────

function getExpFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const exp = params.get('exp');
  return (exp === 'model' || exp === 'framework') ? exp : 'model';
}

function buildExpUrl(exp) {
  const url = new URL(window.location.href);
  url.searchParams.set('exp', exp);
  return url.toString();
}

function getOverallUrl(exp) {
  return 'data/overall-' + exp + '.yaml';
}

function getOverallDescKey(exp) {
  return exp === 'model' ? 'overallDescModel' : 'overallDescFramework';
}

// ── Experiment tab wiring ────────────────────────────────────────────────────

function wireExpTabs(tabGroupId, onSwitch) {
  var tabsEl = document.getElementById(tabGroupId);
  if (!tabsEl) return;
  tabsEl.querySelectorAll('.exp-tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var exp = btn.getAttribute('data-exp');
      // Update active class
      tabsEl.querySelectorAll('.exp-tab-btn').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-exp') === exp);
      });
      // Update URL without page reload
      if (typeof history !== 'undefined' && history.pushState) {
        history.pushState(null, '', buildExpUrl(exp));
      }
      onSwitch(exp);
    });
  });
}

function syncExpTabs(tabGroupId, exp) {
  var tabsEl = document.getElementById(tabGroupId);
  if (!tabsEl) return;
  tabsEl.querySelectorAll('.exp-tab-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-exp') === exp);
  });
}

// ── Data loading ─────────────────────────────────────────────────────────────

async function loadTasksList() {
  if (tasksList) return tasksList;
  const tasksIndex = await loadYAML('data/tasks_index.yaml');
  if (tasksIndex && tasksIndex.tasks) {
    tasksList = tasksIndex.tasks;
    return tasksList;
  }
  return [];
}

/**
 * Load and cache overall rankings for a given experiment.
 */
async function loadOverallData(exp) {
  if (overallCache[exp]) return overallCache[exp];
  var data = await loadYAML(getOverallUrl(exp));
  if (data) overallCache[exp] = data;
  return data;
}

/**
 * Filter participants for a specific experiment type from the raw list.
 */
function filterByExp(participants, exp) {
  return participants.filter(function(p) { return p.experiment_type === exp; });
}

// ── Overall table ────────────────────────────────────────────────────────────

/**
 * Build simplified 3-column table headers (Rank / Model / Overall Score).
 */
async function buildOverallTableHeaders(exp) {
  var tasksIndex = await loadYAML('data/tasks_index.yaml');
  var thead = document.querySelector('#overall-table thead tr');
  if (!thead) return;
  var rankT  = (typeof siteT !== 'undefined') ? siteT('rank')       : 'Rank';
  var partT  = (typeof siteT !== 'undefined') ? siteT('participant') : 'Model';
  var scoreT = (typeof siteT !== 'undefined') ? siteT('totalScore')  : 'Overall Score';
  thead.innerHTML =
    '<th class="sortable col-rank" data-sort="rank">' + rankT + '</th>' +
    '<th class="sortable col-name" data-sort="name">' + partT + '</th>' +
    '<th class="sortable col-score" data-sort="totalScore">' + scoreT + '</th>';

  // Update description text
  var desc = document.getElementById('overall-desc');
  if (desc && tasksIndex && tasksIndex.tasks) {
    var n = tasksIndex.tasks.length;
    desc.textContent = 'Normalized scores across ' + n + ' tasks · higher is better';
  }
}

// ── Generic bar chart renderer ─────────────────────────────────────────────────

/**
 * Render a horizontal bar chart into the element with the given ID.
 * @param {string} containerId  - Target element ID
 * @param {Array}  rankings     - Sorted array of entries with participant_name + total_normalized_score
 * @param {Object} [opts]       - Optional: { getBadge(entry) → html string }
 */
function renderBarChartTo(containerId, rankings, opts) {
  var el = document.getElementById(containerId);
  if (!el) return;
  if (!rankings || rankings.length === 0) {
    el.innerHTML = '<p class="lb-empty">No data.</p>';
    return;
  }
  opts = opts || {};
  var getValue = opts.getValue || function(r) { return r.total_normalized_score || 0; };
  var values = rankings.map(function(r) {
    var v = getValue(r);
    return (typeof v === 'number' && isFinite(v)) ? v : 0;
  });
  var maxValue = Math.max.apply(null, values);
  var minValue = Math.min.apply(null, values);
  var formatValue = opts.formatValue || function(v) { return (v * 100).toFixed(1) + '%'; };
  var lowerIsBetter = !!opts.lowerIsBetter;

  var getPct = function(v) {
    if (lowerIsBetter) {
      if (maxValue === minValue) return 100;
      return ((maxValue - v) / (maxValue - minValue)) * 100;
    }
    return maxValue > 0 ? (v / maxValue * 100) : 0;
  };

  var html = rankings.map(function(entry, i) {
    var rank = i + 1;
    var score = getValue(entry);
    if (!(typeof score === 'number' && isFinite(score))) score = 0;
    var pct = getPct(score);
    var scoreLabel = formatValue(score, entry);
    var slug = getModelIconSlug(entry.participant_name);
    var iconHtml = slug
      ? getIconImgTag(slug, 'bar-icon')
      : '<span class="bar-icon-placeholder"></span>';
    var displayName = getDisplayParticipantName(entry.participant_name);
    var rankClass = rank <= 3 ? ' bar-rank-' + rank : '';
    var medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
    var badgeHtml = opts.getBadge ? opts.getBadge(entry) : '';
    var mascotHtml = (!opts.noMascot && slug)
      ? '<span class="bar-mascot' + (rank === 1 ? ' bar-mascot-first' : '') + '" aria-hidden="true">' +
          (rank === 1 ? '<span class="bar-crown">👑</span>' : '') +
          getIconImgTag(slug, 'bar-mascot-icon', 'width:22px;height:22px;') +
        '</span>'
      : '';
    return (
      '<div class="bar-row' + rankClass + '">' +
        '<div class="bar-label">' +
          '<span class="bar-rank-num">' + (medal || rank) + '</span>' +
          iconHtml +
          '<span class="bar-name">' + displayName + badgeHtml + '</span>' +
        '</div>' +
        '<div class="bar-track">' +
          '<div class="bar-fill" data-pct="' + pct.toFixed(2) + '">' +
            mascotHtml +
          '</div>' +
          '<span class="bar-score-label">' + scoreLabel + '</span>' +
        '</div>' +
      '</div>'
    );
  }).join('');

  el.innerHTML = html;

  // Animate bars after paint
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      el.querySelectorAll('.bar-fill').forEach(function(bar) {
        bar.style.width = bar.dataset.pct + '%';
      });
    });
  });
}

// Keep old function as alias for backward compat
function renderBarChart(rankings) { renderBarChartTo('overall-chart', rankings); }

// ── Generic heatmap renderer ───────────────────────────────────────────────────

/**
 * Render a task-by-task heatmap into the element with the given ID.
 */
function renderHeatmapTo(containerId, rankings, tasks) {
  var el = document.getElementById(containerId);
  if (!el) return;
  if (!rankings || !tasks || rankings.length === 0 || tasks.length === 0) {
    el.innerHTML = '<p class="lb-empty">No data.</p>';
    return;
  }

  var legendHtml = tasks.map(function(task, i) {
    return '<div class="hm-legend-item" title="' + task.task_name + '">' + (i + 1) + '</div>';
  }).join('');

  var rowsHtml = rankings.map(function(entry) {
    var slug = getModelIconSlug(entry.participant_name);
    var iconHtml = slug ? getIconImgTag(slug, 'bar-icon') : '';
    var displayName = getDisplayParticipantName(entry.participant_name);
    var cells = tasks.map(function(task, i) {
      var ts = entry.task_scores && entry.task_scores[task.task_name];
      var score = ts ? ts.normalized_score : null;
      var cls = score === null ? 'hm-na'
               : score >= 0.75 ? 'hm-h3'
               : score >= 0.5  ? 'hm-h2'
               : score >= 0.25 ? 'hm-h1'
               : 'hm-h0';
      var title = (i + 1) + '. ' + task.task_name + ': ' +
                  (score !== null ? (score * 100).toFixed(1) + '%' : 'N/A');
      return '<div class="hm-cell ' + cls + '" title="' + title + '"></div>';
    }).join('');
    return (
      '<div class="hm-row">' +
        '<div class="hm-row-label">' + iconHtml + '<span>' + displayName + '</span></div>' +
        '<div class="hm-cells">' + cells + '</div>' +
      '</div>'
    );
  }).join('');

  el.innerHTML =
    '<div class="hm-legend">' +
      '<div class="hm-legend-spacer"></div>' +
      '<div class="hm-legend-nums">' + legendHtml + '</div>' +
    '</div>' +
    rowsHtml +
    '<div class="hm-scale-legend">' +
      '<span class="hm-scale-label">0%</span>' +
      '<span class="hm-h0 hm-scale-swatch"></span>' +
      '<span class="hm-h1 hm-scale-swatch"></span>' +
      '<span class="hm-h2 hm-scale-swatch"></span>' +
      '<span class="hm-h3 hm-scale-swatch"></span>' +
      '<span class="hm-scale-label">100%</span>' +
      '<span class="hm-na hm-scale-swatch hm-scale-na-swatch"></span>' +
      '<span class="hm-scale-label">N/A</span>' +
    '</div>';
}

// Keep old function as alias
function renderHeatmap(rankings, tasks) { renderHeatmapTo('overall-heatmap', rankings, tasks); }

// ── Generic table renderer ─────────────────────────────────────────────────────

/**
 * Render the 3-column summary table (Rank / Model / Score) into tbodyId.
 */
function renderTableTo(tbodyId, rankings) {
  var tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  if (!rankings || rankings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No data yet</td></tr>';
    return;
  }
  tbody.innerHTML = rankings.map(function(entry, index) {
    var rank = index + 1;
    var totalScore = entry.total_normalized_score || 0;
    var scorePct = (totalScore * 100).toFixed(1) + '%';
    var barWidth = (totalScore * 100).toFixed(1);
    var badge = entry._openSourceBadge
      ? '<span class="oss-badge" title="Open-source weights">OSS</span>'
      : '';
    return '<tr>' +
      '<td class="rank-cell rank-' + (rank <= 3 ? rank : '') + '">' + rank + '</td>' +
      '<td class="name-cell">' + getNameCellHtml(entry.participant_name) + badge + '</td>' +
      '<td class="score-cell-bar">' +
        '<div class="inline-bar-wrap">' +
          '<div class="inline-bar' + (entry._openSourceBadge ? ' inline-bar-oss' : '') +
            '" style="width:' + barWidth + '%"></div>' +
          '<span class="inline-bar-label ' + getScoreClass(totalScore) + '">' + scorePct + '</span>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('');
}

/**
 * Render the 3-column rank table (Rank / Model / Avg. Rank) for the homepage.
 * Entries are pre-sorted by ascending average_rank.
 */
function renderRankTableTo(tbodyId, entries) {
  var tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  if (!entries || entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No data yet</td></tr>';
    return;
  }
  var ranks = entries.map(function(e) { return e.average_rank; });
  var minRank = Math.min.apply(null, ranks);
  var maxRank = Math.max.apply(null, ranks);
  tbody.innerHTML = entries.map(function(entry, index) {
    var rowRank = index + 1;
    var avgRank = entry.average_rank;
    var barWidth = maxRank > minRank
      ? ((maxRank - avgRank) / (maxRank - minRank) * 100).toFixed(1)
      : '100';
    return '<tr>' +
      '<td class="rank-cell rank-' + (rowRank <= 3 ? rowRank : '') + '">' + rowRank + '</td>' +
      '<td class="name-cell">' + getNameCellHtml(entry.participant_name) + '</td>' +
      '<td class="score-cell-bar">' +
        '<div class="inline-bar-wrap">' +
          '<div class="inline-bar" style="width:' + barWidth + '%"></div>' +
          '<span class="inline-bar-label score-high">' + avgRank.toFixed(2) + '</span>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('');
}

/**
 * Render the overall leaderboard table (legacy – used by old pages).
 */
async function renderOverallTableForExp(exp) {
  var tbody = document.getElementById('overall-tbody');
  if (!tbody) return;
  var data = await loadOverallData(exp);
  if (!data || !data.rankings) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">' +
      ((typeof siteT !== 'undefined') ? siteT('loadError') : 'Failed to load data') + '</td></tr>';
    return;
  }
  var sortedData = [...data.rankings].sort(function(a, b) {
    return (b.total_normalized_score || 0) - (a.total_normalized_score || 0);
  });
  renderTableTo('overall-tbody', sortedData);
}

/**
 * Render bar chart and heatmap for the given experiment (legacy).
 */
async function renderVisuals(exp) {
  var tasks = await loadTasksList();
  var data  = await loadOverallData(exp);
  if (!data || !data.rankings) return;
  var rankings = [...data.rankings].sort(function(a, b) {
    return (b.total_normalized_score || 0) - (a.total_normalized_score || 0);
  });
  renderBarChart(rankings);
  renderHeatmap(rankings, tasks);
}

// ── New leaderboard page init (two-section, no tabs) ──────────────────────────

/**
 * Main init for leaderboard.html — renders two independent sections:
 *   1. Frontier Models  (model data + best GPT-OSS injected)
 *   2. Framework Effects (grouped by base model: Claude / GPT-OSS)
 */
async function initLeaderboardPage() {
  // Load everything in parallel
  var [tasks, modelData, frameworkData] = await Promise.all([
    loadTasksList(),
    loadOverallData('model'),
    loadOverallData('framework'),
  ]);

  // Update "last updated" pill
  var updEl = document.getElementById('lb-updated');
  var updStr = (modelData && modelData.metadata && modelData.metadata.last_updated)
    ? modelData.metadata.last_updated.slice(0, 10)
    : '';
  if (updEl && updStr) updEl.textContent = 'Updated ' + updStr;

  var modelRankings = modelData ? [...modelData.rankings] : [];
  var fwRankings    = frameworkData ? [...frameworkData.rankings] : [];

  // ── Section 1: Frontier Models ───────────────────────────────────────────
  var displayModelRankings = [...modelRankings].sort(function(a, b) {
    return (b.total_normalized_score || 0) - (a.total_normalized_score || 0);
  });

  var modelAverageRankings = modelRankings
    .map(function(entry) {
      return {
        participant_name: entry.participant_name,
        average_rank: getModelAverageRank(entry.participant_name)
      };
    })
    .filter(function(entry) {
      return typeof entry.average_rank === 'number' && isFinite(entry.average_rank);
    })
    .sort(function(a, b) {
      return a.average_rank - b.average_rank;
    });

  renderBarChartTo('model-chart', modelAverageRankings, {
    getValue: function(entry) { return entry.average_rank; },
    formatValue: function(value) { return value.toFixed(2); },
    lowerIsBetter: true
  });
  renderHeatmapTo('model-heatmap', displayModelRankings, tasks);

  // ── Section 2: Framework Effects ─────────────────────────────────────────
  var claudeEntries = fwRankings.filter(function(r) {
    return r.participant_name && r.participant_name.toLowerCase().indexOf('claude') !== -1;
  }).sort(function(a, b) {
    return (b.total_normalized_score || 0) - (a.total_normalized_score || 0);
  });

  var gptEntries = fwRankings.filter(function(r) {
    return r.participant_name && r.participant_name.toLowerCase().indexOf('gpt-oss') !== -1;
  }).sort(function(a, b) {
    return (b.total_normalized_score || 0) - (a.total_normalized_score || 0);
  });

  renderBarChartTo('fw-claude-chart', claudeEntries, { noMascot: true });
  renderBarChartTo('fw-gpt-chart', gptEntries, { noMascot: true });

  // Combined heatmap: all framework entries sorted by score
  var allFwSorted = [...fwRankings].sort(function(a, b) {
    return (b.total_normalized_score || 0) - (a.total_normalized_score || 0);
  });
  renderHeatmapTo('fw-heatmap', allFwSorted, tasks);
}

// ── Overall page init ───────────────────────────────────────────────────────

async function initLeaderboard() {
  // If the new two-section page structure is present, use the new renderer
  if (document.getElementById('model-chart')) {
    await initLeaderboardPage();
    return;
  }
  // Legacy single-tab flow
  activeExp = getExpFromUrl();
  syncExpTabs('exp-tabs-overall', activeExp);
  await buildOverallTableHeaders(activeExp);
  var data = await loadOverallData(activeExp);
  if (!data) {
    var tbody = document.getElementById('overall-tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-state">' +
        ((typeof siteT !== 'undefined') ? siteT('loadError') : 'Failed to load data') + '</td></tr>';
    }
    return;
  }
  await Promise.all([
    renderOverallTableForExp(activeExp),
    renderVisuals(activeExp),
  ]);
  setupSorting();
}

async function initHomePage() {
  var data = await loadOverallData('model');
  if (!data) {
    var tbody = document.getElementById('overall-tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-state">' +
        ((typeof siteT !== 'undefined') ? siteT('loadError') : 'Failed to load data') + '</td></tr>';
    }
    return;
  }
  // Use average rank for the homepage overview (lower is better).
  var topByRank = data.rankings
    .map(function(entry) {
      return { participant_name: entry.participant_name, average_rank: getModelAverageRank(entry.participant_name) };
    })
    .filter(function(entry) {
      return typeof entry.average_rank === 'number' && isFinite(entry.average_rank);
    })
    .sort(function(a, b) {
      return a.average_rank - b.average_rank;
    })
    .slice(0, 3);
  renderRankTableTo('overall-tbody', topByRank);
}

// ── Sorting ─────────────────────────────────────────────────────────────────

function setupSorting() {
  var headers = document.querySelectorAll('th.sortable');
  headers.forEach(function(header) {
    header.addEventListener('click', function() {
      var key = header.dataset.sort;
      if (!key) return;
      if (currentSort.key === key) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.key = key;
        currentSort.direction = 'asc';
      }
      headers.forEach(function(h) {
        h.classList.remove('sort-asc', 'sort-desc');
      });
      header.classList.add('sort-' + currentSort.direction);
      sortAndRenderTable(key, currentSort.direction);
    });
  });
}

async function sortAndRenderTable(key, direction) {
  var data = await loadOverallData(activeExp);
  if (!data) return;
  var rankings = data.rankings || [];
  if (key === 'totalScore') {
    rankings.sort(function(a, b) {
      return direction === 'asc'
        ? (a.total_normalized_score || 0) - (b.total_normalized_score || 0)
        : (b.total_normalized_score || 0) - (a.total_normalized_score || 0);
    });
  } else if (key === 'name') {
    rankings.sort(function(a, b) {
      var cmp = getDisplayParticipantName(a.participant_name).localeCompare(getDisplayParticipantName(b.participant_name));
      return direction === 'asc' ? cmp : -cmp;
    });
  } else if (key.startsWith('task_')) {
    var taskName = key.replace('task_', '');
    rankings.sort(function(a, b) {
      var aScore = (a.task_scores && a.task_scores[taskName]) ? a.task_scores[taskName].normalized_score : 0;
      var bScore = (b.task_scores && b.task_scores[taskName]) ? b.task_scores[taskName].normalized_score : 0;
      return direction === 'asc' ? aScore - bScore : bScore - aScore;
    });
  }
  // Re-render with the current experiment (which re-sorts by total score internally)
  await renderOverallTableForExp(activeExp);
}

// ── Problem page ─────────────────────────────────────────────────────────────

async function initProblemPage() {
  var taskName = await getTaskNameFromUrl();
  if (!taskName) {
    var intro = document.querySelector('.problem-intro');
    if (intro) { intro.innerHTML = '<div class="error">Task not found</div>'; }
    return;
  }
  activeExp = getExpFromUrl();
  syncExpTabs('exp-tabs-problem', activeExp);
  await loadProblemInfo(taskName);
  await loadProblemLeaderboard(taskName, activeExp);
}

async function getTaskNameFromUrl() {
  var urlParams = new URLSearchParams(window.location.search);
  var taskName = urlParams.get('task');
  if (taskName) return taskName;
  var idParam = urlParams.get('id');
  if (idParam) {
    var id = parseInt(idParam);
    var tasks = await loadTasksList();
    if (id >= 1 && id <= tasks.length) return tasks[id - 1].task_name;
  }
  var path = window.location.pathname;
  var match = path.match(/problem(\d+)\.html/);
  if (match) {
    var id2 = parseInt(match[1]);
    var tasks2 = await loadTasksList();
    if (id2 >= 1 && id2 <= tasks2.length) return tasks2[id2 - 1].task_name;
  }
  return null;
}

async function loadProblemInfo(taskName) {
  var taskData = await loadYAML('data/problems/' + taskName + '.yaml');
  if (!taskData) {
    var intro = document.querySelector('.problem-intro');
    if (intro) { intro.innerHTML = '<div class="error">Failed to load task data</div>'; }
    return;
  }
  var metadata = taskData.metadata || {};
  _currentTaskName = taskName;
  _currentMetadata = metadata;

  renderProblemIntro(taskName, metadata);
  await updateProblemNavigation(taskName);
}

/**
 * Render (or re-render) the problem intro section.
 * Called on initial load and again when the language switches.
 */
function renderProblemIntro(taskName, metadata) {
  var tasks = tasksList || [];
  var taskIndex = -1;
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].task_name === taskName) { taskIndex = i; break; }
  }
  var taskNumber = taskIndex + 1;

  // Update page title
  document.title = metadata.task_name + ': ' +
    (metadata.title_en || metadata.title_zh || taskName) + ' - Leaderboard';

  // Update header
  var header = document.querySelector('.problem-header');
  if (header) {
    var title = metadata.title_en || metadata.title_zh || taskName;
    header.innerHTML = '<h1>' + metadata.task_name + '</h1>' +
      '<div class="meta">' +
        '<div class="meta-item"><span>Domain:</span><span>' + (metadata.domain || 'Unknown') + '</span></div>' +
      '</div>';
  }

  // Build description: prefer TASK_DESCRIPTIONS, fall back to metadata
  var description = '';
  if (typeof window.TASK_DESCRIPTIONS !== 'undefined' && window.TASK_DESCRIPTIONS[taskName]) {
    description = window.TASK_DESCRIPTIONS[taskName].en;
  } else if (metadata.description) {
    description = metadata.description;
  } else {
    description = 'Task: ' + (metadata.title_en || taskName);
  }

  var intro = document.querySelector('.problem-intro');
  if (intro) {
    var i18nTaskDesc = 'Task Description';
    var i18nDomain   = 'Domain';
    var i18nContrib  = 'Contributor';
    intro.innerHTML = '<h2 data-i18n="taskDescTitle">' + i18nTaskDesc + '</h2>' +
      '<div class="description">' + description + '</div>' +
      '<div class="details">' +
        '<div class="detail-item"><strong data-i18n="domain">' + i18nDomain + '</strong><span>' + (metadata.domain || 'Unknown') + '</span></div>' +
        '<div class="detail-item"><strong data-i18n="contributor">' + i18nContrib + '</strong><span>' +
          (metadata.contributor ? metadata.contributor : '<span class="detail-missing">—</span>') +
        '</span></div>' +
      '</div>';
  }

  // Update navigation info
  var currentInfo = document.getElementById('current-info');
  if (currentInfo && tasks.length > 0) {
    currentInfo.textContent = taskName + ' (' + taskNumber + ' / ' + tasks.length + ')';
  }
}

/**
 * Called by lang.js when the language switches.
 * Re-renders the problem intro with the new language.
 */
function refreshProblemDescription() {
  if (_currentTaskName && _currentMetadata) {
    renderProblemIntro(_currentTaskName, _currentMetadata);
  }
}
window.refreshProblemDescription = refreshProblemDescription;

async function updateProblemNavigation(taskName) {
  var tasks = await loadTasksList();
  var taskIndex = tasks.findIndex(function(t) { return t.task_name === taskName; });
  var taskNumber = taskIndex + 1;
  var prevTask = taskIndex > 0 ? tasks[taskIndex - 1] : null;
  var nextTask = taskIndex < tasks.length - 1 ? tasks[taskIndex + 1] : null;
  var prevLink = document.getElementById('prev-link');
  var nextLink = document.getElementById('next-link');
  var currentInfo = document.getElementById('current-info');
  if (prevLink) {
    if (prevTask) {
      prevLink.href = buildProblemUrl(prevTask.task_name);
      prevLink.textContent = '\u2190 ' + prevTask.task_name;
      prevLink.style.visibility = 'visible';
    } else {
      prevLink.href = '#';
      prevLink.style.visibility = 'hidden';
    }
  }
  if (nextLink) {
    if (nextTask) {
      nextLink.href = buildProblemUrl(nextTask.task_name);
      nextLink.textContent = nextTask.task_name + ' \u2192';
      nextLink.style.visibility = 'visible';
    } else {
      nextLink.href = '#';
      nextLink.style.visibility = 'hidden';
    }
  }
  if (currentInfo) {
    currentInfo.textContent = taskName + ' (' + taskNumber + ' / ' + tasks.length + ')';
  }
}

function buildProblemUrl(taskName) {
  return 'problem.html?task=' + encodeURIComponent(taskName) + '&exp=' + activeExp;
}

/**
 * Load and render problem-level leaderboard filtered by experiment.
 */
async function loadProblemLeaderboard(taskName, exp) {
  var tbody = document.getElementById('problem-tbody');
  if (!tbody) return;
  var taskData = await loadYAML('data/problems/' + taskName + '.yaml');
  if (!taskData) {
    tbody.innerHTML = '<tr><td colspan="100%" class="empty-state">' +
      ((typeof siteT !== 'undefined') ? siteT('loadError') : 'Failed to load data') + '</td></tr>';
    return;
  }
  var title = document.getElementById('leaderboard-title');
  if (title) { title.textContent = taskName + ' Leaderboard'; }

  var allParticipants = taskData.participants || [];
  var participants = filterByExp(allParticipants, exp);
  var sortedParticipants = [...participants].sort(function(a, b) {
    return (b.normalized_score || 0) - (a.normalized_score || 0);
  });
  renderProblemTable(tbody, sortedParticipants);
  setupProblemTableSorting(taskName, exp);
}

/**
 * Render the problem leaderboard table.
 */
async function renderProblemTable(tbody, data) {
  if (!tbody) return;
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="100%" class="empty-state">' +
      ((typeof siteT !== 'undefined') ? siteT('emptyData') : 'No data yet') + '</td></tr>';
    return;
  }
  var urlParams = new URLSearchParams(window.location.search);
  var taskName = urlParams.get('task');
  var baselineRaw = null;
  if (taskName) {
    try {
      var taskData = await loadYAML('data/problems/' + taskName + '.yaml');
      if (taskData && taskData.statistics && taskData.statistics.raw_score) {
        baselineRaw = taskData.statistics.raw_score.baseline;
      }
    } catch(e) {}
  }
  var baselineRow = '';
  if (baselineRaw !== null && baselineRaw !== undefined) {
    baselineRow = '<tr style="background:#f9f9fb;font-style:italic;opacity:0.7">' +
      '<td class="rank-cell">—</td>' +
      '<td class="name-cell">Baseline</td>' +
      '<td class="score-cell"><strong>' + baselineRaw.toFixed(4) + '</strong></td>' +
      '</tr>';
  }
  var CROWNS = { 1: '👑', 2: '🥈', 3: '🥉' };
  var CROWN_COLORS = { 1: '#f5a623', 2: '#9e9e9e', 3: '#c07840' };
  tbody.innerHTML = baselineRow + data.map(function(entry, index) {
    var rank = index + 1;
    var rawScore = entry.raw_score !== undefined ? entry.raw_score : null;
    var participantName = getNameCellHtml(entry.participant_name);
    var rawDisplay = '—';
    if (rawScore !== null) {
      if (Math.abs(rawScore) >= 100) rawDisplay = rawScore.toFixed(2);
      else if (Math.abs(rawScore) >= 1) rawDisplay = rawScore.toFixed(4);
      else rawDisplay = rawScore.toFixed(6);
    }
    var vsBaseline = '';
    if (rawScore !== null && baselineRaw !== null && Math.abs(baselineRaw) > 1e-12) {
      var pct = ((rawScore - baselineRaw) / Math.abs(baselineRaw)) * 100;
      var sign = pct >= 0 ? '+' : '';
      var cls = pct >= 0 ? 'color:#22c55e' : 'color:#ef4444';
      vsBaseline = '<br><small style="' + cls + '">(' + sign + pct.toFixed(2) + '% vs baseline)</small>';
    }
    var crownHtml = '';
    if (rank <= 3) {
      var crownAnim = rank === 1 ? ' class="problem-crown problem-crown-gold"' : ' class="problem-crown"';
      crownHtml = '<span' + crownAnim + ' style="color:' + CROWN_COLORS[rank] + '">' + CROWNS[rank] + '</span> ';
    }
    var rankDisplay = crownHtml + (rank <= 3 ? '' : rank);
    return '<tr class="problem-rank-' + (rank <= 3 ? rank : 'other') + '">' +
      '<td class="rank-cell rank-' + (rank <= 3 ? rank : '') + '">' + rankDisplay + '</td>' +
      '<td class="name-cell">' + participantName + '</td>' +
      '<td class="score-cell"><strong>' + rawDisplay + '</strong>' + vsBaseline + '</td>' +
      '</tr>';
  }).join('');
}

function setupProblemTableSorting(taskName, exp) {
  var headers = document.querySelectorAll('#problem-table th.sortable');
  headers.forEach(function(header) {
    header.addEventListener('click', function() {
      var key = header.dataset.sort;
      if (!key) return;
      if (currentSort.key === key) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.key = key;
        currentSort.direction = 'asc';
      }
      headers.forEach(function(h) {
        h.classList.remove('sort-asc', 'sort-desc');
      });
      header.classList.add('sort-' + currentSort.direction);
      sortAndRenderProblemTable(taskName, exp, key, currentSort.direction);
    });
  });
}

async function sortAndRenderProblemTable(taskName, exp, key, direction) {
  var taskData = await loadYAML('data/problems/' + taskName + '.yaml');
  if (!taskData) return;
  var allParticipants = taskData.participants || [];
  var participants = filterByExp(allParticipants, exp);
  var sortedData = [...participants];
  if (key === 'rank') {
    sortedData.sort(function(a, b) {
      var result = (b.normalized_score || 0) - (a.normalized_score || 0);
      return direction === 'asc' ? -result : result;
    });
  } else if (key === 'name') {
    sortedData.sort(function(a, b) {
      var cmp = getDisplayParticipantName(a.participant_name).localeCompare(getDisplayParticipantName(b.participant_name));
      return direction === 'asc' ? cmp : -cmp;
    });
  } else if (key === 'score') {
    sortedData.sort(function(a, b) {
      return direction === 'asc'
        ? (a.normalized_score || 0) - (b.normalized_score || 0)
        : (b.normalized_score || 0) - (a.normalized_score || 0);
    });
  }
  var tbody = document.getElementById('problem-tbody');
  if (tbody) { renderProblemTable(tbody, sortedData); }
}

// ── Experiment tab handlers (for problem page) ──────────────────────────────

function initProblemExpTabs() {
  var tabsEl = document.getElementById('exp-tabs-problem');
  if (!tabsEl) return;
  tabsEl.querySelectorAll('.exp-tab-btn').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      var exp = btn.getAttribute('data-exp');
      tabsEl.querySelectorAll('.exp-tab-btn').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-exp') === exp);
      });
      activeExp = exp;
      if (typeof history !== 'undefined' && history.pushState) {
        history.pushState(null, '', buildExpUrl(exp));
      }
      var taskName = await getTaskNameFromUrl();
      if (taskName) {
        await loadProblemLeaderboard(taskName, exp);
      }
    });
  });
}

// ── Home task list (shared between experiments) ──────────────────────────────

async function loadProblemList() {
  var tasksIndex = await loadYAML('data/tasks_index.yaml');
  var container = document.getElementById('problem-list');
  var noResultsEl = document.getElementById('search-no-results');
  if (!tasksIndex || !tasksIndex.tasks || !container) {
    if (container) container.innerHTML = '<div class="error">' +
      ((window.siteT) ? window.siteT('loadError') : 'Failed to load') + '</div>';
    return;
  }
  var tasks = tasksIndex.tasks;
  var byDomain = {};
  tasks.forEach(function(task) {
    var domain = (task.domain || '').toString();
    if (!byDomain[domain]) byDomain[domain] = [];
    byDomain[domain].push(task);
  });
  var domainOrder = Object.keys(byDomain).sort();
  var siteT = window.siteT || function(k) { return k; };
  var html = '';
  domainOrder.forEach(function(domain) {
    var tasksInDomain = byDomain[domain];
    var count = tasksInDomain.length;
    var countText = count + (siteT('domainTaskCount') || '');
    var taskCards = tasksInDomain.map(function(task) {
      var taskName = (task.task_name || '').toString();
      return '<a href="problem.html?task=' + encodeURIComponent(task.task_name) + '&exp=' + activeExp +
             '" class="card task-card" data-task-name="' + taskName.replace(/"/g, '&quot;') +
             '" data-domain="' + domain.replace(/"/g, '&quot;') + '"><h3>' + taskName + '</h3></a>';
    }).join('');
    html += '<div class="domain-section" data-domain="' + domain.replace(/"/g, '&quot;') + '">' +
      '<button type="button" class="domain-header" aria-expanded="true">' +
        '<span class="domain-header-chevron"></span>' +
        '<span class="domain-header-title">' + domain + '</span>' +
        '<span class="domain-header-count">' + countText + '</span>' +
      '</button>' +
      '<div class="domain-tasks card-grid">' + taskCards + '</div></div>';
  });
  container.innerHTML = html;
  container.querySelectorAll('.domain-header').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var section = btn.closest('.domain-section');
      var panel = section && section.querySelector('.domain-tasks');
      var expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', !expanded);
      if (panel) panel.classList.toggle('is-collapsed', expanded);
    });
  });
  wireTaskSearch(container, noResultsEl);
}

function wireTaskSearch(problemListEl, noResultsEl) {
  var input = document.getElementById('task-search');
  if (!input || !problemListEl) return;
  var sections = problemListEl.querySelectorAll('.domain-section');
  var cards = problemListEl.querySelectorAll('.task-card');
  function filterTasks() {
    var q = (input.value || '').trim().toLowerCase();
    var totalVisible = 0;
    cards.forEach(function(card) {
      var name = (card.getAttribute('data-task-name') || '').toLowerCase();
      var domain = (card.getAttribute('data-domain') || '').toLowerCase();
      var show = !q || name.indexOf(q) !== -1 || domain.indexOf(q) !== -1;
      card.style.display = show ? '' : 'none';
      if (show) totalVisible++;
    });
    sections.forEach(function(section) {
      var domainTitle = (section.getAttribute('data-domain') || '').toLowerCase();
      var domainMatch = !q || domainTitle.indexOf(q) !== -1;
      var visibleCount = 0;
      section.querySelectorAll('.task-card').forEach(function(c) {
        if (c.style.display !== 'none') visibleCount++;
      });
      section.style.display = (domainMatch || visibleCount > 0) ? '' : 'none';
    });
    if (noResultsEl) noResultsEl.style.display = (q && totalVisible === 0) ? 'block' : 'none';
  }
  input.addEventListener('input', filterTasks);
  input.addEventListener('keyup', filterTasks);
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  var path = window.location.pathname;

  // Wire experiment tabs before init
  wireExpTabs('exp-tabs-overall', async function(exp) {
    activeExp = exp;
    overallCache[exp] = null; // invalidate cache on switch
    await buildOverallTableHeaders(exp);
    var data = await loadOverallData(exp);
    if (!data) {
      var tbody = document.getElementById('overall-tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="empty-state">' +
        ((typeof siteT !== 'undefined') ? siteT('loadError') : 'Failed to load data') + '</td></tr>';
      return;
    }
    await Promise.all([
      renderOverallTableForExp(exp),
      renderVisuals(exp),
    ]);
    setupSorting();
    await loadProblemList();
  });

  if (path.includes('leaderboard.html')) {
    initLeaderboard();
    loadProblemList();
  } else if (path === '/' || path.endsWith('/') || path.includes('index.html')) {
    if (document.getElementById('overall-tbody')) {
      initHomePage();
    }
    loadProblemList();
  } else if (path.includes('problem.html') || (path.includes('problem') && path.match(/problem\d+\.html/))) {
    initProblemExpTabs();
    initProblemPage();
  }
});
