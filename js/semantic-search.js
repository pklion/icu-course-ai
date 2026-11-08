/**
 * Ollama Embedding Semantic Search Engine with IndexedDB Vector Caching.
 * Computes and caches vector embeddings via Ollama's /api/embed endpoint
 * and performs cosine similarity ranking for course discovery.
 */

import { store } from './store.js';

const DB_NAME = 'icu_semantic_embeddings_v2';
const STORE_NAME = 'vectors';
const DB_VERSION = 1;

// ICU major & subject category names (clean names without auxiliary keywords)
export const MAJOR_NAMES = {
  AMS: 'アメリカ研究 American Studies',
  ANT: '文化人類学 Cultural Anthropology',
  ARC: '美術・文化財研究 Art and Cultural Heritage',
  AST: 'アジア研究 Asian Studies',
  BIO: '生物学 Biology',
  BUS: '経営学 Business',
  CED: '比較教育 Comparative Education',
  CHM: '化学 Chemistry',
  DPS: '開発研究 Development Studies',
  ECO: '経済学 Economics',
  EDU: '教育学 Education',
  EMS: '教育・メディア・社会 Education, Media and Society',
  ENV: '環境研究 Environmental Studies',
  GLS: 'グローバル研究 Global Studies',
  GSS: 'ジェンダー・セクシュアリティ研究 Gender and Sexuality Studies',
  HST: '歴史学 History',
  IRL: '国際関係学 International Relations',
  ISC: '情報科学 Information Science',
  JPS: '日本研究 Japan Studies',
  LAW: '法学 Law',
  LED: '言語教育 Language Education',
  LIT: '文学 Literature',
  LNG: '言語学 Linguistics',
  MCC: 'メディア・コミュニケーション・文化 Media, Communication and Culture',
  MTH: '数学 Mathematics',
  MUS: '音楽 Music',
  PCS: '平和研究 Peace Studies',
  PHR: '哲学・宗教学 Philosophy and Religion',
  PHY: '物理学 Physics',
  POL: '政治学 Politics',
  PPL: '公共政策 Public Policy',
  PSY: '心理学 Psychology',
  SOC: '社会学 Sociology',
  GEH: '一般教育 人文科学 General Education Humanities',
  GEL: '一般教育 人文科学 General Education Humanities',
  GEN: '一般教育 自然科学 General Education Natural Sciences',
  GES: '一般教育 社会科学 General Education Social Sciences',
  GEX: '一般教育 学際 General Education Interdisciplinary',
  HPE: '保健体育科目 Health and Physical Education',
  ELA: '英語教育科目 English for Liberal Arts (English Language Program)',
  ELG: '英語語学教育（選択科目） English Language General (Electives)',
  JLP: '日本語教育科目 Japanese Language Program',
  TCP: '教職課程 Teacher Certification Program',
  CTP: '学芸員課程 Curatorial Training Program',
  SLR: 'サービスラーニング Service Learning',
  STH: 'その他 Others',
  W: '世界の言語 World Languages',
};

// Preferred dedicated embedding models if installed in Ollama
const PREFERRED_EMBED_MODELS = [
  'bge-m3',
  'qwen3-embedding',
  'multilingual-e5',
  'paraphrase-multilingual',
  'nomic-embed-text',
  'mxbai-embed-large',
  'snowflake-arctic-embed',
  'all-minilm',
];

class SemanticSearchEngine {
  constructor() {
    this.dbPromise = null;
    this.memoryCache = new Map(); // key: `${model}::${docId}` -> Float32Array
    this.syllabusMemoryCache = new Map(); // key: url -> { descEn, descJa }
    this.resolvedModel = null;
    this.resolvedForConfig = null;
    this.isIndexing = false;
  }

