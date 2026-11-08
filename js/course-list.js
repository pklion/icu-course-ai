/**
 * Left Pane: Concise Course Catalog List & Search.
 * Features official ICU 学部メジャー (Majors/Programs) and 開講言語 (Language) filters,
 * universal search across any data.json field (titles, instructors, codes, and slots like "3/M"),
 * and compact cards with schedule tokens right next to the instructor.
 */

import { store } from './store.js';
import { DAYS } from './config.js';
import { getCoursePalette } from './major-palette.js';
import { iconAcademicCap, iconMoon, iconSearch, iconXMark, iconPlus, iconCheck, iconLanguage } from './icons.js';

// Official ICU Major & Program Filter Options (Bilingual)
export const MAJOR_FILTER_OPTIONS = [
  // College-Wide Courses / 全学共通科目
  { value: 'C000', ja: '== 全学共通科目 ==', en: '== College-Wide Courses ==', isHeader: true, group: 'college' },
  { value: 'C001', ja: '英語教育科目', en: 'English for Liberal Arts (English Language Program)', group: 'college' },
  { value: 'C002', ja: '日本語教育科目', en: 'Japanese Language Program', group: 'college' },
  { value: 'C003', ja: '一般教育科目', en: 'General Education', group: 'college' },
  { value: 'C004', ja: '保健体育科目', en: 'Health and Physical Education', group: 'college' },
  { value: 'C010', ja: '英語語学教育（選択科目）', en: 'English Language General (Electives)', group: 'college' },
  { value: 'C005', ja: '世界の言語', en: 'World Languages', group: 'college' },
  { value: 'C006', ja: '教職課程', en: 'Teacher Certification Program', group: 'college' },
  { value: 'C007', ja: '学芸員課程', en: 'Curatorial Training Program', group: 'college' },
  { value: 'C008', ja: 'サービスラーニング', en: 'Service Learning', group: 'college' },
  { value: 'C009', ja: 'その他', en: 'Others', group: 'college' },

  // Major Courses / メジャー
  { value: 'M000', ja: '== メジャー ==', en: '== Major Courses ==', isHeader: true, group: 'major' },
  { value: 'MAMS', ja: 'アメリカ研究', en: 'American Studies', group: 'major' },
  { value: 'MANT', ja: '文化人類学', en: 'Cultural Anthropology', group: 'major' },
  { value: 'MARC', ja: '美術・文化財研究', en: 'Art and Cultural Heritage', group: 'major' },
  { value: 'MAST', ja: 'アジア研究', en: 'Asian Studies', group: 'major' },
  { value: 'MBIO', ja: '生物学', en: 'Biology', group: 'major' },
  { value: 'MBUS', ja: '経営学', en: 'Business', group: 'major' },
  { value: 'MCED', ja: '比較教育', en: 'Comparative Education', group: 'major' },
  { value: 'MCHM', ja: '化学', en: 'Chemistry', group: 'major' },
  { value: 'MDPS', ja: '開発研究', en: 'Development Studies', group: 'major' },
  { value: 'MECO', ja: '経済学', en: 'Economics', group: 'major' },
  { value: 'MEDU', ja: '教育学', en: 'Education', group: 'major' },
  { value: 'MEMS', ja: '教育・メディア・社会', en: 'Education, Media and Society', group: 'major' },
  { value: 'MENV', ja: '環境研究', en: 'Environmental Studies', group: 'major' },
  { value: 'MGLS', ja: 'グローバル研究', en: 'Global Studies', group: 'major' },
  { value: 'MGSS', ja: 'ジェンダー・セクシュアリティ研究', en: 'Gender and Sexuality Studies', group: 'major' },
  { value: 'MHST', ja: '歴史学', en: 'History', group: 'major' },
  { value: 'MIRL', ja: '国際関係学', en: 'International Relations', group: 'major' },
  { value: 'MISC', ja: '情報科学', en: 'Information Science', group: 'major' },
  { value: 'MJPS', ja: '日本研究', en: 'Japan Studies', group: 'major' },
  { value: 'MLAW', ja: '法学', en: 'Law', group: 'major' },
  { value: 'MLED', ja: '言語教育', en: 'Language Education', group: 'major' },
  { value: 'MLIT', ja: '文学', en: 'Literature', group: 'major' },
  { value: 'MLNG', ja: '言語学', en: 'Linguistics', group: 'major' },
  { value: 'MMCC', ja: 'メディア・コミュニケーション・文化', en: 'Media, Communication and Culture', group: 'major' },
  { value: 'MMTH', ja: '数学', en: 'Mathematics', group: 'major' },
  { value: 'MMUS', ja: '音楽', en: 'Music', group: 'major' },
  { value: 'MPCS', ja: '平和研究', en: 'Peace Studies', group: 'major' },
  { value: 'MPHR', ja: '哲学・宗教学', en: 'Philosophy and Religion', group: 'major' },
  { value: 'MPHY', ja: '物理学', en: 'Physics', group: 'major' },
  { value: 'MPOL', ja: '政治学', en: 'Politics', group: 'major' },
  { value: 'MPPL', ja: '公共政策', en: 'Public Policy', group: 'major' },
  { value: 'MPSY', ja: '心理学', en: 'Psychology', group: 'major' },
  { value: 'MSOC', ja: '社会学', en: 'Sociology', group: 'major' },
];

