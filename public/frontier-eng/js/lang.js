/**
 * 全站语言切换（与 Evolution 共用 localStorage key：site-lang）
 */
(function () {
  const STORAGE_KEY = 'site-lang';
  const getLang = () => {
    const s = localStorage && localStorage.getItem(STORAGE_KEY);
    if (s === 'zh' || s === 'en') return s;
    return (navigator.language && navigator.language.startsWith('zh')) ? 'zh' : 'en';
  };
  let lang = getLang();

  window.SITE_I18N = {
    zh: {
      navBrand: 'Frontier-Engineering Bench',
      navLeaderboard: '排行榜',
      navHome: '首页',
      navEvolution: 'Evolution',
      navOverall: '总榜',
      navTasks: '任务',
      navContact: '联系',
      navLangZh: '中文',
      navLangEn: 'English',
      heroTitle: 'Frontier-Engineering Bench',
      heroSub: '总榜排名与各任务详细排行榜',
      overviewTitle: '系统概览',
      overviewText: '本系统提供 Frontier-Engineering Bench 的总榜与各任务排行榜，可查看各方法/参与者的综合得分与单任务得分。',
      quickNavTitle: '快捷入口',
      cardOverallTitle: '总榜',
      cardOverallDesc: '查看所有任务综合得分排名',
      cardTasksTitle: '任务列表',
      cardTasksDesc: '浏览各任务及其排行榜',
      taskListTitle: '任务列表',
      loading: '加载中…',
      loadError: '加载失败',
      overallTitle: '总榜',
      overallDesc: '展示所有参与者/模型在各任务上的综合得分',
      backToHome: '返回首页',
      taskDescTitle: '任务说明',
      leaderboardTitle: '排行榜',
      prevTask: '← 上一任务',
      nextTask: '下一任务 →',
      rank: '排名',
      participant: '参与者/模型',
      totalScore: '总分',
      score: '得分',
      submittedAt: '提交时间',
      domain: '领域',
      status: '状态',
      contributor: '贡献者',
      completed: '已完成',
      inDevelopment: '开发中',
      contactHeroTitle: '联系与参与',
      contactHeroSub: '提交 Baseline 成绩 · 贡献题目',
      contactBaselineTitle: '提交 Baseline 成绩',
      contactBaselineIntro: '若您已在某任务上跑出 baseline 或评测结果，可将结果发送至下方邮箱，我们会据此更新排行榜。邮件中请注明：方法/模型名称、任务名称、得分（及可选：提交时间、备注）。',
      contactBaselineSend: '发送至',
      contactContributeTitle: '贡献题目',
      contactContributeIntro: '若您希望为 Frontier-Engineering Bench 贡献新题目，请通过 GitHub 参与协作（仓库 Frontier-Engineering）：',
      contactContributeStep1: 'Fork Frontier-Engineering 仓库，在本地克隆您 fork 后的仓库。',
      contactContributeStep2: '按仓库 README 的提交格式添加题目：在对应领域目录下新建任务目录，包含 README.md、Task.md、verification/ 等；分支建议命名为 feat/<领域>/<任务名>。',
      contactContributeStep3: '本地通过 evaluator.py 或 Docker 测试通过后，向上游仓库的 main 分支提交 Pull Request，并在 PR 中说明题目背景、来源及如何运行验证。',
      contactContributeRef: '完整的贡献指南、提交格式与流程请见 Frontier-Engineering 仓库 README：',
      contactContributeRefLink: 'Frontier-Engineering (GitHub)',
      contactContributeRepoLink: 'Frontier-Engineering (GitHub)',
      emptyData: '暂无数据',
      searchPlaceholder: '搜索题目或领域',
      searchNoResults: '未找到匹配题目',
      curveTitle: '整体演化',
      curveNoData: '暂无演化数据',
      evolutionTitle: '演化',
      domainTaskCount: '个题目',
    },
    en: {
      navBrand: 'Frontier-Engineering Bench',
      navLeaderboard: 'Leaderboard',
      navHome: 'Home',
      navEvolution: 'Evolution',
      navOverall: 'Overall',
      navTasks: 'Tasks',
      navContact: 'Contact',
      navLangZh: '中文',
      navLangEn: 'English',
      heroTitle: 'Frontier-Engineering Bench',
      heroSub: 'Overall rankings and task-level leaderboards',
      overviewTitle: 'System Overview',
      overviewText: 'This leaderboard shows Frontier-Engineering Bench overall and per-task scores for all methods and participants.',
      quickNavTitle: 'Quick Navigation',
      cardOverallTitle: 'Overall Leaderboard',
      cardOverallDesc: 'View comprehensive score rankings across all tasks',
      cardTasksTitle: 'Task List',
      cardTasksDesc: 'Browse all tasks and their leaderboards',
      taskListTitle: 'Task List',
      loading: 'Loading…',
      loadError: 'Failed to load',
      overallTitle: 'Overall Leaderboard',
      overallDesc: 'Displaying comprehensive scores of all participants/models across all tasks',
      backToHome: 'Back to Home',
      taskDescTitle: 'Task Description',
      leaderboardTitle: 'Leaderboard',
      prevTask: '← Previous Task',
      nextTask: 'Next Task →',
      rank: 'Rank',
      participant: 'Participant/Model',
      totalScore: 'Total Score',
      score: 'Score',
      submittedAt: 'Submitted At',
      domain: 'Domain',
      status: 'Status',
      contributor: 'Contributor',
      completed: 'Completed',
      inDevelopment: 'In Development',
      contactHeroTitle: 'Contact & Participation',
      contactHeroSub: 'Submit baseline scores · Contribute tasks',
      contactBaselineTitle: 'Submit baseline score',
      contactBaselineIntro: 'If you have baseline or evaluation results for a task, send them to the email below and we will update the leaderboard. Please include: method/model name, task name, score (and optionally submission time and notes).',
      contactBaselineSend: 'Send to',
      contactContributeTitle: 'Contribute a task',
      contactContributeIntro: 'To contribute a new task to Frontier-Engineering Bench, please use GitHub (repository Frontier-Engineering):',
      contactContributeStep1: 'Fork the Frontier-Engineering repository and clone your fork locally.',
      contactContributeStep2: 'Add your task following the submission format in the repo README: create a task directory under the relevant domain with README.md, Task.md, verification/, etc. Use a branch named e.g. feat/<Domain>/<TaskName>.',
      contactContributeStep3: 'After local testing with evaluator.py or Docker, open a Pull Request to the main branch of the upstream repo and describe the task background, source, and how to run verification.',
      contactContributeRef: 'For full contribution guidelines, submission format, and process, see the Frontier-Engineering repository README:',
      contactContributeRefLink: 'Frontier-Engineering (GitHub)',
      contactContributeRepoLink: 'Frontier-Engineering (GitHub)',
      emptyData: 'No data yet',
      searchPlaceholder: 'Search tasks or domains',
      searchNoResults: 'No matching tasks',
      curveTitle: 'Overall evolution',
      curveNoData: 'No evolution data yet',
      evolutionTitle: 'Evolution',
      domainTaskCount: ' tasks',
    }
  };

  function t(key) {
    const set = window.SITE_I18N[lang];
    return (set && set[key]) ? set[key] : (window.SITE_I18N.en[key] || key);
  }

  function applyLang() {
    lang = getLang();
    if (document.documentElement) document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const key = el.getAttribute('data-i18n');
      const str = t(key);
      if (str) el.textContent = str;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      const key = el.getAttribute('data-i18n-placeholder');
      if (t(key)) el.placeholder = t(key);
    });
    var langZh = document.getElementById('site-lang-zh');
    var langEn = document.getElementById('site-lang-en');
    if (langZh) { langZh.classList.toggle('active', lang === 'zh'); langZh.textContent = t('navLangZh'); }
    if (langEn) { langEn.classList.toggle('active', lang === 'en'); langEn.textContent = t('navLangEn'); }
  }

  function setLang(newLang) {
    if (newLang !== 'zh' && newLang !== 'en') return;
    lang = newLang;
    if (localStorage) localStorage.setItem(STORAGE_KEY, lang);
    applyLang();
  }

  window.getSiteLang = getLang;
  window.setSiteLang = setLang;
  window.siteT = t;

  document.addEventListener('DOMContentLoaded', applyLang);
})();
