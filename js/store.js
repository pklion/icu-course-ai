/**
 * Central State Management with unified LocalStorage persistence and reactive subscribers.
 * Manages single-key state ('icu_scheduler_state_v2') with seamless legacy migration.
 */

import { parseDataJson, parseScheduleString } from './parser.js';
import { LLAMA_DEFAULTS } from './config.js';

const STORAGE_KEY = 'icu_scheduler_state_v2';

class Store {
  constructor() {
    this.allCourses = [];
    this.currentTerm = '秋'; // Default to Autumn 2026
    this.enrolledByTerm = {
      '春': [],
      '秋': [],
      '冬': [],
    };
    this.selectedCourse = null;
    this.activeRightTab = 'details'; // 'details' | 'ai'
    this.searchQuery = '';
    this.activeFilters = {
      major: '',
      language: '',
    };
    this.subscribers = new Set();

    // Load unified state (or migrate legacy keys)
    const state = this.loadUnifiedState();
    this.theme = state.theme || 'system';
    this.uiLang = state.uiLang || 'ja';
    this.llamaConfig = state.llamaConfig;
    this.customSchedules = state.customSchedules || {};
    this.savedEnrolledIds = state.enrolledCourseIds || { '春': [], '秋': [], '冬': [] };
  }

  // Alias for backward compatibility
  get elaCustomSchedules() {
    return this.customSchedules;
  }
  set elaCustomSchedules(val) {
    this.customSchedules = val;
  }