// Common course prefixes for 全学共通科目
const COMMON_PREFIXES = new Set([
  'ELA', 'JLP', 'GEH', 'GEL', 'GEN', 'GES', 'GEX', 'HPE', 'ELG', 'TCP', 'CTP', 'SLR', 'STH'
]);

export class CourseListController {
  constructor(containerEl, calendarController) {
    this.container = containerEl;
    this.calendarController = calendarController;
    this.limit = 60;
    this.selectedTerms = new Set(['春', '秋', '冬']);
    this.init();
  }

  init() {
    this.renderSkeleton();
    this.attachEventListeners();
    this.renderList();

    store.subscribe((event) => {
      if (event === 'langChange') {
        this.updateBilingualLabels();
        this.renderList();
      } else if (['init', 'courseAdded', 'courseRemoved', 'termCleared', 'filterChange', 'courseScheduleUpdated'].includes(event)) {
        this.renderList();
      }
    });
  }

  updateBilingualLabels() {
    const isEn = store.uiLang === 'en';
    const btnLang = this.container.querySelector('#btnLangToggle');
    if (btnLang) {
      btnLang.title = isEn ? 'Switch to Japanese' : '英語・日本語切替';
    }

    const searchInput = this.container.querySelector('#courseSearchInput');
    if (searchInput) {
      searchInput.placeholder = isEn
        ? 'Search title, instructor, slot (e.g. 3/M)...'
        : '科目名、教員、時限（例: 3/M）...';
    }

    const filterMajor = this.container.querySelector('#filterMajor');
    if (filterMajor) {
      const curVal = filterMajor.value;
      const collegeOptions = MAJOR_FILTER_OPTIONS.filter(o => o.group === 'college');
      const majorOptions = MAJOR_FILTER_OPTIONS.filter(o => o.group === 'major');
      filterMajor.innerHTML = `
        <option value="">${isEn ? 'All Majors' : 'すべてのメジャー'}</option>
        <optgroup label="${isEn ? 'College-Wide Courses' : '全学共通科目'}">
          ${collegeOptions.map(o => `<option value="${o.value}">${isEn ? o.en : o.ja}</option>`).join('')}
        </optgroup>
        <optgroup label="${isEn ? 'Major Courses' : 'メジャー'}">
          ${majorOptions.map(o => `<option value="${o.value}">${isEn ? o.en : o.ja}</option>`).join('')}
        </optgroup>
      `;
      filterMajor.value = curVal;
      filterMajor.title = isEn ? 'All Majors' : 'すべてのメジャー';
    }

    const filterLang = this.container.querySelector('#filterLang');
    if (filterLang) {
      const curVal = filterLang.value;
      filterLang.innerHTML = isEn ? `
        <option value="">All Lang</option>
        <option value="J">J (Japanese)</option>
        <option value="E">E (English)</option>
        <option value="O">O (Others)</option>
      ` : `
        <option value="">全言語</option>
        <option value="J">J (日本語)</option>
        <option value="E">E (英語)</option>
        <option value="O">O (その他)</option>
      `;
      filterLang.value = curVal;
      filterLang.title = isEn ? 'Language' : '開講言語';
    }

    const termSegmented = this.container.querySelector('#termSegmented');
    if (termSegmented) {
      const termNames = isEn
        ? { '春': 'Spring', '秋': 'Autumn', '冬': 'Winter' }
        : { '春': '春', '秋': '秋', '冬': '冬' };
      termSegmented.querySelectorAll('.ui-segment-btn').forEach(btn => {
        const t = btn.dataset.term;
        if (t && termNames[t]) {
          btn.innerHTML = `<span>${termNames[t]}</span>`;
        }
      });
    }
  }

