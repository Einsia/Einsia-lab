/**
 * Site i18n — English only (simplified from bilingual version)
 */
(function () {
  window.SITE_I18N = {
    en: {
      navBrand: 'Frontier-Engineering Bench',
      navTagline: 'Generative optimization benchmark',
      navLeaderboardTab: 'Leaderboard',
      navHome: 'Home',
      navOverall: 'Overall',
      navTasks: 'Tasks',
      navContact: 'Contact',
      navReturnLab: 'Return to Lab',
      heroTitle: 'Frontier-Engineering Bench',
      heroSub: 'Overall rankings and task-level leaderboards',
      heroPaperLink: 'Paper (arXiv)',
      heroGitHubLink: 'GitHub Repo',
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
      overallDescModel: 'Displaying comprehensive scores of all Models across tasks',
      overallDescFramework: 'Displaying comprehensive scores of all Frameworks across tasks',
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
      contactHeroTitle: 'Contact',
      contactHeroSub: 'Submission & contribution',
      contactBaselineTitle: 'Submit results',
      contactBaselineIntro: 'For leaderboard result submissions, please send task name, method/model, and score to:',
      contactBaselineSend: 'Send to',
      contactContributeTitle: 'Contribute a task',
      contactContributeIntro: 'Please submit task contributions via Pull Request to:',
      contactContributeRefLink: 'Frontier-Engineering (GitHub)',
      contactContributeRepoLink: 'Frontier-Engineering (GitHub)',
      emptyData: 'No data yet',
      searchPlaceholder: 'Search tasks or domains',
      searchNoResults: 'No matching tasks',
      domainTaskCount: ' tasks',
      expTabModel: 'Model Leaderboard',
      expTabFramework: 'Framework Leaderboard',
    }
  };

  var lang = 'en';

  function t(key) {
    const set = window.SITE_I18N[lang];
    return (set && set[key]) ? set[key] : key;
  }

  function applyLang() {
    if (document.documentElement) document.documentElement.lang = 'en';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const key = el.getAttribute('data-i18n');
      const str = t(key);
      if (str) el.textContent = str;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      const key = el.getAttribute('data-i18n-placeholder');
      if (t(key)) el.placeholder = t(key);
    });
  }

  window.getSiteLang = function() { return 'en'; };
  window.setSiteLang = function() {};
  window.siteT = t;

  document.addEventListener('DOMContentLoaded', applyLang);
})();
