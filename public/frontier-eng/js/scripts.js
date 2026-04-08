// Main script file

// Global state
let currentSort = {
  key: null,
  direction: 'asc'
};

// Global task list cache
let tasksList = null;

/**
 * Load task list
 */
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
 * Build overall table header row (rank, participant, totalScore, task columns) and update overall-desc.
 * Used by both index and leaderboard pages.
 */
async function buildOverallTableHeaders() {
  const tasksIndex = await loadYAML('data/tasks_index.yaml');
  if (!tasksIndex || !tasksIndex.tasks) return;
  const thead = document.querySelector('#overall-table thead tr');
  if (!thead) return;
  const taskHeaders = tasksIndex.tasks.map(task =>
    '<th class="sortable" data-sort="task_' + task.task_name + '">' + (task.task_name || '') + '</th>'
  ).join('');
  const rankT = typeof siteT !== 'undefined' ? siteT('rank') : 'Rank';
  const partT = typeof siteT !== 'undefined' ? siteT('participant') : 'Participant';
  const scoreT = typeof siteT !== 'undefined' ? siteT('totalScore') : 'Total Score';
  thead.innerHTML = '<th class="sortable" data-sort="rank" data-i18n="rank">' + rankT + '</th>' +
    '<th class="sortable" data-sort="name" data-i18n="participant">' + partT + '</th>' +
    '<th class="sortable" data-sort="totalScore" data-i18n="totalScore">' + scoreT + '</th>' + taskHeaders;
  const desc = document.getElementById('overall-desc');
  if (desc) {
    const n = tasksIndex.tasks.length;
    desc.textContent = (typeof getSiteLang !== 'undefined' && getSiteLang() === 'zh')
      ? ('展示所有参与者/模型在 ' + n + ' 个任务上的综合得分')
      : ('Displaying comprehensive scores of all participants/models across ' + n + ' tasks');
  }
}

/**
 * Initialize overall leaderboard table
 */
async function initLeaderboard() {
  const tbody = document.getElementById('overall-tbody');
  if (!tbody) return;

  await buildOverallTableHeaders();
  const data = await loadYAML('data/overall.yaml');
  if (!data) {
    tbody.innerHTML = '<tr><td colspan="100%" class="empty-state">' + (typeof siteT !== 'undefined' ? siteT('loadError') : 'Failed to load data') + '</td></tr>';
    return;
  }

  await loadTasksList();
  await renderOverallTable(data);
  setupSorting();
}

/**
 * Render overall leaderboard table
 */
async function renderOverallTable(data) {
  const tbody = document.getElementById('overall-tbody');
  if (!tbody) return;

  const tasks = await loadTasksList();
  
  // 处理总榜数据
  const rankings = data.rankings || [];
  
  // Sort by total score
  const sortedData = [...rankings].sort((a, b) => {
    const aScore = a.total_normalized_score || 0;
    const bScore = b.total_normalized_score || 0;
    return bScore - aScore;
  });

  tbody.innerHTML = sortedData.map((entry, index) => {
    const rank = index + 1;
    const totalScore = entry.total_normalized_score || 0;
    
    // Dynamically generate task score cells
    const scoreCells = tasks.map(task => {
      const taskName = task.task_name;
      const score = entry.task_scores?.[taskName]?.normalized_score ?? null;
      const scoreValue = score !== null ? score : 0;
      const scoreDisplay = score !== null ? formatScore(score) : '-';
      return `<td class="score-cell ${getScoreClass(scoreValue)}">${scoreDisplay}</td>`;
    }).join('');

    return `
      <tr>
        <td class="rank-cell rank-${rank <= 3 ? rank : ''}">${rank}</td>
        <td class="name-cell">${entry.participant_name || 'Unknown'}</td>
        <td class="score-cell ${getScoreClass(totalScore)}"><strong>${formatScore(totalScore)}</strong></td>
        ${scoreCells}
      </tr>
    `;
  }).join('');
  
  if (sortedData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="100%" class="empty-state">' + (typeof siteT !== 'undefined' ? siteT('emptyData') : 'No data yet') + '</td></tr>';
  }
}

/**
 * Setup table sorting
 */
