/**
 * Main Application Bootstrapper
 * Coordinates components, initializes store, handles tab switching, theme toggling,
 * and 3-button mobile navigation bar (<= 768px).
 */

import { store } from './store.js';
import { CalendarController } from './calendar.js';
import { CourseListController } from './course-list.js';
import { DetailsController } from './details.js';
import { AiAssistantController } from './ai-assistant.js';
import { semanticSearch } from './semantic-search.js';
import { iconSun, iconMoon } from './icons.js';

class App {
  async init() {
    this.setupTheme();
    this.setupMobileNav();

    try {
      // 1. Initialize reactive store & load data.json
      await store.init();
      // Preload syllabi.json in the background for instant semantic search
      semanticSearch.preloadSyllabi().catch(() => {});

      // 2. Initialize Middle Pane Calendar
      const calendarEl = document.getElementById('middlePane');
      const calendarController = new CalendarController(calendarEl);

      // 3. Initialize Left Pane Course List
      const leftPaneEl = document.getElementById('leftPane');
      new CourseListController(leftPaneEl, calendarController);

      // 4. Initialize Right Pane (Details & AI tabs)
      const detailsContainer = document.getElementById('detailsTabContent');
      new DetailsController(detailsContainer);

      const aiContainer = document.getElementById('aiTabContent');
      new AiAssistantController(aiContainer);

      // 5. Wire tab switching for Right Pane
      this.setupRightPaneTabs();
      this.setupBilingualLabels();

      // 6. Update theme button icon
      this.syncThemeIcon();

      // 7. Remove loading overlay
      const loader = document.getElementById('appLoader');
      if (loader) {
        loader.classList.add('fade-out');
        setTimeout(() => loader.remove(), 300);
      }
    } catch (err) {
      console.error('App init failed:', err);
      const loader = document.getElementById('appLoader');
      if (loader) {
        loader.innerHTML = `
          <div class="error-box">
            <h2>Error Loading Schedule Data</h2>
            <p>${err.message}</p>
            <p>Please make sure <code>data.json</code> is accessible in the root directory.</p>
          </div>
        `;
      }
    }
  }

  setupTheme() {
    const applyTheme = (theme) => {
      let isDark = false;
      if (theme === 'system') {
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      } else {
        isDark = theme === 'dark';
      }
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      this.syncThemeIcon();
    };

    applyTheme(store.theme);

    // Event delegation for theme toggle button
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#btnThemeToggle');
      if (btn) {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        store.setTheme(next);
        applyTheme(next);
      }
    });

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (store.theme === 'system') {
          applyTheme('system');
        }
      });
    }
  }

  syncThemeIcon() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const btn = document.getElementById('btnThemeToggle');
    if (btn) {
      btn.innerHTML = `<span class="ui-icon-glyph">${isDark ? iconSun('heroicon') : iconMoon('heroicon')}</span>`;
    }
  }

  setupMobileNav() {
    const appBody = document.getElementById('appBody');
    const navBar = document.getElementById('mobileNavBar');
    if (!navBar || !appBody) return;

    const setMobileView = (viewName) => {
      appBody.setAttribute('data-mobile-view', viewName);
      navBar.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
      });
    };

    navBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.mobile-nav-btn');
      if (btn && btn.dataset.view) {
        setMobileView(btn.dataset.view);
      }
    });

    window.setMobileView = setMobileView;
  }

  setupRightPaneTabs() {
    const tabDetails = document.getElementById('tabBtnDetails');
    const tabAi = document.getElementById('tabBtnAi');
    const contentDetails = document.getElementById('detailsTabContent');
    const contentAi = document.getElementById('aiTabContent');

    const updateTabs = (activeTab) => {
      const isDetails = activeTab === 'details';
      tabDetails.classList.toggle('active', isDetails);
      tabAi.classList.toggle('active', !isDetails);

      contentDetails.classList.toggle('active', isDetails);
      contentAi.classList.toggle('active', !isDetails);
    };

    tabDetails.addEventListener('click', () => store.setActiveRightTab('details'));
    tabAi.addEventListener('click', () => store.setActiveRightTab('ai'));

    store.subscribe((event, data) => {
      if (event === 'rightTabChange') {
        updateTabs(data.tab);
      }
    });

    updateTabs(store.activeRightTab);
  }

  setupBilingualLabels() {
    const updateLabels = () => {
      const isEn = store.uiLang === 'en';
      const tabDetailsSpan = document.querySelector('#tabBtnDetails .tab-label') || document.querySelector('#tabBtnDetails span:last-child');
      if (tabDetailsSpan) tabDetailsSpan.textContent = isEn ? 'Syllabus Details' : 'シラバス詳細';
      const tabAiSpan = document.querySelector('#tabBtnAi .tab-label') || document.querySelector('#tabBtnAi span:last-child');
      if (tabAiSpan) tabAiSpan.textContent = isEn ? 'AI Advisor' : 'AIアドバイザー';

      const navLabels = {
        catalog: isEn ? 'Catalog' : '科目一覧',
        calendar: isEn ? 'Timetable' : '時間割',
        details: isEn ? 'Syllabus / AI' : 'シラバス・AI',
      };
      document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        const view = btn.dataset.view;
        const span = btn.querySelector('.nav-label');
        if (span && navLabels[view]) {
          span.textContent = navLabels[view];
        }
      });
    };

    updateLabels();
    store.subscribe((event) => {
      if (event === 'langChange') {
        updateLabels();
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App().init();
});