  openDB() {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = () => resolve(null);
    });
    return this.dbPromise;
  }

  async getCachedVectors(keys) {
    const result = new Map();
    const missingFromMem = [];

    for (const k of keys) {
      if (this.memoryCache.has(k)) {
        result.set(k, this.memoryCache.get(k));
      } else {
        missingFromMem.push(k);
      }
    }

    if (missingFromMem.length === 0) return result;

    const db = await this.openDB();
    if (!db) return result;

    await new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const storeObj = tx.objectStore(STORE_NAME);
        let remaining = missingFromMem.length;

        for (const k of missingFromMem) {
          const getReq = storeObj.get(k);
          getReq.onsuccess = () => {
            if (getReq.result) {
              const vec = getReq.result instanceof Float32Array
                ? getReq.result
                : new Float32Array(getReq.result);
              this.memoryCache.set(k, vec);
              result.set(k, vec);
            }
            if (--remaining === 0) resolve();
          };
          getReq.onerror = () => {
            if (--remaining === 0) resolve();
          };
        }
      } catch {
        resolve();
      }
    });

    return result;
  }

  async saveCachedVectors(entries) {
    for (const [k, vec] of entries) {
      this.memoryCache.set(k, vec);
    }
    const db = await this.openDB();
    if (!db || entries.length === 0) return;

    await new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const storeObj = tx.objectStore(STORE_NAME);
        for (const [k, vec] of entries) {
          storeObj.put(vec, k);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  getBaseUrl() {
    const endpoint = store.llamaConfig.ENDPOINT || 'http://127.0.0.1:11434/api/chat';
    return endpoint.replace(/\/(v1\/chat\/completions|api\/chat|api\/embed|api\/embeddings|v1\/embeddings|embeddings|embedding)\/?$/, '').replace(/\/$/, '');
  }

  getOllamaBaseUrl() {
    return this.getBaseUrl();
  }

  isGemini() {
    const endpoint = (store.llamaConfig.ENDPOINT || '').toLowerCase();
    return endpoint.includes('generativelanguage.googleapis.com') || store.llamaConfig.PROVIDER === 'gemini';
  }

  isLlamaCppOrOpenAi() {
    const endpoint = (store.llamaConfig.ENDPOINT || '').toLowerCase();
    return this.isGemini() || endpoint.includes('/v1/') || endpoint.includes('8080') || (!endpoint.includes('11434') && !endpoint.includes('ollama'));
  }

  /**
   * Resolve which model to use for embeddings (Gemini, Ollama, or llama.cpp/OpenAI-compatible).
   * Uses store.llamaConfig.EMBED_MODEL (configured separately from the conversation MODEL).
   */
  async resolveEmbedModel() {
    if (this.isGemini()) {
      const cfg = (store.llamaConfig.EMBED_MODEL || '').trim();
      return cfg && cfg.toLowerCase() !== 'auto' ? cfg : 'gemini-embedding-001';
    }

    const cfgEmbed = (store.llamaConfig.EMBED_MODEL || '').trim();
    const configSig = `${this.getBaseUrl()}|${cfgEmbed}`;

    if (this.resolvedModel && this.resolvedForConfig === configSig) {
      return this.resolvedModel;
    }

    if (cfgEmbed && cfgEmbed.toLowerCase() !== 'auto') {
      this.resolvedModel = cfgEmbed;
      this.resolvedForConfig = configSig;
      return this.resolvedModel;
    }

    const base = this.getBaseUrl();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      // Check /api/tags (Ollama native)
      const tagsRes = await fetch(`${base}/api/tags`, { signal: controller.signal }).catch(() => null);
      if (tagsRes && tagsRes.ok) {
        const data = await tagsRes.json();
        const models = (data.models || []).map(m => m.name || '');

        for (const pref of PREFERRED_EMBED_MODELS) {
          const found = models.find(name => name.toLowerCase().includes(pref));
          if (found) {
            clearTimeout(timeout);
            this.resolvedModel = found;
            this.resolvedForConfig = configSig;
            return this.resolvedModel;
          }
        }
      }

      // Check /v1/models (llama.cpp / OpenAI compatible)
      const modelsRes = await fetch(`${base}/v1/models`, { signal: controller.signal }).catch(() => null);
      clearTimeout(timeout);
      if (modelsRes && modelsRes.ok) {
        const data = await modelsRes.json();
        const models = (data.data || []).map(m => m.id || '');
        if (models.length > 0) {
          this.resolvedModel = models[0];
          this.resolvedForConfig = configSig;
          return this.resolvedModel;
        }
      }
    } catch {
      // Ignore and fallback to default embedding model
    }

    this.resolvedModel = store.llamaConfig.MODEL || 'nomic-embed-text';
    this.resolvedForConfig = configSig;
    return this.resolvedModel;
  }

  /**
   * Build semantic document string for a course:
   * Uses: course code & title, clean major name, level name (without *00-level), and syllabus descriptions.
   */
  buildCourseDocText(course, syllabus = null) {
    const prefixMatch = course.code.match(/^([A-Z]+)/);
    const prefix = prefixMatch ? prefixMatch[1] : '';
    const majorName = MAJOR_NAMES[prefix] || (course.code.startsWith('W') ? MAJOR_NAMES['W'] : '');

    // Level description without *00番台 string
    const levelDesc = course.level === 100
      ? '基礎 入門 Foundation Introductory'
      : course.level === 200
        ? '中級 Intermediate'
        : course.level === 300
          ? '応用 上級 Advanced'
          : '';

    const titleTokens = [course.code];
    if (course.titleEn) titleTokens.push(course.titleEn);
    if (course.titleJa && course.titleJa !== course.titleEn) titleTokens.push(course.titleJa);
    if (titleTokens.length === 1 && course.title) titleTokens.push(course.title);

    const parts = [
      titleTokens.join(' '),
      majorName,
      levelDesc,
    ];

    if (syllabus) {
      if (syllabus.descJa) parts.push(syllabus.descJa);
      if (syllabus.descEn) parts.push(syllabus.descEn);
    }

    return parts.filter(Boolean).join(' | ');
  }

  getCourseDocKey(model, course) {
    return `${model}::v3::${course.code}|${course.titleJa || course.title}|${course.titleEn || ''}`;
  }

  normalizeVector(arr) {
    const vec = new Float32Array(arr.length);
    let normSq = 0;
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i];
      vec[i] = v;
      normSq += v * v;
    }
    const norm = Math.sqrt(normSq);
    if (norm > 0) {
      for (let i = 0; i < vec.length; i++) {
        vec[i] /= norm;
      }
    }
    return vec;
  }

  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
    }
    return dot;
  }

  /**
   * Fetch embeddings for an array of texts.
   * Supports both Ollama (/api/embed) and llama.cpp / OpenAI-compatible (/v1/embeddings).
   * Automatically tries endpoints and falls back gracefully.
   */
  async fetchEmbeddingsBatch(model, texts) {
    const base = this.getBaseUrl();
    const isLlama = this.isLlamaCppOrOpenAi();
    const isGem = this.isGemini();

    const headers = { 'Content-Type': 'application/json' };
    if (store.llamaConfig.API_KEY) {
      headers['Authorization'] = `Bearer ${store.llamaConfig.API_KEY}`;
    }

    // Determine primary and secondary endpoints
    let endpointsToTry;
    if (isGem) {
      // For Gemini OpenAI compatibility endpoint: https://generativelanguage.googleapis.com/v1beta/openai/embeddings
      const geminiEmbedUrl = base.endsWith('/v1') ? `${base}/embeddings` : `${base}/embeddings`;
      endpointsToTry = [
        { url: geminiEmbedUrl, type: 'gemini' },
        { url: `${base}/v1/embeddings`, type: 'openai' },
      ];
    } else if (isLlama) {
      endpointsToTry = [
        { url: `${base}/v1/embeddings`, type: 'openai' },
        { url: `${base}/embeddings`, type: 'openai' },
        { url: `${base}/api/embed`, type: 'ollama' },
      ];
    } else {
      endpointsToTry = [
        { url: `${base}/api/embed`, type: 'ollama' },
        { url: `${base}/v1/embeddings`, type: 'openai' },
      ];
    }

    let lastError = null;

    for (const ep of endpointsToTry) {
      try {
        const res = await fetch(ep.url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            input: texts,
          }),
        });

        if (res.status === 404) {
          // Endpoint doesn't exist on this server, try next endpoint
          lastError = new Error(`Endpoint ${ep.url} returned 404 Not Found`);
          continue;
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          let hint = '';
          if (ep.url.includes('/v1/embeddings') && (res.status === 400 || res.status === 501 || res.status === 404)) {
            hint = ' (Note: llama-server must be started with the `--embeddings` flag to enable /v1/embeddings)';
          }
          if (res.status === 401 || res.status === 403) {
            hint = ' (Check if your API Key is correct)';
          }
          throw new Error(`Embedding request to ${ep.url} failed with status ${res.status}${hint}: ${errText}`);
        }

        const data = await res.json();

        // 1. Ollama format: { embeddings: [[...], [...]] }
        if (Array.isArray(data.embeddings)) {
          return data.embeddings.map(raw => this.normalizeVector(raw));
        }

        // 2. OpenAI / llama.cpp / Gemini format: { data: [{ embedding: [...] }, ...] }
        if (Array.isArray(data.data)) {
          return data.data.map(item => this.normalizeVector(item.embedding || []));
        }

        // 3. llama.cpp single format: { embedding: [...] }
        if (Array.isArray(data.embedding)) {
          return [this.normalizeVector(data.embedding)];
        }

        throw new Error(`Unrecognized embeddings response format from ${ep.url}`);
      } catch (err) {
        lastError = err;
        if (err.message && err.message.includes('404')) {
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error('All embedding endpoints (/v1/embeddings and /api/embed) failed');
  }

  /**
   * Ensure all given courses have cached embeddings in IndexedDB/memory.
   */
  async ensureCourseEmbeddings(courses, onProgress = null) {
    const model = await this.resolveEmbedModel();

    // Deduplicate courses by (code + title)
    const uniqueMap = new Map();
    for (const c of courses) {
      const key = this.getCourseDocKey(model, c);
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, c);
      }
    }

    const allKeys = Array.from(uniqueMap.keys());
    const cachedMap = await this.getCachedVectors(allKeys);
    const missingKeys = allKeys.filter(k => !cachedMap.has(k));

    if (missingKeys.length === 0) {
      return { model, vectorsByKey: cachedMap };
    }

    this.isIndexing = true;
    const isDedicatedEmbed = PREFERRED_EMBED_MODELS.some(p => model.toLowerCase().includes(p));
    const batchSize = isDedicatedEmbed ? 48 : 16;
    let completed = 0;

    try {
      // Preload syllabi.json dictionary; items not in syllabi.json are not enriched with descriptions
      await this.preloadSyllabi();

      for (let i = 0; i < missingKeys.length; i += batchSize) {
        const batchKeys = missingKeys.slice(i, i + batchSize);
        const batchTexts = batchKeys.map(k => {
          const course = uniqueMap.get(k);
          const syllabus = this.getSyllabus(course.url);
          return this.buildCourseDocText(course, syllabus);
        });

        if (onProgress) {
          onProgress({
            completed,
            total: missingKeys.length,
            model,
          });
        }

        const vectors = await this.fetchEmbeddingsBatch(model, batchTexts);
        const newEntries = [];

        for (let j = 0; j < batchKeys.length; j++) {
          if (vectors[j]) {
            cachedMap.set(batchKeys[j], vectors[j]);
            newEntries.push([batchKeys[j], vectors[j]]);
          }
        }

        await this.saveCachedVectors(newEntries);
        completed += batchKeys.length;
      }

      if (onProgress) {
        onProgress({ completed: missingKeys.length, total: missingKeys.length, model, done: true });
      }
    } finally {
      this.isIndexing = false;
    }

    return { model, vectorsByKey: cachedMap };
  }

  /**
   * Compute semantic cosine similarities for a query against candidate courses.
   * Returns a Map of course.id -> { similarity, zScore, normalizedScore }.
   */
  async scoreCoursesSemantically(query, courses, onProgress = null) {
    if (!query || !courses || courses.length === 0) {
      return { scoresById: new Map(), model: null };
    }

    const { model, vectorsByKey } = await this.ensureCourseEmbeddings(courses, onProgress);
    const [queryVec] = await this.fetchEmbeddingsBatch(model, [query]);

    if (!queryVec) {
      return { scoresById: new Map(), model };
    }

    const rawSims = [];
    const simById = new Map();

    for (const c of courses) {
      const key = this.getCourseDocKey(model, c);
      const courseVec = vectorsByKey.get(key);
      if (courseVec) {
        const sim = this.cosineSimilarity(queryVec, courseVec);
        simById.set(c.id, sim);
        rawSims.push(sim);
      }
    }

    if (rawSims.length === 0) {
      return { scoresById: new Map(), model };
    }

    // Compute distribution stats (mean, stdDev, max, min) to normalize across any embedding model
    let sum = 0;
    let maxSim = -Infinity;
    let minSim = Infinity;
    for (const s of rawSims) {
      sum += s;
      if (s > maxSim) maxSim = s;
      if (s < minSim) minSim = s;
    }
    const mean = sum / rawSims.length;

    let varianceSum = 0;
    for (const s of rawSims) {
      const diff = s - mean;
      varianceSum += diff * diff;
    }
    const stdDev = Math.sqrt(varianceSum / rawSims.length) || 0.001;
    const range = Math.max(0.001, maxSim - minSim);

    const scoresById = new Map();
    for (const [id, sim] of simById.entries()) {
      const zScore = (sim - mean) / stdDev;
      const normalized = (sim - minSim) / range; // 0..1
      scoresById.set(id, {
        similarity: sim,
        zScore,
        normalized,
      });
    }

    return { scoresById, model, mean, stdDev, maxSim, minSim };
  }

  /**
   * Preload static syllabi.json dictionary into memory cache.
   * Only items present in syllabi.json are used; no live network or proxy requests are made.
   */
  async preloadSyllabi() {
    if (this._syllabiPromise) return this._syllabiPromise;
    this._syllabiPromise = (async () => {
      try {
        const res = await fetch('syllabi.json');
        if (res.ok) {
          const data = await res.json();
          for (const [url, item] of Object.entries(data)) {
            this.syllabusMemoryCache.set(url, item);
          }
        }
      } catch (err) {
        console.warn('[Semantic Search] syllabi.json could not be loaded:', err);
      }
    })();
    return this._syllabiPromise;
  }

  /**
   * Get syllabus details from syllabi.json memory cache.
   * Returns null if not present in syllabi.json (no live network/proxy requests).
   */
  getSyllabus(url) {
    if (!url) return null;
    return this.syllabusMemoryCache.get(url) || null;
  }

  /**
   * Look up syllabus descriptions from syllabi.json for a list of courses.
   * Courses not in syllabi.json will have empty descriptions.
   */
  async fetchSyllabusDescriptionsForCourses(courses) {
    await this.preloadSyllabi();
    const resultMap = new Map();
    if (!Array.isArray(courses)) return resultMap;

    for (const course of courses) {
      const syl = this.getSyllabus(course.url);
      if (syl) {
        resultMap.set(course.id, syl);
      } else {
        resultMap.set(course.id, { descEn: '', descJa: '', goals: '', notes: '', policy: '' });
      }
    }

    return resultMap;
  }
}

export const semanticSearch = new SemanticSearchEngine();
