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

function getDisplayParticipantName(name) {
  if (!name) return 'Unknown';
  return PARTICIPANT_DISPLAY_NAME_MAP[name] || name;
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
 * Build table headers from tasks_index (shared across experiments).
 */
async function buildOverallTableHeaders(exp) {
  var tasksIndex = await loadYAML('data/tasks_index.yaml');
  if (!tasksIndex || !tasksIndex.tasks) return;
  var thead = document.querySelector('#overall-table thead tr');
  if (!thead) return;
  var taskHeaders = tasksIndex.tasks.map(function(task) {
    return '<th class="sortable" data-sort="task_' + task.task_name + '">' +
           (task.task_name || '') + '</th>';
  }).join('');
  var rankT  = (typeof siteT !== 'undefined') ? siteT('rank')       : 'Rank';
  var partT  = (typeof siteT !== 'undefined') ? siteT('participant') : 'Participant';
  var scoreT = (typeof siteT !== 'undefined') ? siteT('totalScore')  : 'Total Score';
  thead.innerHTML = '<th class="sortable" data-sort="rank" data-i18n="rank">' + rankT + '</th>' +
    '<th class="sortable" data-sort="name" data-i18n="participant">' + partT + '</th>' +
    '<th class="sortable" data-sort="totalScore" data-i18n="totalScore">' + scoreT + '</th>' +
    taskHeaders;

  // Update description text
  var desc = document.getElementById('overall-desc');
  if (desc) {
    var n = tasksIndex.tasks.length;
    var descKey = getOverallDescKey(exp);
    var template = (typeof siteT !== 'undefined') ? siteT(descKey) : null;
    desc.textContent = template
      ? template.replace('{n}', n)
      : ('展示所有参与者/模型在 ' + n + ' 个任务上的综合得分');
  }
}

/**
 * Render the overall leaderboard table for the given experiment.
 */
async function renderOverallTableForExp(exp) {
  var tbody = document.getElementById('overall-tbody');
  if (!tbody) return;
  var tasks = await loadTasksList();
  var data  = await loadOverallData(exp);
  if (!data || !data.rankings) {
    tbody.innerHTML = '<tr><td colspan="100%" class="empty-state">' +
      ((typeof siteT !== 'undefined') ? siteT('loadError') : 'Failed to load data') + '</td></tr>';
    return;
  }
  var rankings = data.rankings || [];
  var sortedData = [...rankings].sort(function(a, b) {
    return (b.total_normalized_score || 0) - (a.total_normalized_score || 0);
  });
  tbody.innerHTML = sortedData.map(function(entry, index) {
    var rank      = index + 1;
    var totalScore = entry.total_normalized_score || 0;
    var scoreCells = tasks.map(function(task) {
      var taskName  = task.task_name;
      var score     = entry.task_scores && entry.task_scores[taskName]
                        ? entry.task_scores[taskName].normalized_score : null;
      var scoreValue = score !== null ? score : 0;
      var scoreDisplay = score !== null ? formatScore(score) : '-';
      return '<td class="score-cell ' + getScoreClass(scoreValue) + '">' + scoreDisplay + '</td>';
    }).join('');
    return '<tr>' +
      '<td class="rank-cell rank-' + (rank <= 3 ? rank : '') + '">' + rank + '</td>' +
      '<td class="name-cell">' + getDisplayParticipantName(entry.participant_name) + '</td>' +
      '<td class="score-cell ' + getScoreClass(totalScore) + '"><strong>' + formatScore(totalScore) + '</strong></td>' +
      scoreCells +
      '</tr>';
  }).join('');
  if (sortedData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="100%" class="empty-state">' +
      ((typeof siteT !== 'undefined') ? siteT('emptyData') : 'No data yet') + '</td></tr>';
  }
}

// ── Overall page init ───────────────────────────────────────────────────────

async function initLeaderboard() {
  activeExp = getExpFromUrl();
  syncExpTabs('exp-tabs-overall', activeExp);
  await buildOverallTableHeaders(activeExp);
  var data = await loadOverallData(activeExp);
  if (!data) {
    var tbody = document.getElementById('overall-tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="100%" class="empty-state">' +
        ((typeof siteT !== 'undefined') ? siteT('loadError') : 'Failed to load data') + '</td></tr>';
    }
    return;
  }
  await renderOverallTableForExp(activeExp);
  setupSorting();
}

async function initHomePage() {
  activeExp = getExpFromUrl();
  syncExpTabs('exp-tabs-overall', activeExp);
  await buildOverallTableHeaders(activeExp);
  var data = await loadOverallData(activeExp);
  if (!data) {
    var tbody = document.getElementById('overall-tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="100%" class="empty-state">' +
        ((typeof siteT !== 'undefined') ? siteT('loadError') : 'Failed to load data') + '</td></tr>';
    }
    return;
  }
  await renderOverallTableForExp(activeExp);
  setupSorting();
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
        (metadata.contributor ? '<div class="detail-item"><strong data-i18n="contributor">' + i18nContrib + '</strong><span>' + metadata.contributor + '</span></div>' : '') +
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
    baselineRow = '<tr style="background:#f0f0f0;font-style:italic;opacity:0.7">' +
      '<td class="rank-cell">—</td>' +
      '<td class="name-cell">Baseline</td>' +
      '<td class="score-cell"><strong>' + baselineRaw.toFixed(4) + '</strong></td>' +
      '<td>—</td></tr>';
  }
  tbody.innerHTML = baselineRow + data.map(function(entry, index) {
    var rank = index + 1;
    var rawScore = entry.raw_score !== undefined ? entry.raw_score : null;
    var participantName = getDisplayParticipantName(entry.participant_name);
    var submittedAt = entry.submitted_at || entry.achieved_at || null;
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
    return '<tr>' +
      '<td class="rank-cell rank-' + (rank <= 3 ? rank : '') + '">' + rank + '</td>' +
      '<td class="name-cell">' + participantName + '</td>' +
      '<td class="score-cell"><strong>' + rawDisplay + '</strong>' + vsBaseline + '</td>' +
      '<td>' + formatDate(submittedAt) + '</td></tr>';
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
  } else if (key === 'submittedAt') {
    sortedData.sort(function(a, b) {
      var aDate = a.submitted_at || a.achieved_at || '';
      var bDate = b.submitted_at || b.achieved_at || '';
      var cmp = aDate.localeCompare(bDate);
      return direction === 'asc' ? cmp : -cmp;
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
      if (tbody) tbody.innerHTML = '<tr><td colspan="100%" class="empty-state">' +
        ((typeof siteT !== 'undefined') ? siteT('loadError') : 'Failed to load data') + '</td></tr>';
      return;
    }
    await renderOverallTableForExp(exp);
    setupSorting();
    // Refresh task list links to carry the exp param
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