  renderSkeleton() {
    const isEn = store.uiLang === 'en';
    const collegeOptions = MAJOR_FILTER_OPTIONS.filter(o => o.group === 'college');
    const majorOptions = MAJOR_FILTER_OPTIONS.filter(o => o.group === 'major');

    const collegeGroupLabel = isEn ? 'College-Wide Courses' : '全学共通科目';
    const majorGroupLabel = isEn ? 'Major Courses' : 'メジャー';
    const allMajorsLabel = isEn ? 'All Majors' : 'すべてのメジャー';

    const majorSelectHtml = `
      <option value="" selected>${allMajorsLabel}</option>
      <optgroup label="${collegeGroupLabel}">
        ${collegeOptions.map(o => `<option value="${o.value}">${isEn ? o.en : o.ja}</option>`).join('')}
      </optgroup>
      <optgroup label="${majorGroupLabel}">
        ${majorOptions.map(o => `<option value="${o.value}">${isEn ? o.en : o.ja}</option>`).join('')}
      </optgroup>
    `;

    const langSelectHtml = isEn ? `
      <option value="" selected>All Lang</option>
      <option value="J">J (Japanese)</option>
      <option value="E">E (English)</option>
      <option value="O">O (Others)</option>
    ` : `
      <option value="" selected>全言語</option>
      <option value="J">J (日本語)</option>
      <option value="E">E (英語)</option>
      <option value="O">O (その他)</option>
    `;

    const termNames = isEn
      ? { '春': 'Spring', '秋': 'Autumn', '冬': 'Winter' }
      : { '春': '春', '秋': '秋', '冬': '冬' };

    this.container.innerHTML = `
      <div class="course-list-header">
        <!-- Brand Header with Title, Language Toggle & Theme Toggle -->
        <div class="left-pane-brand">
          <div class="brand-title-wrap">
            <span class="brand-icon">${iconAcademicCap('heroicon-md')}</span>
            <span class="brand-title">Course Scheduler</span>
          </div>
          <div class="brand-actions" style="display:flex;align-items:center;gap:6px;">
            <button class="ui-icon-btn sm" id="btnLangToggle" title="${isEn ? 'Switch to Japanese' : '英語・日本語切替'}" aria-label="Language Toggle">
              <span class="ui-icon-glyph">${iconLanguage('heroicon')}</span>
            </button>
            <button class="ui-icon-btn sm" id="btnThemeToggle" title="${isEn ? 'Toggle Theme' : 'テーマ切替'}" aria-label="Theme Toggle">
              <span class="ui-icon-glyph">${iconMoon('heroicon')}</span>
            </button>
          </div>
        </div>

        <!-- Universal Search Input -->
        <div class="search-box">
          <span class="search-icon">${iconSearch('heroicon-sm')}</span>
          <input type="text" id="courseSearchInput" placeholder="${isEn ? 'Search title, instructor, slot (e.g. 3/M)...' : '科目名、教員、時限（例: 3/M）...'}" autocomplete="off">
          <button id="btnClearSearch" class="btn-clear-search" title="Clear">${iconXMark('heroicon-sm')}</button>
        </div>

        <!-- Compact, Self-Explanatory Filters -->
        <div class="filters-container">
          <!-- Row 1: Majors Selection -->
          <div class="filter-row">
            <select id="filterMajor" class="ui-select" title="${isEn ? 'All Majors' : 'すべてのメジャー'}">
              ${majorSelectHtml}
            </select>
          </div>

          <!-- Row 2: Language & Terms Side-by-Side -->
          <div class="filter-row-dual">
            <select id="filterLang" class="ui-select" title="${isEn ? 'Language' : '開講言語'}">
              ${langSelectHtml}
            </select>

            <!-- Term Toggle Pills (Segmented Multiple-Selection) -->
            <div class="ui-segmented term-segmented" id="termSegmented">
              <button type="button" class="ui-segment-btn ${this.selectedTerms.has('春') ? 'active' : ''}" data-term="春">
                <span>${termNames['春']}</span>
              </button>
              <button type="button" class="ui-segment-btn ${this.selectedTerms.has('秋') ? 'active' : ''}" data-term="秋">
                <span>${termNames['秋']}</span>
              </button>
              <button type="button" class="ui-segment-btn ${this.selectedTerms.has('冬') ? 'active' : ''}" data-term="冬">
                <span>${termNames['冬']}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="catalog-summary">
          <span id="catalogCount">0 courses</span>
        </div>
      </div>

      <div class="course-cards-container" id="courseCardsContainer"></div>
    `;
  }

