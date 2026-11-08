/**
 * Right Pane: Minimal AI Advisor UI Controller
 * Orchestrates settings panel, chat history, topic chips, and course recommendations.
 * Delegates search, streaming, and offline fallback to ai-engine.js and ai-prompts.js.
 */

import { store } from './store.js';
import { PROVIDER_PRESETS } from './config.js';
import { getCoursePalette } from './major-palette.js';
import { semanticSearch } from './semantic-search.js';
import { iconSparkles, iconCog, iconTrash, iconPaperAirplane, iconUser, iconPlus, iconCheck } from './icons.js';
import {
  cleanThinkTags,
  isGeminiConfig,
  searchCatalogByInterest,
  generateOfflineResponse,
  queryLlmStream,
} from './ai-engine.js';

export class AiAssistantController {
  constructor(containerEl) {
    this.container = containerEl;
    this.messages = [];
    this.isSettingsOpen = false;
    this.serverStatus = 'offline';
    this.statusLabel = 'Advisor';
    this.isGenerating = false;

    this.init();
  }

  isGemini() {
    return isGeminiConfig(store.llamaConfig);
  }

  init() {
    this.renderSkeleton();
    this.attachEventListeners();
    this.checkServerConnection(false);

    store.subscribe((event) => {
      if (['termChange', 'courseAdded', 'courseRemoved'].includes(event)) {
        this.renderMessages();
      }
      if (event === 'langChange') {
        this.updateBilingualLabels();
        this.updatePresetUI(store.llamaConfig.PROVIDER || 'gemini', false);
      }
    });

    if (this.messages.length === 0) {
      this.pushWelcomeMessage();
    }
  }