function setupSorting() {
  const headers = document.querySelectorAll('th.sortable');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const key = header.dataset.sort;
      if (!key) return;

      // Toggle sort direction
      if (currentSort.key === key) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.key = key;
        currentSort.direction = 'asc';
      }

      // 更新表头样式
      headers.forEach(h => {
        h.classList.remove('sort-asc', 'sort-desc');
      });
      header.classList.add(`sort-${currentSort.direction}`);

      // Re-sort and render
      sortAndRenderTable(key, currentSort.direction);
    });
  });
}

/**
 * Sort and re-render table
 */
async function sortAndRenderTable(key, direction) {
  const data = await loadYAML('data/overall.yaml');
  if (!data) return;

  const tasks = await loadTasksList();
  const rankings = data.rankings || [];
  let sortedData;
  
  if (key === 'totalScore') {
    sortedData = [...rankings].sort((a, b) => {
      const aScore = a.total_normalized_score || 0;
      const bScore = b.total_normalized_score || 0;
      return direction === 'asc' ? aScore - bScore : bScore - aScore;
    });
  } else if (key === 'name') {
    sortedData = [...rankings].sort((a, b) => {
      const aName = a.participant_name || '';
      const bName = b.participant_name || '';
      return direction === 'asc' 
        ? aName.localeCompare(bName)
        : bName.localeCompare(aName);
    });
  } else if (key.startsWith('task_')) {
    const taskName = key.replace('task_', '');
    sortedData = [...rankings].sort((a, b) => {
      const aScore = a.task_scores?.[taskName]?.normalized_score || 0;
      const bScore = b.task_scores?.[taskName]?.normalized_score || 0;
      return direction === 'asc' ? aScore - bScore : bScore - aScore;
    });
  } else {
    sortedData = [...rankings];
  }

  await renderOverallTable({ rankings: sortedData });
}

/**
 * Initialize task page
 */
async function initProblemPage() {
  const taskName = await getTaskNameFromUrl();
  if (!taskName) {
    const container = document.querySelector('.problem-intro');
    if (container) {
      container.innerHTML = '<div class="error">Task not found</div>';
    }
    return;
  }

  await loadProblemInfo(taskName);
  await loadProblemLeaderboard(taskName);
  if (typeof window.loadTaskEvolution === 'function' && taskName) {
    window.loadTaskEvolution(taskName);
  }
}

/**
 * Get task name from URL
 */
async function getTaskNameFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const taskName = urlParams.get('task');
  if (taskName) {
    return taskName;
  }
  
  // Compatible with old format: get task name by ID
  const idParam = urlParams.get('id');
  if (idParam) {
    const id = parseInt(idParam);
    const tasks = await loadTasksList();
    if (id >= 1 && id <= tasks.length) {
      return tasks[id - 1].task_name;
    }
  }
  
  // 从路径获取
  const path = window.location.pathname;
  const match = path.match(/problem(\d+)\.html/);
  if (match) {
    const id = parseInt(match[1]);
    const tasks = await loadTasksList();
    if (id >= 1 && id <= tasks.length) {
      return tasks[id - 1].task_name;
    }
  }
  
  return null;
}

/**
 * Load task information
 */
async function loadProblemInfo(taskName) {
  const taskData = await loadYAML(`data/problems/${taskName}.yaml`);
  if (!taskData) {
    const intro = document.querySelector('.problem-intro');
    if (intro) {
      intro.innerHTML = '<div class="error">Failed to load task data</div>';
    }
    return;
  }

  const metadata = taskData.metadata || {};
  const tasks = await loadTasksList();
  const taskIndex = tasks.findIndex(t => t.task_name === taskName);
  const taskNumber = taskIndex + 1;

  // Update page title
  document.title = `${metadata.task_name}: ${metadata.title_en || metadata.title_zh} - Leaderboard`;

  // Update task header
  const header = document.querySelector('.problem-header');
  if (header) {
    header.innerHTML = `
      <h1>${metadata.task_name}</h1>
      <div class="meta">
        <div class="meta-item">
          <span>Domain:</span>
          <span>${metadata.domain || 'Unknown'}</span>
        </div>
        <div class="meta-item">
          <span>Status:</span>
          <span class="difficulty-badge ${metadata.status === 'Completed' ? 'completed' : 'in-development'}">${metadata.status === 'Completed' ? 'Completed' : 'In Development'}</span>
        </div>
      </div>
    `;
  }

  // Update task intro
  const intro = document.querySelector('.problem-intro');
  if (intro) {
    const title = metadata.title_en || metadata.title_zh || taskName;
    const description = metadata.description || `Task: ${title}`;
    
    intro.innerHTML = `
      <h2>Task Description</h2>
      <div class="description">${description}</div>
      <div class="details">
        <div class="detail-item">
          <strong>Domain</strong>
          <span>${metadata.domain || 'Unknown'}</span>
        </div>
        <div class="detail-item">
          <strong>Status</strong>
          <span class="difficulty-badge ${metadata.status === 'Completed' ? 'completed' : 'in-development'}">${metadata.status === 'Completed' ? 'Completed' : 'In Development'}</span>
        </div>
        ${metadata.contributor ? `
        <div class="detail-item">
          <strong>Contributor</strong>
          <span>${metadata.contributor}</span>
        </div>
        ` : ''}
      </div>
    `;
  }

  // 更新导航
  await updateProblemNavigation(taskName, taskNumber);
}

