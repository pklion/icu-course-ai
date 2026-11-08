import { store } from './store.js';
import { getCoursePalette } from './major-palette.js';
import { parseScheduleString } from './parser.js';
import { iconPlus, iconTrash, iconArrowTopRight, iconCalendar, iconChevronDown, iconCheck } from './icons.js';

export class DetailsController {
  constructor(containerEl) {
    this.container = containerEl;
    this.isElaEditorCollapsed = false;
    this.init();
  }

  init() {
    this.render();

    store.subscribe((event) => {
      if (['courseSelected', 'courseAdded', 'courseRemoved', 'termChange', 'langChange', 'courseScheduleUpdated'].includes(event)) {
        this.render();
      }
    });
  }

  render() {
    const course = store.selectedCourse;

    if (!course) {
      const isJa = store.uiLang !== 'en';
      this.container.innerHTML = `
        <div class="syllabus-empty-zen">
          <p>${isJa ? '科目を選択すると、公式シラバスを確認できます。' : 'Select any course to inspect its official university syllabus.'}</p>
        </div>
      `;
      return;
    }

    const isJa = store.uiLang !== 'en';
    const isEnrolled = store.isEnrolled(course.id, course.term);
    const palette = getCoursePalette(course);
    const title = (store.uiLang === 'en' ? course.titleEn : course.titleJa) || course.title;
    const canCustomSchedule = store.isCustomScheduleAllowed(course);

    this.container.innerHTML = `
      <div class="syllabus-pane-layout">
        <!-- Minimal Zen Action Bar -->
        <div class="syllabus-zen-bar" data-palette="${palette}">
          <div class="syllabus-title-group">
            <span class="code">${course.code}</span>
            <span class="title">${title}</span>
            <span class="cr">${course.credits} cr</span>
          </div>

          <div class="syllabus-zen-actions">
            <button class="m3-button ${isEnrolled ? 'filled-danger' : 'filled'}" id="btnDetailsToggleEnroll">
              <span class="ui-icon-glyph">${isEnrolled ? iconTrash('heroicon-xs') : iconPlus('heroicon-xs')}</span>
              <span>${isEnrolled ? (isJa ? '解除' : 'Remove') : (isJa ? '追加' : 'Add')}</span>
            </button>
            ${course.url ? `
              <a href="${course.url}" target="_blank" rel="noopener noreferrer" class="m3-button tonal" title="${isJa ? '別ウィンドウで開く' : 'Open in new window'}">
                <span>Open</span>
                <span class="ui-icon-glyph">${iconArrowTopRight('heroicon-xs')}</span>
              </a>
            ` : ''}
          </div>
        </div>

        <!-- Custom Schedule Editor for ELA & Arranged Courses -->
        ${canCustomSchedule ? this.renderCustomScheduleEditorHtml(course) : ''}

        <!-- Full Height Embedded Syllabus -->
        <div class="syllabus-iframe-container">
          ${course.url ? `
            <iframe 
              src="${course.url}" 
              title="Official Syllabus" 
              class="syllabus-full-iframe"
              loading="lazy">
            </iframe>
          ` : `
            <div class="no-url-msg">${isJa ? 'シラバスURLが登録されていません。' : 'No syllabus link available.'}</div>
          `}
        </div>
      </div>
    `;

    // Button event
    this.container.querySelector('#btnDetailsToggleEnroll').addEventListener('click', () => {
      if (store.isEnrolled(course.id, course.term)) {
        store.removeCourse(course.id, course.term);
      } else {
        store.addCourse(course);
      }
    });

    if (canCustomSchedule) {
      this.attachCustomScheduleEditorListeners(course);
    }
  }

