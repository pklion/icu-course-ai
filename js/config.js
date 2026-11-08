/**
 * Configuration and Period Definitions
 * Timetable coordinate bounds and credit rules.
 */

export const CREDIT_LIMITS = {
  MAX_ACADEMIC: 17.0,
  MAX_PE: 0.334, // 1/3 credit for HPE activity courses (HPE005-HPE025)
  MAX_TOTAL: 17.334,
};

// Saturday is always shown
export const DAYS = [
  { code: 'M', name: 'Monday', nameJa: '月', short: 'Mon' },
  { code: 'TU', name: 'Tuesday', nameJa: '火', short: 'Tue' },
  { code: 'W', name: 'Wednesday', nameJa: '水', short: 'Wed' },
  { code: 'TH', name: 'Thursday', nameJa: '木', short: 'Thu' },
  { code: 'F', name: 'Friday', nameJa: '金', short: 'Fri' },
  { code: 'SA', name: 'Saturday', nameJa: '土', short: 'Sat' },
];

export const PERIODS = [
  {
    period: 1,
    name: '1st Period',
    normal: { start: '08:45', end: '10:00', startMin: 525, endMin: 600 },
    hasSuper: false,
  },
  {
    period: 2,
    name: '2nd Period',
    normal: { start: '10:10', end: '11:25', startMin: 610, endMin: 685 },
    hasSuper: false,
  },
  {
    period: 3,
    name: '3rd Period',
    normal: { start: '11:35', end: '12:50', startMin: 695, endMin: 770 },
    hasSuper: false,
  },
  {
    period: 'lunch',
    name: 'Lunch Break',
    normal: { start: '12:50', end: '14:00', startMin: 770, endMin: 840 },
    super: { start: '12:50', end: '13:20', startMin: 770, endMin: 800 },
    hasSuper: true,
  },
  {
    period: 4,
    name: '4th Period',
    normal: { start: '14:00', end: '15:15', startMin: 840, endMin: 915 },
    super: { start: '13:20', end: '15:15', startMin: 800, endMin: 915 },
    hasSuper: true,
  },
  {
    period: 5,
    name: '5th Period',
    normal: { start: '15:25', end: '16:40', startMin: 925, endMin: 1000 },
    super: { start: '15:25', end: '17:20', startMin: 925, endMin: 1040 },
    hasSuper: true,
  },
  {
    period: 6,
    name: '6th Period',
    normal: { start: '16:50', end: '18:05', startMin: 1010, endMin: 1085 },
    hasSuper: false,
  },
  {
    period: 7,
    name: '7th Period',
    normal: { start: '18:15', end: '19:30', startMin: 1095, endMin: 1170 },
    super: { start: '18:15', end: '20:10', startMin: 1095, endMin: 1210 },
    hasSuper: true,
  },
];