  /**
   * Loads unified state from localStorage or migrates existing discrete keys.
   */
  loadUnifiedState() {
    if (typeof localStorage === 'undefined') {
      return {
        theme: 'system',
        uiLang: 'ja',
        llamaConfig: { ...LLAMA_DEFAULTS },
        customSchedules: {},
        enrolledCourseIds: { '春': [], '秋': [], '冬': [] },
      };
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          theme: parsed.theme || 'system',
          uiLang: parsed.uiLang || 'ja',
          llamaConfig: this.normalizeLlamaConfig(parsed.llamaConfig),
          customSchedules: parsed.customSchedules || parsed.elaCustomSchedules || {},
          enrolledCourseIds: parsed.enrolledCourseIds || { '春': [], '秋': [], '冬': [] },
        };
      }
    } catch (e) {
      console.warn('Failed to parse unified state, checking legacy keys:', e);
    }

    // Fallback: Read discrete legacy keys & migrate
    let theme = 'system';
    let uiLang = 'ja';
    let llamaConfig = { ...LLAMA_DEFAULTS };
    let customSchedules = {};
    let enrolledCourseIds = { '春': [], '秋': [], '冬': [] };

    try {
      theme = localStorage.getItem('icu_theme') || 'system';
      uiLang = localStorage.getItem('icu_ui_lang') || 'ja';

      const savedLlama = localStorage.getItem('icu_llama_config');
      if (savedLlama) {
        llamaConfig = this.normalizeLlamaConfig(JSON.parse(savedLlama));
      }

      const savedSchedules = localStorage.getItem('icu_ela_custom_schedules_v1');
      if (savedSchedules) {
        customSchedules = JSON.parse(savedSchedules);
      }

      const savedEnrolled = localStorage.getItem('icu_enrolled_courses_v1');
      if (savedEnrolled) {
        enrolledCourseIds = JSON.parse(savedEnrolled);
      }
    } catch (e) {
      console.warn('Error reading legacy storage:', e);
    }

    const state = { theme, uiLang, llamaConfig, customSchedules, enrolledCourseIds };

    // Migrate to unified storage & clean legacy keys
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      localStorage.removeItem('icu_theme');
      localStorage.removeItem('icu_ui_lang');
      localStorage.removeItem('icu_llama_config');
      localStorage.removeItem('icu_ela_custom_schedules_v1');
      localStorage.removeItem('icu_enrolled_courses_v1');
    } catch {}

    return state;
  }

  normalizeLlamaConfig(raw) {
    if (!raw) return { ...LLAMA_DEFAULTS };
    let provider = raw.PROVIDER;
    if (!provider) {
      const ep = (raw.ENDPOINT || '').toLowerCase();
      if (ep.includes('generativelanguage')) provider = 'gemini';
      else if (ep.includes('9931') || ep.includes('/v1/')) provider = 'llama_cpp';
      else if (ep.includes('11434') || ep.includes('ollama')) provider = 'ollama';
      else provider = 'custom';
    }
    return {
      ...LLAMA_DEFAULTS,
      ...raw,
      PROVIDER: provider,
      API_KEY: raw.API_KEY || '',
      NO_THINK: raw.NO_THINK !== undefined ? Boolean(raw.NO_THINK) : (provider === 'gemini' ? false : true),
    };
  }

  saveUnifiedState() {
    if (typeof localStorage === 'undefined') return;
    try {
      const state = {
        theme: this.theme,
        uiLang: this.uiLang,
        llamaConfig: this.llamaConfig,
        customSchedules: this.customSchedules,
        enrolledCourseIds: {
          '春': (this.enrolledByTerm['春'] || []).map(c => c.id),
          '秋': (this.enrolledByTerm['秋'] || []).map(c => c.id),
          '冬': (this.enrolledByTerm['冬'] || []).map(c => c.id),
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Failed to save unified state to localStorage:', err);
    }
  }

  isElaCourse(course) {
    return Boolean(course && course.code && course.code.toUpperCase().startsWith('ELA'));
  }

  /**
   * Generalized check for whether custom schedule editing is permitted:
   * ELA, Arranged courses (no fixed slot), or courses already customized.
   */
  isCustomScheduleAllowed(course) {
    if (!course) return false;
    return Boolean(
      this.isElaCourse(course) ||
      course.isArranged ||
      course.originalIsArranged ||
      this.customSchedules[course.id]
    );
  }

  setUiLang(lang) {
    if (['ja', 'en'].includes(lang) && this.uiLang !== lang) {
      this.uiLang = lang;
      this.saveUnifiedState();
      this.notify('langChange', { lang });
    }
  }

  toggleUiLang() {
    this.setUiLang(this.uiLang === 'en' ? 'ja' : 'en');
  }

  saveLlamaConfig(cfg) {
    this.llamaConfig = { ...this.llamaConfig, ...cfg };
    this.saveUnifiedState();
    this.notify('llamaConfigChange', this.llamaConfig);
  }

  setTheme(theme) {
    this.theme = theme;
    this.saveUnifiedState();
    this.notify('themeChange', { theme });
  }

  subscribe(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  notify(event, payload) {
    for (const fn of this.subscribers) {
      try {
        fn(event, payload, this);
      } catch (err) {
        console.error('Store subscriber error:', err);
      }
    }
  }

  async init() {
    try {
      // 1. Fetch data.json & data_en.json concurrently
      const [jaRes, enRes] = await Promise.all([
        fetch('./data.json'),
        fetch('./data_en.json').catch(() => null),
      ]);
      if (!jaRes.ok) {
        throw new Error(`Failed to load data.json: HTTP ${jaRes.status}`);
      }
      const rawData = await jaRes.json();
      let rawEnData = null;
      if (enRes && enRes.ok) {
        try {
          rawEnData = await enRes.json();
        } catch {}
      }

      // 2. Parse 100% on frontend with bilingual attributes
      this.allCourses = parseDataJson(rawData, rawEnData);

      // 3. Preserve original schedules and apply saved custom schedules
      this.applySavedCustomSchedules();

      // 4. Restore enrolled courses from unified state
      this.restoreEnrolled();

      this.notify('init', { totalCourses: this.allCourses.length });
      return true;
    } catch (err) {
      console.error('Error initializing store:', err);
      this.notify('error', err);
      throw err;
    }
  }

  applySavedCustomSchedules() {
    for (const course of this.allCourses) {
      course.originalScheduleRaw = course.scheduleRaw;
      course.originalSlots = [...(course.slots || [])];
      course.originalIsArranged = course.isArranged;

      const saved = this.customSchedules[course.id];
      if (saved && typeof saved.scheduleRaw === 'string') {
        const { slots, isArranged } = parseScheduleString(saved.scheduleRaw);
        course.scheduleRaw = saved.scheduleRaw;
        course.slots = slots;
        course.isArranged = isArranged;
        course.isCustomSchedule = true;
      }
    }
  }

  setCourseCustomSchedule(courseId, scheduleRaw) {
    const course = this.allCourses.find(c => c.id === courseId);
    if (!course || !this.isCustomScheduleAllowed(course)) return false;

    const cleanRaw = (scheduleRaw || '').trim();
    const { slots, isArranged } = parseScheduleString(cleanRaw);

    course.scheduleRaw = cleanRaw;
    course.slots = slots;
    course.isArranged = isArranged;
    course.isCustomSchedule = true;

    this.customSchedules[courseId] = { scheduleRaw: cleanRaw };
    this.saveUnifiedState();

    this.notify('courseScheduleUpdated', { course });
    return true;
  }

  resetCourseCustomSchedule(courseId) {
    const course = this.allCourses.find(c => c.id === courseId);
    if (!course) return false;

    course.scheduleRaw = course.originalScheduleRaw;
    course.slots = [...(course.originalSlots || [])];
    course.isArranged = course.originalIsArranged;
    course.isCustomSchedule = false;

    delete this.customSchedules[courseId];
    this.saveUnifiedState();

    this.notify('courseScheduleUpdated', { course });
    return true;
  }

  restoreEnrolled() {
    try {
      const idsByTerm = this.savedEnrolledIds;
      if (!idsByTerm) return;

      const courseMap = new Map(this.allCourses.map(c => [c.id, c]));

      ['春', '秋', '冬'].forEach(term => {
        if (Array.isArray(idsByTerm[term])) {
          this.enrolledByTerm[term] = idsByTerm[term]
            .map(id => courseMap.get(id))
            .filter(Boolean);
        }
      });
    } catch (err) {
      console.warn('Failed to restore enrolled courses from unified state:', err);
    }
  }

  saveEnrolled() {
    this.saveUnifiedState();
  }

  setTerm(term) {
    if (this.currentTerm !== term && ['春', '秋', '冬'].includes(term)) {
      this.currentTerm = term;
      this.notify('termChange', { term });
    }
  }

  getEnrolled(term = this.currentTerm) {
    return this.enrolledByTerm[term] || [];
  }

  resolveTermForCourseId(courseId, fallbackTerm = this.currentTerm) {
    if (typeof courseId === 'string') {
      const prefix = courseId.split('-')[0];
      if (['春', '秋', '冬'].includes(prefix)) {
        return prefix;
      }
    }
    return fallbackTerm;
  }

  isEnrolled(courseId, term = null) {
    const targetTerm = term || this.resolveTermForCourseId(courseId, this.currentTerm);
    return this.getEnrolled(targetTerm).some(c => c.id === courseId);
  }

  addCourse(course) {
    if (!course) return false;
    const term = course.term || this.resolveTermForCourseId(course.id, this.currentTerm);
    if (this.isEnrolled(course.id, term)) return false;

    this.enrolledByTerm[term].push(course);
    this.saveEnrolled();
    this.notify('courseAdded', { course, term });
    return true;
  }

  removeCourse(courseId, term = null) {
    const targetTerm = term || this.resolveTermForCourseId(courseId, this.currentTerm);
    const list = this.enrolledByTerm[targetTerm];
    if (!list) return false;
    const idx = list.findIndex(c => c.id === courseId);
    if (idx !== -1) {
      const [removed] = list.splice(idx, 1);
      this.saveEnrolled();
      this.notify('courseRemoved', { course: removed, term: targetTerm });
      return true;
    }
    return false;
  }

  clearTerm(term = this.currentTerm) {
    this.enrolledByTerm[term] = [];
    this.saveEnrolled();
    this.notify('termCleared', { term });
  }

  selectCourse(course) {
    this.selectedCourse = course;
    this.notify('courseSelected', { course });
  }

  setActiveRightTab(tab) {
    if (['details', 'ai'].includes(tab)) {
      this.activeRightTab = tab;
      this.notify('rightTabChange', { tab });
    }
  }

  setSearchQuery(q) {
    this.searchQuery = q;
    this.notify('filterChange', { query: q });
  }

  setFilters(partialFilters) {
    this.activeFilters = { ...this.activeFilters, ...partialFilters };
    this.notify('filterChange', { filters: this.activeFilters });
  }
}

export const store = new Store();