/**
 * Update task navigation
 */
async function updateProblemNavigation(taskName, taskNumber) {
  const tasks = await loadTasksList();
  const taskIndex = tasks.findIndex(t => t.task_name === taskName);
  
  const prevTask = taskIndex > 0 ? tasks[taskIndex - 1] : null;
  const nextTask = taskIndex < tasks.length - 1 ? tasks[taskIndex + 1] : null;

  const prevLink = document.getElementById('prev-link');
  const nextLink = document.getElementById('next-link');
  const currentInfo = document.getElementById('current-info');

  if (prevLink) {
    if (prevTask) {
      prevLink.href = `problem.html?task=${encodeURIComponent(prevTask.task_name)}`;
      prevLink.textContent = `← ${prevTask.task_name}`;
      prevLink.style.visibility = 'visible';
    } else {
      prevLink.href = '#';
      prevLink.style.visibility = 'hidden';
    }
  }

  if (nextLink) {
    if (nextTask) {
      nextLink.href = `problem.html?task=${encodeURIComponent(nextTask.task_name)}`;
      nextLink.textContent = `${nextTask.task_name} →`;
      nextLink.style.visibility = 'visible';
    } else {
      nextLink.href = '#';
      nextLink.style.visibility = 'hidden';
    }
  }

  if (currentInfo) {
    currentInfo.textContent = `${taskName} (${taskNumber} / ${tasks.length})`;
  }
}

/**
 * Load task leaderboard
 */
async function loadProblemLeaderboard(taskName) {
  const tbody = document.getElementById('problem-tbody');
  if (!tbody) return;

  const taskData = await loadYAML(`data/problems/${taskName}.yaml`);
  if (!taskData) {
    tbody.innerHTML = '<tr><td colspan="100%" class="empty-state">' + (typeof siteT !== 'undefined' ? siteT('loadError') : 'Failed to load data') + '</td></tr>';
    return;
  }

  // Update leaderboard title
  const title = document.getElementById('leaderboard-title');
  if (title) {
    title.textContent = `${taskName} Leaderboard`;
  }

  const participants = taskData.participants || [];
  const sortedParticipants = [...participants].sort((a, b) => {
    const aScore = a.normalized_score || 0;
    const bScore = b.normalized_score || 0;
    return bScore - aScore;
  });

  await renderProblemTable(tbody, sortedParticipants);
  setupProblemTableSorting(taskName);
}

/**
 * Render task leaderboard table
 */
