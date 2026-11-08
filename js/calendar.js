/**
 * Middle Pane: Rock-Solid Unified Timetable Grid.
 * All normal period rows share the exact same 80px height.
 * Every time block on the left and day cell on the right share the same grid row,
 * guaranteeing 100% perfect alignment for Periods 1 through 7.
 * Super periods (*4, *5, *7) are displayed by physical size expansion.
 */

import { PERIODS, DAYS } from './config.js';
import { store } from './store.js';
import { calculateCreditTotals, checkCourseCollision } from './conflict.js';
import { exportToICS } from './ics-exporter.js';
import { getCoursePalette } from './major-palette.js';
import { iconArrowDownTray, iconTrash, iconXMark } from './icons.js';

export class CalendarController {
  constructor(containerEl) {
    this.container = containerEl;
    this.draggedCourse = null;
    this.init();
  }

  init() {
    this.renderSkeleton();
    this.attachEventListeners();
    this.render();

    store.subscribe((event) => {
      if (['init', 'termChange', 'courseAdded', 'courseRemoved', 'termCleared', 'langChange', 'courseScheduleUpdated'].includes(event)) {
        this.render();
      }
    });
  }

  renderSkeleton() {
    this.container.innerHTML = `
      <!-- Top Bar: Term Switcher & Simple Credit Meter -->
      <div class="calendar-top-bar">
        <div class="term-selector" id="termSelector">
          <button class="term-chip" data-term="春">Spring</button>
          <button class="term-chip" data-term="秋">Autumn</button>
          <button class="term-chip" data-term="冬">Winter</button>
        </div>

        <div class="credit-stats-bar" id="creditStatsBar"></div>

        <div class="calendar-actions">
          <button class="m3-button tonal" id="btnExportIcs" title="Export schedule to calendar (.ics)">
            <span class="ui-icon-glyph">${iconArrowDownTray('heroicon-sm')}</span>
            <span>Export .ics</span>
          </button>
          <button class="m3-button tonal" id="btnClearSchedule" title="Clear this term">
            <span class="ui-icon-glyph">${iconTrash('heroicon-sm')}</span>
            <span>Clear</span>
          </button>
        </div>
      </div>

      <!-- Unplaced ELA Banner (rendered dynamically) -->
      <div id="elaUnplacedContainer"></div>

      <!-- Timetable Scroll View with Unified Grid -->
      <div class="timetable-scroll-container">
        <div class="timetable-grid-table" id="timetableGridTable">
          <!-- Rendered dynamically -->
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    // Term switcher
    this.container.querySelector('#termSelector').addEventListener('click', (e) => {
      const btn = e.target.closest('.term-chip');
      if (btn && btn.dataset.term) {
        store.setTerm(btn.dataset.term);
      }
    });

    // Clear schedule
    this.container.querySelector('#btnClearSchedule').addEventListener('click', () => {
      if (confirm(`Clear all enrolled courses for ${store.currentTerm} term?`)) {
        store.clearTerm();
      }
    });

    // Export .ics
    this.container.querySelector('#btnExportIcs').addEventListener('click', () => {
      const enrolled = store.getEnrolled();
      if (enrolled.length === 0) {
        alert('No courses enrolled in the current term to export.');
        return;
      }
      exportToICS(enrolled, store.currentTerm);
    });

    // Unified Grid Drag & Drop
    const gridTable = this.container.querySelector('#timetableGridTable');

    gridTable.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      const cell = e.target.closest('.timetable-cell');
      if (cell) {
        this.clearDropHighlights();
        cell.classList.add('cell-drop-active');
      }
    });

    gridTable.addEventListener('dragleave', (e) => {
      const cell = e.target.closest('.timetable-cell');
      if (cell && !cell.contains(e.relatedTarget)) {
        cell.classList.remove('cell-drop-active');
      }
    });

    gridTable.addEventListener('drop', (e) => {
      e.preventDefault();
      this.clearDropHighlights();
      const courseId = e.dataTransfer.getData('text/plain');
      const course = store.allCourses.find(c => c.id === courseId);
      if (course) {
        store.addCourse(course);
        store.selectCourse(course);
      }
    });
  }

  clearDropHighlights() {
    this.container.querySelectorAll('.timetable-cell').forEach(c => {
      c.classList.remove('cell-drop-active');
    });
  }

  setDraggedCourse(course) {
    this.draggedCourse = course;
  }

  render() {
    this.renderTermChips();
    this.renderCreditStats();
    this.renderUnplacedCourses();
    this.renderGridTable();
  }

  renderUnplacedCourses() {
    const unplacedEl = this.container.querySelector('#elaUnplacedContainer');
    if (!unplacedEl) return;

    const enrolled = store.getEnrolled();
    const unplacedCourses = enrolled.filter(c => c.isArranged);

    if (unplacedCourses.length === 0) {
      unplacedEl.innerHTML = '';
      return;
    }

    const isJa = store.uiLang !== 'en';
    unplacedEl.innerHTML = `
      <div class="ela-unplaced-banner">
        <span class="ela-unplaced-label">${isJa ? '時間割未配置の科目 (ELA・論文・実習等):' : 'Unscheduled Courses (Arranged / ELA):'}</span>
        ${unplacedCourses.map(c => `
          <button type="button" class="ela-unplaced-chip" data-course-id="${c.id}" title="${isJa ? 'クリックして時間割を設定' : 'Click to set schedule'}">
            <span class="chip-code">${c.code}</span>
            <span class="chip-hint">${isJa ? 'コマ設定' : 'Set Slots'}</span>
          </button>
        `).join('')}
      </div>
    `;

    unplacedEl.querySelectorAll('.ela-unplaced-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const courseId = chip.dataset.courseId;
        const course = enrolled.find(c => c.id === courseId);
        if (course) {
          store.selectCourse(course);
          store.setActiveRightTab('details');
          if (window.innerWidth <= 768 && window.setMobileView) {
            window.setMobileView('details');
          }
        }
      });
    });
  }

  renderTermChips() {
    const chips = this.container.querySelectorAll('.term-chip');
    chips.forEach(chip => {
      chip.classList.toggle('active', chip.dataset.term === store.currentTerm);
    });
  }

  renderCreditStats() {
    const enrolled = store.getEnrolled();
    const totals = calculateCreditTotals(enrolled);
    const statsEl = this.container.querySelector('#creditStatsBar');

    statsEl.innerHTML = `
      <div class="grayscale-credit-meter">
        <span>Academic: <strong>${totals.academicCredits}</strong> / ${totals.maxAcademic} cr</span>
        <span class="sep">•</span>
        <span>PE: <strong>${totals.peCredits}</strong> / ${totals.maxPE} cr</span>
        <span class="sep">•</span>
        <span>Total: <strong>${totals.totalCredits}</strong> / ${totals.maxTotal} cr</span>
      </div>
    `;
  }

  renderGridTable() {
    const grid = this.container.querySelector('#timetableGridTable');
    const enrolled = store.getEnrolled();

    let html = '';

    // Row 1: Header (Time, Mon..Sat)
    html += `<div class="grid-header-cell time-header">Time</div>`;
    DAYS.forEach(d => {
      html += `
        <div class="grid-header-cell day-header">
          ${d.short} <span class="sub-kanji">(${d.nameJa})</span>
        </div>
      `;
    });

    // Rows 2 to 9: Periods 1 to 7 + Lunch
    PERIODS.forEach(p => {
      const isLunch = p.period === 'lunch';

      // Left Column: Time Block
      html += `
        <div class="time-block-cell ${isLunch ? 'lunch-time-block' : ''}">
          <span class="p-num">${isLunch ? 'Lunch' : p.period}</span>
          <span class="p-time">${p.normal.start}-${p.normal.end}</span>
        </div>
      `;

      // 6 Day Columns
      DAYS.forEach(day => {
        if (isLunch) {
          // Lunch cell
          html += `
            <div class="timetable-cell lunch-cell" data-day="${day.code}" data-period="lunch">
              <span class="lunch-label">Lunch Break</span>
            </div>
          `;
        } else {
          // Period cell (P1, P2, P3, P4, P5, P6, P7)
          // Find all enrolled course slots for this exact (day, period)
          const matchingSlots = [];
          enrolled.forEach(course => {
            if (!course.slots) return;
            course.slots.forEach(slot => {
              if (slot.day === day.code && slot.period === p.period) {
                matchingSlots.push({ course, slot });
              }
            });
          });

          // Check if any course in this cell has conflicts
          const hasConflict = matchingSlots.length > 1;

          html += `
            <div class="timetable-cell" data-day="${day.code}" data-period="${p.period}">
              <div class="cell-cards-wrapper ${hasConflict ? 'multi-cards' : ''}">
                ${matchingSlots.map(item => this.renderCard(item.course, item.slot, hasConflict)).join('')}
              </div>
            </div>
          `;
        }
      });
    });

    grid.innerHTML = html;

    // Attach card click handlers
    grid.querySelectorAll('.calendar-card').forEach(card => {
      const courseId = card.dataset.courseId;
      const course = enrolled.find(c => c.id === courseId);

      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-card-del')) {
          e.stopPropagation();
          store.removeCourse(courseId);
          return;
        }
        if (course) {
          store.selectCourse(course);
          store.setActiveRightTab('details');

          // On mobile (<= 768px), switch to details view via 3-button navigation
          if (window.innerWidth <= 768 && window.setMobileView) {
            window.setMobileView('details');
          }
        }
      });
    });
  }

  renderCard(course, slot, hasConflict) {
    const isSuper = slot.isSuper;
    const peClass = course.isPE ? 'card-pe' : '';
    const conflictClass = hasConflict ? 'card-conflict' : '';

    // Physical sizing modifier classes for super periods
    let superSizeClass = '';
    if (isSuper) {
      if (slot.period === 4) superSizeClass = 'card-super-p4'; // stretches up into lunch
      else if (slot.period === 5) superSizeClass = 'card-super-p5'; // stretches down into P6
      else if (slot.period === 7) superSizeClass = 'card-super-p7'; // stretches down past P7
      else superSizeClass = 'card-super';
    }

    const palette = getCoursePalette(course);
    const title = (store.uiLang === 'en' ? course.titleEn : course.titleJa) || course.title;
    const isCustom = Boolean(course.isCustomSchedule);

    return `
      <div class="calendar-card ${peClass} ${superSizeClass} ${conflictClass}" 
           data-course-id="${course.id}"
           data-palette="${palette}"
           title="${course.code}: ${title} (${slot.timeDisplay}) [${course.credits} cr]">
        
        <div class="card-content">
          <div class="card-header-line">
            <span class="code">${course.code}</span>
            ${isCustom ? `<span class="badge-custom">Custom</span>` : ''}
            <button class="btn-card-del" title="Remove course">${iconXMark('heroicon-xs')}</button>
          </div>

          <div class="card-title-line">${title}</div>

          <div class="card-footer-line">
            <span class="prof">${course.instructor || ''}</span>
          </div>
        </div>
      </div>
    `;
  }
}
