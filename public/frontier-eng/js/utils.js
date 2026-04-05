// 工具函数

/**
 * 格式化分数显示
 */
function formatScore(score) {
  if (typeof score !== 'number') return '-';
  return (score * 100).toFixed(2) + '%';
}

/**
 * 根据分数获取样式类
 */
function getScoreClass(score) {
  if (score >= 0.9) return 'high';
  if (score >= 0.7) return 'medium';
  return 'low';
}

/**
 * 格式化日期
 */
function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN');
}

/**
 * 获取难度样式类
 */
function getDifficultyClass(difficulty) {
  const lower = difficulty.toLowerCase();
  if (lower === 'easy') return 'easy';
  if (lower === 'medium') return 'medium';
  if (lower === 'hard') return 'hard';
  return '';
}

/**
 * 防抖函数
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 加载 JSON 数据
 */
async function loadJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    return null;
  }
}

/**
 * 加载 YAML 数据（需要 js-yaml 库）
 */
async function loadYAML(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    // 使用 js-yaml 解析（如果已加载）
    if (typeof jsyaml !== 'undefined') {
      return jsyaml.load(text);
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * 创建排序函数
 */
function createSortFunction(key, direction = 'asc') {
  return (a, b) => {
    let aVal = a[key];
    let bVal = b[key];
    
    // 处理嵌套对象（如 scores.problem_1）
    if (key.includes('.')) {
      const keys = key.split('.');
      aVal = keys.reduce((obj, k) => obj?.[k], a);
      bVal = keys.reduce((obj, k) => obj?.[k], b);
    }
    
    // 处理数字
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    // 处理字符串
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return direction === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    return 0;
  };
}

/**
 * 高亮搜索关键词
 */
function highlightText(text, keyword) {
  if (!keyword) return text;
  const regex = new RegExp(`(${keyword})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