async function renderProblemTable(tbody, data) {
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="100%" class="empty-state">' + (typeof siteT !== 'undefined' ? siteT('emptyData') : 'No data yet') + '</td></tr>';
    return;
  }

  // Fetch baseline raw score for reference row
  let baselineRaw = null;
  const urlParams = new URLSearchParams(window.location.search);
  const taskName = urlParams.get('task');
  if (taskName) {
    try {
      const taskData = await loadYAML(`data/problems/${taskName}.yaml`);
      if (taskData && taskData.statistics && taskData.statistics.raw_score) {
        baselineRaw = taskData.statistics.raw_score.baseline;
      }
    } catch(e) {}
  }

  // Build baseline reference row
  let baselineRow = '';
  if (baselineRaw !== null && baselineRaw !== undefined) {
    baselineRow = `<tr style="background:#f0f0f0;font-style:italic;opacity:0.7">
      <td class="rank-cell">—</td>
      <td class="name-cell">Baseline</td>
      <td class="score-cell"><strong>${baselineRaw.toFixed(4)}</strong></td>
      <td>—</td>
    </tr>`;
  }

  tbody.innerHTML = baselineRow + data.map((entry, index) => {
    const rank = index + 1;
    const rawScore = entry.raw_score !== undefined ? entry.raw_score : null;
    const participantName = entry.participant_name || 'Unknown';
    const submittedAt = entry.submitted_at || entry.achieved_at || null;

    // Format raw score with smart precision
    let rawDisplay = '—';
    if (rawScore !== null) {
      if (Math.abs(rawScore) >= 100) rawDisplay = rawScore.toFixed(2);
      else if (Math.abs(rawScore) >= 1) rawDisplay = rawScore.toFixed(4);
      else rawDisplay = rawScore.toFixed(6);
    }

    // Compute relative improvement vs baseline
    let vsBaseline = '';
    if (rawScore !== null && baselineRaw !== null && Math.abs(baselineRaw) > 1e-12) {
      const pct = ((rawScore - baselineRaw) / Math.abs(baselineRaw)) * 100;
      const sign = pct >= 0 ? '+' : '';
      const cls = pct >= 0 ? 'color:#22c55e' : 'color:#ef4444';
      vsBaseline = `<br><small style="${cls}">(${sign}${pct.toFixed(2)}% vs baseline)</small>`;
    }

    return `
      <tr>
        <td class="rank-cell rank-${rank <= 3 ? rank : ''}">${rank}</td>
        <td class="name-cell">${participantName}</td>
        <td class="score-cell">
          <strong>${rawDisplay}</strong>${vsBaseline}
        </td>
        <td>${formatDate(submittedAt)}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Setup task table sorting
 */
function setupProblemTableSorting(taskName) {
  const headers = document.querySelectorAll('#problem-table th.sortable');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const key = header.dataset.sort;
      if (!key) return;

      if (currentSort.key === key) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.key = key;
        currentSort.direction = 'asc';
      }

      headers.forEach(h => {
        h.classList.remove('sort-asc', 'sort-desc');
      });
      header.classList.add(`sort-${currentSort.direction}`);

      sortAndRenderProblemTable(taskName, key, currentSort.direction);
    });
  });
}

/**
 * Sort and re-render task table
 */
async function sortAndRenderProblemTable(taskName, key, direction) {
  const taskData = await loadYAML(`data/problems/${taskName}.yaml`);
  if (!taskData) return;

  const participants = taskData.participants || [];
  let sortedData = [...participants];
  
  if (key === 'rank') {
    sortedData.sort((a, b, index) => {
      const aScore = a.normalized_score || 0;
      const bScore = b.normalized_score || 0;
      const result = bScore - aScore;
      return direction === 'asc' ? -result : result;
    });
  } else if (key === 'name') {
    sortedData.sort((a, b) => {
      const aName = a.participant_name || '';
      const bName = b.participant_name || '';
      return direction === 'asc' 
        ? aName.localeCompare(bName)
        : bName.localeCompare(aName);
    });
  } else if (key === 'score') {
    sortedData.sort((a, b) => {
      const aScore = a.normalized_score || 0;
      const bScore = b.normalized_score || 0;
      return direction === 'asc' ? aScore - bScore : bScore - aScore;
    });
  } else if (key === 'submittedAt') {
    sortedData.sort((a, b) => {
      const aDate = a.submitted_at || a.achieved_at || '';
      const bDate = b.submitted_at || b.achieved_at || '';
      return direction === 'asc' 
        ? aDate.localeCompare(bDate)
        : bDate.localeCompare(aDate);
    });
  }

  const tbody = document.getElementById('problem-tbody');
  if (tbody) {
    renderProblemTable(tbody, sortedData);  // fire-and-forget is fine here
  }
}

/**
 * Initialize home page
 */
function initHomePage() {
  // Home page init (e.g. overall table, curve, task list) is in index.html
}

// Initialize after page load
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  
  if (path.includes('leaderboard.html')) {
    initLeaderboard();
  } else if (path === '/' || path.endsWith('/') || path.includes('index.html')) {
    if (document.getElementById('overall-tbody')) {
      initLeaderboard();
    }
    initHomePage();
  } else if (path.includes('problem.html') || (path.includes('problem') && path.match(/problem\d+\.html/))) {
    initProblemPage();
  } else if (path.includes('index.html') || path === '/' || path.endsWith('/')) {
    initHomePage();
  }
});