  attachEventListeners() {
    const searchInput = this.container.querySelector('#courseSearchInput');
    const btnClearSearch = this.container.querySelector('#btnClearSearch');

    let searchDebounceTimer = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounceTimer);
      const val = e.target.value;
      searchDebounceTimer = setTimeout(() => {
        this.limit = 60;
        store.setSearchQuery(val.trim());
      }, 150);
    });

    btnClearSearch.addEventListener('click', () => {
      clearTimeout(searchDebounceTimer);
      searchInput.value = '';
      this.limit = 60;
      store.setSearchQuery('');
      searchInput.focus();
    });

    const filterMajor = this.container.querySelector('#filterMajor');
    const filterLang = this.container.querySelector('#filterLang');

    const handleFilterChange = () => {
      this.limit = 60;
      store.setFilters({
        major: filterMajor.value,
        language: filterLang.value,
      });
    };

    filterMajor.addEventListener('change', handleFilterChange);
    filterLang.addEventListener('change', handleFilterChange);

    const termSegmented = this.container.querySelector('#termSegmented');
    if (termSegmented) {
      termSegmented.addEventListener('click', (e) => {
        const btn = e.target.closest('.ui-segment-btn');
        if (btn && btn.dataset.term) {
          const t = btn.dataset.term;
          if (this.selectedTerms.has(t)) {
            // Must have at least one term selected
            if (this.selectedTerms.size > 1) {
              this.selectedTerms.delete(t);
              btn.classList.remove('active');
            }
          } else {
            this.selectedTerms.add(t);
            btn.classList.add('active');
          }
          this.limit = 60;
          this.renderList();
        }
      });
    }

    const btnLangToggle = this.container.querySelector('#btnLangToggle');
    if (btnLangToggle) {
      btnLangToggle.addEventListener('click', () => {
        store.toggleUiLang();
      });
    }

    // Delegated card event handlers on courseCardsContainer (zero per-card listener churn)
    const coursesList = this.container.querySelector('#courseCardsContainer');
    if (coursesList) {
      coursesList.addEventListener('click', (e) => {
        const card = e.target.closest('.catalog-course-card');
        if (!card) return;
        const courseId = card.dataset.courseId;
        const course = store.allCourses.find(c => c.id === courseId);
        if (!course) return;

        if (e.target.closest('.btn-toggle-enroll')) {
          e.stopPropagation();
          if (store.isEnrolled(courseId, course.term)) {
            store.removeCourse(courseId, course.term);
          } else {
            store.addCourse(course);
          }
          return;
        }

        // Clicking card selects course and opens syllabus directly
        store.selectCourse(course);
        store.setActiveRightTab('details');

        // On mobile (<= 768px), switch to details view via 3-button navigation
        if (window.innerWidth <= 768 && window.setMobileView) {
          window.setMobileView('details');
        }
      });

      coursesList.addEventListener('dragstart', (e) => {
        const card = e.target.closest('.catalog-course-card');
        if (!card) return;
        const courseId = card.dataset.courseId;
        const course = store.allCourses.find(c => c.id === courseId);
        if (!course) return;

        e.dataTransfer.setData('text/plain', courseId);
        e.dataTransfer.effectAllowed = 'copy';
        this.calendarController.setDraggedCourse(course);
        card.classList.add('dragging');
      });

      coursesList.addEventListener('dragend', (e) => {
        const card = e.target.closest('.catalog-course-card');
        if (card) {
          card.classList.remove('dragging');
        }
        this.calendarController.setDraggedCourse(null);
      });
    }

    const cardsContainer = this.container.querySelector('#courseCardsContainer');
    cardsContainer.addEventListener('scroll', () => {
      if (cardsContainer.scrollTop + cardsContainer.clientHeight >= cardsContainer.scrollHeight - 100) {
        if (this.limit < this.filteredCoursesCache?.length) {
          this.limit += 40;
          this.renderList(true);
        }
      }
    });
  }

  matchesMajor(course, selectedMajor) {
    if (!selectedMajor) return true;

    const code = course.code.toUpperCase();
    const prefixMatch = code.match(/^([A-Z]+)/);
    const prefix = prefixMatch ? prefixMatch[1] : '';

    // == 全学共通科目 ==
    if (selectedMajor === 'C000') {
      return code.startsWith('W') || COMMON_PREFIXES.has(prefix);
    }
    if (selectedMajor === 'C001') return prefix === 'ELA'; // 英語教育科目
    if (selectedMajor === 'C002') return prefix === 'JLP'; // 日本語教育科目
    if (selectedMajor === 'C003') return ['GEH', 'GEL', 'GEN', 'GES', 'GEX'].includes(prefix); // 一般教育科目
    if (selectedMajor === 'C004') return prefix === 'HPE'; // 保健体育科目
    if (selectedMajor === 'C010') return prefix === 'ELG'; // 英語語学教育（選択科目）
    if (selectedMajor === 'C005') return code.startsWith('W'); // 世界の言語
    if (selectedMajor === 'C006') return prefix === 'TCP'; // 教職課程
    if (selectedMajor === 'C007') return prefix === 'CTP'; // 学芸員課程
    if (selectedMajor === 'C008') return prefix === 'SLR'; // サービスラーニング
    if (selectedMajor === 'C009') return prefix === 'STH'; // その他

    // == メジャー ==
    if (selectedMajor === 'M000') {
      return !code.startsWith('W') && !COMMON_PREFIXES.has(prefix);
    }

    // Specific Major by 3-letter prefix (MAMS -> AMS, MISC -> ISC)
    if (selectedMajor.startsWith('M')) {
      const targetPrefix = selectedMajor.slice(1);
      return prefix === targetPrefix;
    }

    return true;
  }

  matchesLanguage(course, selectedLang) {
    if (!selectedLang) return true;
    return course.language === selectedLang;
  }

  matchesQuery(course, query) {
    if (!query) return true;

    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    const corpus = `${course.code} ${course.titleJa || ''} ${course.titleEn || ''} ${course.title || ''} ${course.scheduleRaw} ${course.instructor} ${course.credits} ${course.credits}cr ${course.credits}単位 ${course.language} ${course.term} ${course.term}学期 ${course.termEn || ''} ${course.termEn || ''} Term`.toLowerCase();

    return tokens.every(token => {
      // 1. Direct substring match against full text corpus
      if (corpus.includes(token)) return true;

      // 2. Direct slot token match (e.g. "3/m", "*4/w", "1/tu")
      if (course.slots && course.slots.some(s => {
        const label = s.label.toLowerCase();
        const slotKey = s.slotKey.toLowerCase();
        const dayCode = s.day.toLowerCase();
        const pNum = String(s.period);
        return label === token || label.includes(token) || slotKey.includes(token) || dayCode === token;
      })) {
        return true;
      }

      // 3. Day name matching (Japanese & English via config.DAYS)
      const matchedDay = DAYS.find(d =>
        token === d.code.toLowerCase() ||
        token === d.short.toLowerCase() ||
        token === d.name.toLowerCase() ||
        token === d.nameJa ||
        token === `${d.nameJa}曜` ||
        token === `${d.nameJa}曜日`
      );
      if (matchedDay && course.slots?.some(s => s.day === matchedDay.code)) {
        return true;
      }

      return false;
    });
  }

  getFilteredCourses() {
    const query = store.searchQuery;
    const { major, language } = store.activeFilters;

    return store.allCourses.filter(course => {
      // Term filter (checkboxes)
      if (!this.selectedTerms.has(course.term)) return false;

      // Major filter
      if (!this.matchesMajor(course, major)) return false;

      // Language filter
      if (!this.matchesLanguage(course, language)) return false;

      // Universal search across all data.json information
      if (!this.matchesQuery(course, query)) return false;

      return true;
    });
  }

  renderList(append = false) {
    const container = this.container.querySelector('#courseCardsContainer');
    const filtered = this.getFilteredCourses();
    this.filteredCoursesCache = filtered;

    const isEn = store.uiLang === 'en';
    const termLabel = Array.from(this.selectedTerms).map(t => isEn ? (t === '春' ? 'Spring' : t === '秋' ? 'Autumn' : 'Winter') : t).join('・') || (isEn ? 'None' : '選択なし');
    this.container.querySelector('#catalogCount').textContent = 
      `${Math.min(this.limit, filtered.length)} of ${filtered.length} courses (${termLabel})`;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-results">
          <p>No courses found for selected terms (${termLabel}).</p>
        </div>
      `;
      return;
    }

    const slice = filtered.slice(0, this.limit);

    const html = slice.map(course => {
      const isEnrolled = store.isEnrolled(course.id, course.term);
      const palette = getCoursePalette(course);
      const title = (isEn ? course.titleEn : course.titleJa) || course.title;
      const termDisplay = isEn ? (course.termEn || course.term) : course.term;

      const canCustom = store.isCustomScheduleAllowed(course);
      const isCustomized = Boolean(course.isCustomSchedule);

      let scheduleHtml = '';
      if (course.slots && course.slots.length > 0) {
        scheduleHtml = course.slots.map(s => `
          <span class="sched-pill ${s.isSuper ? 'super' : ''}">${s.label}</span>
        `).join('');
        if (isCustomized) {
          scheduleHtml += `<span class="sched-pill" style="border-color:var(--md-sys-color-primary); color:var(--md-sys-color-primary); font-weight:700;">Custom</span>`;
        }
      } else if (canCustom) {
        scheduleHtml = `<span class="sched-pill" style="opacity:0.8; font-style:italic; border-style:dashed;">${isEn ? 'Editable' : '時間割設定可'}</span>`;
      }

      return `
        <div class="catalog-course-card ${isEnrolled ? 'is-enrolled' : ''}"
             data-course-id="${course.id}"
             data-palette="${palette}"
             draggable="true">
          <div class="catalog-card-header">
            <span class="code-pill">${course.code}</span>
            <span class="term-pill" data-term="${course.term}">${termDisplay}</span>
            <span class="credits-pill">${course.credits} cr</span>
            <span class="lang-pill">${course.language || 'J/E'}</span>
            <button class="m3-button ${isEnrolled ? 'filled-danger' : 'filled'} btn-toggle-enroll" data-id="${course.id}">
              ${isEnrolled ? `${iconCheck('heroicon-xs')} Added` : `${iconPlus('heroicon-xs')} Add`}
            </button>
          </div>

          <div class="catalog-card-title">${title}</div>

          <!-- Schedule right next to teacher name on the same line -->
          <div class="catalog-card-meta">
            <span class="catalog-card-prof" title="${course.instructor || ''}">${course.instructor || 'Staff'}</span>
            <div class="catalog-card-schedule">
              ${scheduleHtml}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // High performance DOM update via DocumentFragment (delegated events on container handle clicks/drags)
    const template = document.createElement('template');
    template.innerHTML = html;
    container.replaceChildren(template.content);
  }
}