  renderSkeleton() {
    const isEn = store.uiLang === 'en';
    const curProvider = store.llamaConfig.PROVIDER || 'gemini';

    this.container.innerHTML = `
      <div class="ai-assistant-wrapper">
        <!-- Minimal Zen Header -->
        <div class="ai-header">
          <div class="ai-header-left">
            <span class="ai-avatar">${iconSparkles('heroicon')}</span>
            <span class="ai-title" id="aiAssistantTitle">${isEn ? 'Schedule Advisor' : '履修アドバイザー'}</span>
            <span class="ai-status-badge ${this.serverStatus}" id="aiStatusBadge">
              <span class="status-dot"></span>
              <span id="aiStatusText">${isEn ? 'Advisor' : 'アドバイザー'}</span>
            </span>
          </div>

          <div class="ai-header-actions">
            <button class="ui-icon-btn sm" id="btnClearChat" title="${isEn ? 'Clear Chat History' : '会話履歴を消去'}" aria-label="Clear chat">
              <span class="ui-icon-glyph">${iconTrash('heroicon-sm')}</span>
            </button>
            <button class="ui-icon-btn sm" id="btnAiSettings" title="${isEn ? 'LLM / API Provider Settings' : 'LLM / APIプロバイダー設定'}" aria-label="Settings">
              <span class="ui-icon-glyph">${iconCog('heroicon-sm')}</span>
            </button>
          </div>
        </div>

        <!-- Provider & Connection Settings Panel (Drawer) -->
        <div class="ai-settings-panel" id="aiSettingsPanel" style="display: none;">
          <!-- Segmented Provider Selection -->
          <div class="ui-segmented" id="settingPresetSegmented">
            <button type="button" class="ui-segment-btn ${curProvider === 'gemini' ? 'active' : ''}" data-preset="gemini">
              <span>✦ Gemini</span>
            </button>
            <button type="button" class="ui-segment-btn ${curProvider === 'llama_cpp' ? 'active' : ''}" data-preset="llama_cpp">
              <span>llama.cpp</span>
            </button>
            <button type="button" class="ui-segment-btn ${curProvider === 'ollama' ? 'active' : ''}" data-preset="ollama">
              <span>Ollama</span>
            </button>
            <button type="button" class="ui-segment-btn ${curProvider === 'custom' ? 'active' : ''}" data-preset="custom">
              <span>Custom</span>
            </button>
          </div>
          <input type="hidden" id="settingPreset" value="${curProvider}">

          <!-- API Key (Visible for Gemini / Custom) -->
          <div class="ui-field" id="settingApiKeyItem">
            <label class="ui-field-label" id="settingApiKeyLabel">API Key</label>
            <input type="password" id="settingApiKey" class="ui-input" value="${store.llamaConfig.API_KEY || ''}" placeholder="${isEn ? 'AI Studio Key (AIzaSy...)' : 'Google AI Studio APIキー (AIzaSy...)'}">
          </div>

          <!-- Model & Embedding (2-column compact layout) -->
          <div class="settings-two-col">
            <div class="ui-field">
              <label class="ui-field-label" id="settingModelLabel">${isEn ? 'Chat Model' : '会話モデル'}</label>
              <input type="text" id="settingModel" class="ui-input" list="modelSuggestions" value="${store.llamaConfig.MODEL}" placeholder="gemini-3.5-flash-lite">
              <datalist id="modelSuggestions"></datalist>
            </div>

            <div class="ui-field">
              <label class="ui-field-label" id="settingEmbedModelLabel">${isEn ? 'Embedding' : '埋め込み'}</label>
              <input type="text" id="settingEmbedModel" class="ui-input" list="embedModelSuggestions" value="${store.llamaConfig.EMBED_MODEL}" placeholder="gemini-embedding-001">
              <datalist id="embedModelSuggestions"></datalist>
            </div>
          </div>

          <!-- Endpoint URL -->
          <div class="ui-field" id="settingEndpointItem">
            <label class="ui-field-label" id="settingEndpointLabel">Endpoint</label>
            <input type="text" id="settingEndpoint" class="ui-input" value="${store.llamaConfig.ENDPOINT}">
          </div>

          <!-- Fast / No-Think Switch -->
          <label class="ui-switch-row" id="settingNoThinkItem">
            <span class="label-text" id="settingNoThinkSpan">${isEn ? 'Fast Mode (No reasoning thoughts)' : 'Fast Mode (推論思考を省略)'}</span>
            <input type="checkbox" id="settingNoThink" style="display:none;" ${store.llamaConfig.NO_THINK ? 'checked' : ''}>
            <span class="ui-switch-track"><span class="ui-switch-thumb"></span></span>
          </label>

          <!-- Settings Actions -->
          <div class="settings-actions">
            <button type="button" class="m3-button tonal" id="btnTestConn">${isEn ? 'Test Connection' : '接続テスト'}</button>
            <button type="button" class="m3-button filled" id="btnSaveSettings">${isEn ? 'Save' : '保存'}</button>
          </div>
        </div>

        <!-- Chat History -->
        <div class="ai-chat-history" id="aiChatHistory"></div>

        <!-- Quick Topic Chips - 1-Line Zen Horizontal Pill Bar -->
        <div class="ai-quick-prompts" id="aiQuickPrompts">
          ${isEn ? `
            <button class="quick-chip" data-query="Recommend international relations and politics courses">Int'l Relations</button>
            <button class="quick-chip" data-query="Recommend information science and mathematics courses">Info Science</button>
            <button class="quick-chip" data-query="Recommend biology and environmental studies courses">Environmental</button>
            <button class="quick-chip" data-query="Recommend 3-credit English courses in arts and literature">Arts & Literature</button>
            <button class="quick-chip" data-query="Suggest a 1/3 credit PE activity course">1/3 PE Course</button>
            <button class="quick-chip" data-query="Check my current timetable for conflicts and credit limit">Check Schedule</button>
          ` : `
            <button class="quick-chip" data-query="国際関係学や政治学の科目を教えて">国際関係・政治</button>
            <button class="quick-chip" data-query="情報科学や数学のおすすめ科目は？">情報科学・数学</button>
            <button class="quick-chip" data-query="生物学や環境研究の科目を推薦して">生物・環境</button>
            <button class="quick-chip" data-query="文学や芸術の3単位英語開講科目を教えて">文学・芸術 (E開講)</button>
            <button class="quick-chip" data-query="1/3単位の保健体育実技科目のおすすめは？">1/3 保健体育実技</button>
            <button class="quick-chip" data-query="現在の履修計画に時間重複や単位上限超過がないか確認して">時間割・単位チェック</button>
          `}
        </div>

        <!-- Input Bar -->
        <form class="ai-input-form" id="aiInputForm">
          <input type="text" id="aiUserInput" placeholder="${isEn ? 'Ask for course recommendations or advice...' : '科目のおすすめや履修相談を入力...'}" autocomplete="off">
          <button type="submit" class="m3-button filled" id="btnSendPrompt">
            ${iconPaperAirplane('heroicon-xs')}
            <span id="btnSendPromptText">${isEn ? 'Send' : '送信'}</span>
          </button>
        </form>
      </div>
    `;
  }