  renderCustomScheduleEditorHtml(course) {
    const isJa = store.uiLang !== 'en';
    const isCustomized = Boolean(course.isCustomSchedule);
    const isEla = store.isElaCourse(course);
    const currentScheduleStr = course.scheduleRaw || '';
    
    // Extract set of tokens currently active
    const parsed = parseScheduleString(currentScheduleStr);
    const activeTokens = new Set(parsed.slots.map(s => `${s.isSuper ? '*' : ''}${s.period}/${s.day}`));
    // Also include basic form without * for matrix cell matching
    const baseTokens = new Set(parsed.slots.map(s => `${s.period}/${s.day}`));

    const days = [
      { code: 'M', ja: '月', en: 'Mon' },
      { code: 'TU', ja: '火', en: 'Tue' },
      { code: 'W', ja: '水', en: 'Wed' },
      { code: 'TH', ja: '木', en: 'Thu' },
      { code: 'F', ja: '金', en: 'Fri' },
      { code: 'SA', ja: '土', en: 'Sat' },
    ];

    const titleText = isEla
      ? (isJa ? 'ELAスケジュール設定 (特例)' : 'Custom ELA Schedule (Special)')
      : (isJa ? '時間割カスタム配置 (時間未定科目)' : 'Custom Schedule Placement (Arranged)');

    const guideText = isEla
      ? (isJa 
          ? 'ELAは所属ストリーム・セクションごとに時間が異なるため、受講するコマを選択・変更できます。' 
          : 'ELA course times depend on your stream and section. Select your assigned periods to place on your schedule.')
      : (isJa
          ? '時間未定（論文・JLP・実習等）科目のため、受講するコマを直接カレンダーに配置できます。'
          : 'This course has arranged hours (Thesis, JLP, Tutorial, etc.). Select periods to place it on your schedule.');

    return `
      <div class="ela-schedule-card ${this.isElaEditorCollapsed ? 'collapsed' : ''}" id="elaScheduleCard">
        <div class="ela-schedule-header" id="elaToggleCollapse">
          <div class="ela-header-left">
            ${iconCalendar('heroicon-xs')}
            <span class="ela-title">${titleText}</span>
            <span class="ela-status-badge ${isCustomized ? 'customized' : 'default'}">
              ${isCustomized ? (isJa ? '設定済み' : 'Customized') : (isJa ? 'シラバス初期値' : 'Syllabus Default')}
            </span>
          </div>
          <button type="button" class="ela-collapse-btn" aria-label="Toggle editor">
            ${iconChevronDown('heroicon-xs')}
          </button>
        </div>

        <div class="ela-schedule-body">
          <div class="ela-guide-text">${guideText}</div>

          <div class="ela-matrix-container">
            <table class="ela-matrix-table">
              <thead>
                <tr>
                  <th class="period-label"></th>
                  ${days.map(d => `<th>${isJa ? d.ja : d.en}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${[1, 2, 3, 4, 5, 6, 7].map(period => `
                  <tr>
                    <td class="period-label">${period}</td>
                    ${days.map(d => {
                      const token = `${period}/${d.code}`;
                      const isSelected = baseTokens.has(token);
                      return `
                        <td>
                          <button type="button" 
                                  class="ela-slot-cell ${isSelected ? 'active' : ''}" 
                                  data-token="${token}"
                                  title="${period}/${d.code}">
                            ${period}/${d.code}
                          </button>
                        </td>
                      `;
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="ela-actions-row">
            <div class="ela-input-group">
              <label for="elaScheduleInput">${isJa ? 'コマ指定' : 'Slots'}:</label>
              <input type="text" id="elaScheduleInput" value="${currentScheduleStr}" placeholder="e.g. 2/TU,3/TU,2/TH,3/TH" />
            </div>

            <div class="ela-btn-group">
              <button type="button" class="m3-button filled" id="btnSaveElaSchedule">
                ${iconCheck('heroicon-xs')}
                <span>${isJa ? '反映' : 'Apply'}</span>
              </button>
              ${isCustomized ? `
                <button type="button" class="m3-button tonal" id="btnResetElaSchedule" title="${isJa ? '初期値に戻す' : 'Reset to default'}">
                  ${iconTrash('heroicon-xs')}
                  <span>${isJa ? '初期化' : 'Reset'}</span>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  attachCustomScheduleEditorListeners(course) {
    const card = this.container.querySelector('#elaScheduleCard');
    if (!card) return;

    // Accordion toggle
    const toggleBtn = card.querySelector('#elaToggleCollapse');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.isElaEditorCollapsed = !this.isElaEditorCollapsed;
        card.classList.toggle('collapsed', this.isElaEditorCollapsed);
      });
    }

    const input = card.querySelector('#elaScheduleInput');
    const slotButtons = card.querySelectorAll('.ela-slot-cell');

    const getTokensFromInput = () => {
      const parsed = parseScheduleString(input.value);
      return new Set(parsed.slots.map(s => `${s.period}/${s.day}`));
    };

    const updateMatrixFromInput = () => {
      const tokens = getTokensFromInput();
      slotButtons.forEach(btn => {
        const token = btn.dataset.token;
        btn.classList.toggle('active', tokens.has(token));
      });
    };

    // Slot matrix cell click
    slotButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const clickedToken = btn.dataset.token;
        const tokens = getTokensFromInput();

        if (tokens.has(clickedToken)) {
          tokens.delete(clickedToken);
          btn.classList.remove('active');
        } else {
          tokens.add(clickedToken);
          btn.classList.add('active');
        }

        input.value = Array.from(tokens).join(',');
      });
    });

    // Input typing syncs matrix
    if (input) {
      input.addEventListener('input', () => {
        updateMatrixFromInput();
      });
    }

    // Save button
    const btnSave = card.querySelector('#btnSaveElaSchedule');
    if (btnSave) {
      btnSave.addEventListener('click', (e) => {
        e.stopPropagation();
        const newSchedule = (input.value || '').trim();
        store.setCourseCustomSchedule(course.id, newSchedule);
      });
    }

    // Reset button
    const btnReset = card.querySelector('#btnResetElaSchedule');
    if (btnReset) {
      btnReset.addEventListener('click', (e) => {
        e.stopPropagation();
        const isJa = store.uiLang !== 'en';
        if (confirm(isJa ? 'この科目のスケジュールを初期値に戻しますか？' : 'Reset schedule for this course to default?')) {
          store.resetCourseCustomSchedule(course.id);
        }
      });
    }
  }
}