export const PROVIDER_PRESETS = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini API (Cloud / Recommended)',
    nameJa: 'Google Gemini API (クラウド / Flash-Lite推奨)',
    nameEn: 'Google Gemini API (Cloud / Flash-Lite Recommended)',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-3.5-flash-lite',
    embedModel: 'gemini-embedding-001',
    models: [
      { id: 'gemini-3.5-flash-lite', name: 'gemini-3.5-flash-lite (最新・推奨・最安クラス高速)', nameEn: 'gemini-3.5-flash-lite (Latest, Recommended, Ultra-fast)' },
      { id: 'gemini-2.5-flash-lite', name: 'gemini-2.5-flash-lite (最安値モデル)', nameEn: 'gemini-2.5-flash-lite (Lowest Cost)' },
      { id: 'gemini-3.8-flash', name: 'gemini-3.8-flash (高性能バランス)', nameEn: 'gemini-3.8-flash (High Performance Balanced)' },
    ],
    embedModels: [
      { id: 'gemini-embedding-001', name: 'gemini-embedding-001 (Google公式埋め込み)', nameEn: 'gemini-embedding-001 (Google Official Embedding)' },
    ],
    requiresKey: true,
    noThink: false,
    tip: 'Google AI StudioのAPIキーを入力するだけで利用できます。HTTPS対応のためCloudflare Pagesからも直接安全に通信可能です。',
    tipEn: 'Enter your Google AI Studio API key. Secure and fully HTTPS-ready directly from Cloudflare Pages.',
  },
  llama_cpp: {
    id: 'llama_cpp',
    name: 'llama.cpp (Local / Port 9931)',
    nameJa: 'llama.cpp (ローカル / Port 9931)',
    nameEn: 'llama.cpp (Local / Port 9931)',
    endpoint: 'http://127.0.0.1:9931/v1/chat/completions',
    model: 'ggml-org/gemma-3-1b-it-qat-GGUF:Q4_0',
    embedModel: 'gpustack/bge-m3-GGUF:Q4_K_M',
    models: [
      { id: 'ggml-org/gemma-3-1b-it-qat-GGUF:Q4_0', name: 'ggml-org/gemma-3-1b-it-qat-GGUF:Q4_0 (Gemma 3)', nameEn: 'ggml-org/gemma-3-1b-it-qat-GGUF:Q4_0 (Gemma 3)' },
      { id: 'ggml-org/gemma-4-E2B-it-GGUF:Q8_0', name: 'ggml-org/gemma-4-E2B-it-GGUF:Q8_0 (Gemma 4)', nameEn: 'ggml-org/gemma-4-E2B-it-GGUF:Q8_0 (Gemma 4)' },
    ],
    embedModels: [
      { id: 'gpustack/bge-m3-GGUF:Q4_K_M', name: 'gpustack/bge-m3-GGUF:Q4_K_M (BGE-M3)', nameEn: 'gpustack/bge-m3-GGUF:Q4_K_M (BGE-M3)' },
    ],
    requiresKey: false,
    noThink: true,
    tip: 'llama-server / llama.exe によるローカルOpenAI互換サーバー。埋め込みには `--embeddings` オプションが必要です。',
    tipEn: 'Local OpenAI-compatible server via llama-server / llama.exe. Embedding requires the `--embeddings` flag.',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local / Port 11434)',
    nameJa: 'Ollama (ローカル / Port 11434)',
    nameEn: 'Ollama (Local / Port 11434)',
    endpoint: 'http://127.0.0.1:11434/api/chat',
    model: 'qwen3.5',
    embedModel: 'nomic-embed-text',
    models: [
      { id: 'qwen3.5', name: 'qwen3.5', nameEn: 'qwen3.5' },
      { id: 'gemma3', name: 'gemma3', nameEn: 'gemma3' },
      { id: 'llama3.3', name: 'llama3.3', nameEn: 'llama3.3' },
    ],
    embedModels: [
      { id: 'nomic-embed-text', name: 'nomic-embed-text', nameEn: 'nomic-embed-text' },
      { id: 'bge-m3', name: 'bge-m3', nameEn: 'bge-m3' },
    ],
    requiresKey: false,
    noThink: true,
    tip: 'OllamaのネイティブAPI。外部サイトから接続する場合は OLLAMA_ORIGINS="*" が必要です。',
    tipEn: 'Native Ollama API. Connecting from external sites requires OLLAMA_ORIGINS="*".',
  },
  custom: {
    id: 'custom',
    name: 'カスタム (OpenAI互換 / Custom)',
    nameJa: 'カスタム設定 (Custom / OpenAI互換)',
    nameEn: 'Custom (OpenAI-compatible)',
    endpoint: 'http://127.0.0.1:8080/v1/chat/completions',
    model: '',
    embedModel: '',
    models: [],
    embedModels: [],
    requiresKey: false,
    noThink: false,
    tip: 'OpenRouterやGroq、任意のOpenAI互換APIエンドポイントを指定できます。',
    tipEn: 'Specify OpenRouter, Groq, or any custom OpenAI-compatible API endpoint.',
  },
};

export const LLAMA_DEFAULTS = {
  PROVIDER: 'gemini',
  API_KEY: '',
  ENDPOINT: PROVIDER_PRESETS.gemini.endpoint,
  MODEL: PROVIDER_PRESETS.gemini.model,
  EMBED_MODEL: PROVIDER_PRESETS.gemini.embedModel,
  TEMPERATURE: 0.7,
  MAX_TOKENS: 1024,
  NO_THINK: false,
};