  updatePresetUI(presetKey, applyDefaults = false) {
    const isEn = store.uiLang === 'en';
    const preset = PROVIDER_PRESETS[presetKey] || PROVIDER_PRESETS.custom;
    const inputEndpoint = this.container.querySelector('#settingEndpoint');
    const inputModel = this.container.querySelector('#settingModel');
    const inputEmbedModel = this.container.querySelector('#settingEmbedModel');
    const checkNoThink = this.container.querySelector('#settingNoThink');
    const apiKeyItem = this.container.querySelector('#settingApiKeyItem');
    const inputApiKey = this.container.querySelector('#settingApiKey');
    const noThinkItem = this.container.querySelector('#settingNoThinkItem');
    const modelDatalist = this.container.querySelector('#modelSuggestions');
    const embedDatalist = this.container.querySelector('#embedModelSuggestions');
    const presetInput = this.container.querySelector('#settingPreset');
    const segmentedBtns = this.container.querySelectorAll('#settingPresetSegmented .ui-segment-btn');

    if (presetInput) presetInput.value = presetKey;
    segmentedBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === presetKey);
    });

    if (!inputEndpoint || !inputModel) return;

    if (applyDefaults) {
      inputEndpoint.value = preset.endpoint;
      inputModel.value = preset.model;
      inputEmbedModel.value = preset.embedModel;
      checkNoThink.checked = preset.noThink;
    }

    apiKeyItem.style.display = preset.requiresKey || presetKey === 'custom' || presetKey === 'gemini' ? 'flex' : (inputApiKey.value ? 'flex' : 'none');
    noThinkItem.style.display = presetKey === 'gemini' ? 'none' : 'flex';

    if (preset.models && preset.models.length > 0) {
      modelDatalist.innerHTML = preset.models.map(m => `<option value="${m.id}">${isEn ? (m.nameEn || m.name) : m.name}</option>`).join('');
    } else {
      modelDatalist.innerHTML = '';
    }
    if (preset.embedModels && preset.embedModels.length > 0) {
      embedDatalist.innerHTML = preset.embedModels.map(m => `<option value="${m.id}">${isEn ? (m.nameEn || m.name) : m.name}</option>`).join('');
    } else {
      embedDatalist.innerHTML = '';
    }
  }

  updateBilingualLabels() {
    const isEn = store.uiLang === 'en';

    const titleEl = this.container.querySelector('#aiAssistantTitle');
    if (titleEl) titleEl.textContent = isEn ? 'Schedule Advisor' : '履修アドバイザー';

    const statusBadge = this.container.querySelector('#aiStatusBadge');
    const statusText = this.container.querySelector('#aiStatusText');
    if (statusBadge && statusText && this.serverStatus === 'offline') {
      this.statusLabel = isEn ? 'Smart Advisor' : 'スマートアドバイザー';
      statusText.textContent = this.statusLabel;
    }

    const btnClearChat = this.container.querySelector('#btnClearChat');
    if (btnClearChat) btnClearChat.title = isEn ? 'Clear Chat History' : '会話履歴を消去';

    const btnAiSettings = this.container.querySelector('#btnAiSettings');
    if (btnAiSettings) btnAiSettings.title = isEn ? 'LLM / API Provider Settings' : 'LLM / APIプロバイダー設定';

    const inputApiKey = this.container.querySelector('#settingApiKey');
    if (inputApiKey) inputApiKey.placeholder = isEn ? 'AI Studio Key (AIzaSy...)' : 'Google AI Studio APIキー (AIzaSy...)';

    const settingModelLabel = this.container.querySelector('#settingModelLabel');
    if (settingModelLabel) settingModelLabel.textContent = isEn ? 'Chat Model' : '会話モデル';

    const settingEmbedModelLabel = this.container.querySelector('#settingEmbedModelLabel');
    if (settingEmbedModelLabel) settingEmbedModelLabel.textContent = isEn ? 'Embedding' : '埋め込み';

    const settingNoThinkSpan = this.container.querySelector('#settingNoThinkSpan');
    if (settingNoThinkSpan) settingNoThinkSpan.textContent = isEn ? 'Fast Mode (No reasoning thoughts)' : 'Fast Mode (推論思考を省略)';

    const btnTestConn = this.container.querySelector('#btnTestConn');
    if (btnTestConn) btnTestConn.textContent = isEn ? 'Test Connection' : '接続テスト';

    const btnSaveSettings = this.container.querySelector('#btnSaveSettings');
    if (btnSaveSettings) btnSaveSettings.textContent = isEn ? 'Save' : '保存';

    const userInput = this.container.querySelector('#aiUserInput');
    if (userInput) userInput.placeholder = isEn ? 'Ask for course recommendations or advice...' : '科目のおすすめや履修相談を入力...';

    const btnSendPromptText = this.container.querySelector('#btnSendPromptText');
    if (btnSendPromptText) btnSendPromptText.textContent = isEn ? 'Send' : '送信';

    const quickPrompts = this.container.querySelector('#aiQuickPrompts');
    if (quickPrompts) {
      quickPrompts.innerHTML = isEn ? `
        <button class="quick-chip" data-query="Recommend international relations and politics courses">Int'l Relations</button>
        <button class="quick-chip" data-query="Recommend information science and mathematics courses">Info Science</button>
        <button class="quick-chip" data-query="Recommend biology and environmental studies courses">Environmental</button>
        <button class="quick-chip" data-query="Recommend 3-credit English courses in arts and literature">Arts & Literature</button>
        <button class="quick-chip" data-query="Suggest a 1/3 credit PE activity course">1/3 PE Course</button>
        <button class="quick-chip" data-query="Check my current timetable for conflicts and credit limit">Check Schedule</button>
      ` : `
        <button class="quick-chip" data-query="国際関係学や政治学の科目を教えて">国際関係・政治</button>
        <button class="quick-chip" data-query="情報科学や数学のおすすめ科目は？">情報科学・数学</button>
        <button class="quick-chip" data-query="生物学や環境研究の科目を推薦して">生物・環境</button>
        <button class="quick-chip" data-query="文学や芸術の3単位英語開講科目を教えて">文学・芸術 (E開講)</button>
        <button class="quick-chip" data-query="1/3単位の保健体育実技科目のおすすめは？">1/3 保健体育実技</button>
        <button class="quick-chip" data-query="現在の履修計画に時間重複や単位上限超過がないか確認して">時間割・単位チェック</button>
      `;
    }

    this.renderMessages();
  }

  attachEventListeners() {
    const form = this.container.querySelector('#aiInputForm');
    const input = this.container.querySelector('#aiUserInput');
    const btnSettings = this.container.querySelector('#btnAiSettings');
    const settingsPanel = this.container.querySelector('#aiSettingsPanel');
    const btnSaveSettings = this.container.querySelector('#btnSaveSettings');
    const btnTestConn = this.container.querySelector('#btnTestConn');
    const btnClearChat = this.container.querySelector('#btnClearChat');
    const quickPrompts = this.container.querySelector('#aiQuickPrompts');

    const presetSegmented = this.container.querySelector('#settingPresetSegmented');
    const presetInput = this.container.querySelector('#settingPreset');
    const inputApiKey = this.container.querySelector('#settingApiKey');
    const inputEndpoint = this.container.querySelector('#settingEndpoint');
    const inputModel = this.container.querySelector('#settingModel');
    const inputEmbedModel = this.container.querySelector('#settingEmbedModel');
    const checkNoThink = this.container.querySelector('#settingNoThink');

    if (presetSegmented) {
      presetSegmented.addEventListener('click', (e) => {
        const btn = e.target.closest('.ui-segment-btn');
        if (btn && btn.dataset.preset) {
          this.updatePresetUI(btn.dataset.preset, true);
        }
      });
    }

    btnSettings.addEventListener('click', () => {
      this.isSettingsOpen = !this.isSettingsOpen;
      settingsPanel.style.display = this.isSettingsOpen ? 'flex' : 'none';
      if (this.isSettingsOpen) {
        this.updatePresetUI(presetInput.value || store.llamaConfig.PROVIDER || 'gemini', false);
      }
    });

    btnTestConn.addEventListener('click', () => {
      this.checkServerConnection(true);
    });

    btnSaveSettings.addEventListener('click', () => {
      const isEn = store.uiLang === 'en';
      const provider = presetInput.value || 'gemini';
      const newConfig = {
        PROVIDER: provider,
        API_KEY: (inputApiKey.value || '').trim(),
        ENDPOINT: (inputEndpoint.value || '').trim(),
        MODEL: (inputModel.value || '').trim(),
        EMBED_MODEL: (inputEmbedModel.value || '').trim(),
        NO_THINK: checkNoThink.checked,
      };
      store.saveLlamaConfig(newConfig);
      this.isSettingsOpen = false;
      settingsPanel.style.display = 'none';
      this.checkServerConnection(true);
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text || this.isGenerating) return;
      input.value = '';
      this.handleUserPrompt(text);
    });

    btnClearChat.addEventListener('click', () => {
      const isEn = store.uiLang === 'en';
      if (!confirm(isEn ? 'Clear all conversation history?' : '会話履歴をすべて消去しますか？')) return;
      this.messages = [];
      this.pushWelcomeMessage();
    });

    quickPrompts.addEventListener('click', (e) => {
      const chip = e.target.closest('.quick-chip');
      if (chip && chip.dataset.query) {
        this.handleUserPrompt(chip.dataset.query);
      }
    });

    // Chat card buttons delegation
    this.container.querySelector('#aiChatHistory').addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-add-from-chat');
      if (btn && btn.dataset.courseId) {
        const course = store.allCourses.find(c => c.id === btn.dataset.courseId);
        if (course) {
          store.addCourse(course);
          const isEn = store.uiLang === 'en';
          btn.innerHTML = `${iconCheck('heroicon-xs')} ${isEn ? 'Added' : '追加済'}`;
          btn.classList.add('added');
          btn.disabled = true;
        }
      }

      const viewBtn = e.target.closest('.btn-view-from-chat');
      if (viewBtn && viewBtn.dataset.courseId) {
        const course = store.allCourses.find(c => c.id === viewBtn.dataset.courseId);
        if (course) {
          store.selectCourse(course);
          store.setActiveRightTab('details');
        }
      }
    });
  }

  async checkServerConnection(alertResult = false) {
    const isEn = store.uiLang === 'en';
    const statusText = this.container.querySelector('#aiStatusText');
    const statusBadge = this.container.querySelector('#aiStatusBadge');
    const endpoint = (store.llamaConfig.ENDPOINT || '').trim();
    const isNoThink = store.llamaConfig.NO_THINK !== false;

    // 1. Google Gemini API
    if (this.isGemini()) {
      const apiKey = (store.llamaConfig.API_KEY || '').trim();
      if (!apiKey) {
        this.serverStatus = 'offline';
        this.statusLabel = isEn ? 'Smart Advisor' : 'スマートアドバイザー';
        statusText.textContent = this.statusLabel;
        statusBadge.className = 'ai-status-badge offline';
        if (alertResult) {
          alert(isEn
            ? '[Google Gemini API]\nPlease open settings (⚙️ icon) and enter your Google AI Studio API key.\n(Works directly from Cloudflare Pages via secure HTTPS)'
            : '【Google Gemini API】\n設定画面（⚙️アイコン）を開き、Google AI StudioのAPIキーを入力して保存してください。\n（HTTPS環境のためCloudflare Pagesからも直接安全に通信できます）');
        }
        return;
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/models', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          const models = (data.data || []).map(m => m.id).filter(Boolean);
          const datalist = this.container.querySelector('#modelSuggestions');
          if (datalist && models.length > 0) {
            datalist.innerHTML = models.map(name => `<option value="${name}">${name}</option>`).join('');
          }

          this.serverStatus = 'connected';
          const modelName = store.llamaConfig.MODEL || 'gemini-3.5-flash-lite';
          const shortModel = modelName.replace(/^gemini-/, '');
          this.statusLabel = `Gemini (${shortModel})`;
          statusText.textContent = this.statusLabel;
          statusBadge.className = 'ai-status-badge connected';
          if (alertResult) {
            alert(isEn
              ? `Connected to Google Gemini API!\nChat Model: ${modelName}\nEmbedding: ${store.llamaConfig.EMBED_MODEL}`
              : `Google Gemini API に接続成功しました！\n会話モデル: ${modelName}\n埋め込み: ${store.llamaConfig.EMBED_MODEL}`);
          }
          this.warmUpSemanticIndex();
          return;
        } else {
          const errText = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }
      } catch (err) {
        this.serverStatus = 'offline';
        this.statusLabel = isEn ? 'Smart Advisor' : 'スマートアドバイザー';
        statusText.textContent = this.statusLabel;
        statusBadge.className = 'ai-status-badge offline';
        if (alertResult) {
          alert(isEn
            ? `[Gemini API Connection Error]\nPlease check your API key or network connection.\n${err.message}`
            : `【Gemini API 接続エラー】\nAPIキーまたは通信状態をご確認ください。\n${err.message}`);
        }
        return;
      }
    }

    // 2. Local llama.cpp / Ollama
    try {
      const base = endpoint.replace(/\/(v1\/chat\/completions|api\/chat)\/?$/, '').replace(/\/$/, '');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      let isOllama = false;
      const tagsRes = await fetch(`${base}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      }).catch(() => null);

      let res = tagsRes;
      if (tagsRes && tagsRes.ok) {
        isOllama = true;
        try {
          const tagsData = await tagsRes.clone().json();
          const modelNames = (tagsData.models || []).map(m => m.name).filter(Boolean);
          const datalist = this.container.querySelector('#modelSuggestions');
          if (datalist && modelNames.length > 0) {
            datalist.innerHTML = modelNames.map(name => `<option value="${name}"></option>`).join('');
          }
        } catch {}
      } else {
        res = await fetch(`${base}/v1/models`, {
          method: 'GET',
          signal: controller.signal,
        }).catch(() => null);
        if (res && res.ok) {
          try {
            const modelsData = await res.clone().json();
            const modelNames = (modelsData.data || []).map(m => m.id).filter(Boolean);
            const datalist = this.container.querySelector('#modelSuggestions');
            if (datalist && modelNames.length > 0) {
              datalist.innerHTML = modelNames.map(name => `<option value="${name}"></option>`).join('');
            }
          } catch {}
        }
      }

      clearTimeout(timeout);

      if (res && (res.ok || res.status === 404 || res.status === 405)) {
        this.serverStatus = 'connected';
        if (!isOllama && (endpoint.includes('11434') || endpoint.toLowerCase().includes('ollama'))) {
          isOllama = true;
        }
        const label = isOllama ? 'Ollama' : 'LLM Server';
        this.statusLabel = isNoThink ? `${label} (No-Think)` : label;
        statusText.textContent = this.statusLabel;
        statusBadge.className = 'ai-status-badge connected';
        if (alertResult) {
          alert(isEn
            ? `Connected to ${label}!\nChat Model: ${store.llamaConfig.MODEL}\nEmbedding: ${store.llamaConfig.EMBED_MODEL}`
            : `${label} に接続成功しました！\n会話モデル: ${store.llamaConfig.MODEL}\n埋め込み: ${store.llamaConfig.EMBED_MODEL}`);
        }
        this.warmUpSemanticIndex();
      } else {
        throw new Error('Server unreachable');
      }
    } catch {
      this.serverStatus = 'offline';
      this.statusLabel = isEn ? 'Smart Advisor' : 'スマートアドバイザー';
      statusText.textContent = this.statusLabel;
      statusBadge.className = 'ai-status-badge offline';
      if (alertResult) {
        const isMixedContent = window.location.protocol === 'https:' && endpoint.startsWith('http:');
        if (isMixedContent) {
          alert(isEn
            ? '[Connection Error: Mixed Content Restriction]\nRequests from Cloudflare Pages (HTTPS) to your LAN server (' + endpoint + ') are blocked by browser security.\nSelect "✦ Gemini" in settings for direct cloud connectivity.'
            : '【接続エラー: Mixed Content 制限】\nCloudflare Pages (HTTPS) からローカルサーバー (' + endpoint + ') への通信が遮断されました。\n設定画面で「✦ Gemini」を選択してAPIキーを入力すると直通します。');
        } else {
          alert(isEn
            ? 'LLM server not detected. Using built-in smart advisor.'
            : 'LLMサーバーが検出されませんでした。内蔵スマートアドバイザーを使用します。');
        }
      }
    }
  }

  async warmUpSemanticIndex() {
    if (this.serverStatus !== 'connected' || semanticSearch.isIndexing) return;
    const statusText = this.container.querySelector('#aiStatusText');
    const allCourses = store.allCourses;
    if (!allCourses || allCourses.length === 0) return;

    try {
      await semanticSearch.ensureCourseEmbeddings(allCourses, ({ completed, total, done }) => {
        if (!statusText) return;
        if (done) {
          statusText.textContent = this.statusLabel;
        } else {
          const isEn = store.uiLang === 'en';
          const pct = Math.round((completed / Math.max(1, total)) * 100);
          statusText.textContent = isEn ? `Indexing (${pct}%)` : `インデックス作成中 (${pct}%)`;
        }
      });
    } catch {
      if (statusText) statusText.textContent = this.statusLabel;
    }
  }

  pushWelcomeMessage() {
    const isEn = store.uiLang === 'en';
    this.messages.push({
      role: 'assistant',
      content: isEn
        ? "Hi! Ask me for course recommendations or timetable advice within ICU's 17.33 cr limit."
        : 'ICUの学則上限（17.33単位）に合わせて、関心のある分野の推薦や時間割チェックを行います。',
    });
    this.renderMessages();
  }

  renderMessages() {
    const historyEl = this.container.querySelector('#aiChatHistory');
    historyEl.innerHTML = this.messages.map(m => {
      const isUser = m.role === 'user';
      return `
        <div class="chat-message ${isUser ? 'user' : 'assistant'}">
          <div class="msg-avatar">${isUser ? iconUser('heroicon-sm') : iconSparkles('heroicon-sm')}</div>
          <div class="msg-body">
            <div class="msg-bubble">${this.formatMessageText(m.content)}</div>
            ${m.courses && m.courses.length > 0 ? this.renderRecommendedCourseChips(m.courses) : ''}
          </div>
        </div>
      `;
    }).join('');

    historyEl.scrollTop = historyEl.scrollHeight;
  }

  formatMessageText(text) {
    if (!text) return '';
    let processed = text;
    if (store.llamaConfig.NO_THINK !== false) {
      processed = cleanThinkTags(processed);
    }
    return processed
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  renderRecommendedCourseChips(courses) {
    return `
      <div class="recommended-courses-grid">
        ${courses.map(course => {
          const isEnrolled = store.isEnrolled(course.id, course.term);
          const palette = getCoursePalette(course);
          const isEn = store.uiLang === 'en';
          const title = (isEn ? course.titleEn : course.titleJa) || course.title;
          const termDisplay = isEn ? (course.termEn || course.term) : course.term;
          return `
            <div class="ai-course-card" data-palette="${palette}">
              <div class="ai-card-top">
                <div style="display:flex;align-items:center;gap:6px;">
                  <span class="ai-card-code">${course.code}</span>
                  <span class="term-pill" data-term="${course.term}">${termDisplay}</span>
                </div>
                <span class="ai-card-cr">${course.credits} cr ${course.isPE ? '(1/3 PE)' : ''}</span>
              </div>
              <div class="ai-card-title">${title}</div>
              <div class="ai-card-sched">${course.scheduleRaw || 'Arranged'}</div>
              <div class="ai-card-actions">
                <button class="m3-button tonal btn-view-from-chat" data-course-id="${course.id}">
                  ${isEn ? 'Details' : '詳細'}
                </button>
                <button class="m3-button filled btn-add-from-chat ${isEnrolled ? 'added' : ''}" 
                        data-course-id="${course.id}" 
                        ${isEnrolled ? 'disabled' : ''}>
                  ${isEnrolled ? `${iconCheck('heroicon-xs')} ${isEn ? 'Added' : '追加済'}` : `${iconPlus('heroicon-xs')} ${isEn ? 'Add' : '追加'}`}
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  async handleUserPrompt(userText) {
    this.messages.push({ role: 'user', content: userText });
    this.renderMessages();

    const assistantMsg = { role: 'assistant', content: '', courses: [] };
    this.messages.push(assistantMsg);
    this.isGenerating = true;

    let usedLlm = false;
    if (this.serverStatus === 'connected') {
      try {
        usedLlm = await this.queryLlm(userText, assistantMsg);
      } catch (err) {
        console.warn('LLM stream error, falling back to smart offline advisor:', err);
        usedLlm = false;
      }
    }

    if (!usedLlm) {
      await generateOfflineResponse({
        userText,
        assistantMsg,
        allCourses: store.allCourses,
        enrolledByTerm: store.enrolledByTerm,
        currentTerm: store.currentTerm,
        uiLang: store.uiLang,
      });
    }

    this.isGenerating = false;
    this.renderMessages();
  }

  async queryLlm(userText, assistantMsg) {
    const isEnglishQuery = store.uiLang === 'en' || !/[ぁ-んァ-ヶ一-龠]/.test(userText);

    let candidateCourses = await searchCatalogByInterest(userText, {
      allCourses: store.allCourses,
      enrolledByTerm: store.enrolledByTerm,
      currentTerm: store.currentTerm,
      onlyNonConflicting: true,
    });
    if (candidateCourses.length === 0) {
      candidateCourses = await searchCatalogByInterest(userText, {
        allCourses: store.allCourses,
        enrolledByTerm: store.enrolledByTerm,
        currentTerm: store.currentTerm,
        onlyNonConflicting: false,
      });
    }
    candidateCourses = candidateCourses.slice(0, 10);

    const syllabusMap = await semanticSearch.fetchSyllabusDescriptionsForCourses(candidateCourses);

    return await queryLlmStream({
      config: store.llamaConfig,
      userText,
      assistantMsg,
      candidateCourses,
      syllabusMap,
      activeTerm: store.currentTerm,
      enrolledByTerm: store.enrolledByTerm,
      isEnglishQuery,
      onDelta: () => this.renderMessages(),
    });
  }
}
