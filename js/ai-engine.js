/**
 * AI Advising Engine: Search, Ranking, Offline Advisor, and LLM Streaming
 */

import { calculateCreditTotals, findCourseConflictsWithEnrolled, checkTermCollisions } from './conflict.js';
import { semanticSearch } from './semantic-search.js';
import { buildStudentStatusLines, buildCatalogSummary, buildSystemPrompt } from './ai-prompts.js';

export function isLanguageProgram(code) {
  if (!code) return false;
  const upper = code.toUpperCase();
  return upper.startsWith('JLP') || upper.startsWith('ELA') || upper.startsWith('JPN') || upper.startsWith('ENG');
}

export function cleanThinkTags(text) {
  if (!text) return '';
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

export function isGeminiConfig(config) {
  const ep = (config?.ENDPOINT || '').toLowerCase();
  const prov = (config?.PROVIDER || '').toLowerCase();
  return prov === 'gemini' || ep.includes('generativelanguage');
}

export async function resolveChatModel(requestedModel, baseUrl) {
  if (requestedModel && requestedModel.trim() !== '') {
    return requestedModel.trim();
  }
  try {
    const res = await fetch(`${baseUrl}/api/tags`).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      const models = (data.models || []).map(m => m.name).filter(Boolean);
      if (models.length > 0) return models[0];
    }
  } catch {}
  return 'gemini-3.5-flash-lite';
}

/**
 * Multi-layer hybrid course search: schedule/time filters, credit filters, major filters, and semantic search
 */
export async function searchCatalogByInterest(query, { allCourses, enrolledByTerm, currentTerm, term = null, onlyNonConflicting = false }) {
  const qLower = (query || '').toLowerCase();
  const poolCourses = (allCourses || []).filter(c => {
    if (isLanguageProgram(c.code)) return false;
    if (term && c.term !== term) return false;
    if (onlyNonConflicting) {
      const termCourses = enrolledByTerm[c.term] || [];
      if (termCourses.some(e => e.id === c.id)) return false;
      if (findCourseConflictsWithEnrolled(c, termCourses).length > 0) return false;
    }
    return true;
  });

  // 1. Detect Schedule / Day / Period
  const requestedDays = new Set();
  if (/(\bmonday\b|\bmon\b|月曜)/.test(qLower)) requestedDays.add('M');
  if (/(\btuesday\b|\btue\b|\btues\b|火曜)/.test(qLower)) requestedDays.add('TU');
  if (/(\bwednesday\b|\bwed\b|水曜)/.test(qLower)) requestedDays.add('W');
  if (/(\bthursday\b|\bthu\b|\bthur\b|\bthurs\b|木曜)/.test(qLower)) requestedDays.add('TH');
  if (/(\bfriday\b|\bfri\b|金曜)/.test(qLower)) requestedDays.add('F');
  if (/(\bsaturday\b|\bsat\b|土曜)/.test(qLower)) requestedDays.add('SA');

  const requestedPeriods = new Set();
  const periodMatches = qLower.matchAll(/(?:([1-7])(?:限|st period|nd period|rd period|th period)|period\s*([1-7])|\bp([1-7])\b)/gi);
  for (const pm of periodMatches) {
    const pNum = parseInt(pm[1] || pm[2] || pm[3], 10);
    if (pNum >= 1 && pNum <= 7) requestedPeriods.add(pNum);
  }

  const directSlotTokens = [];
  const slotRegex = /([*]?)([1-7])\/([a-z]+)/gi;
  let sm;
  while ((sm = slotRegex.exec(qLower)) !== null) {
    directSlotTokens.push({ period: parseInt(sm[2], 10), day: sm[3].toUpperCase() });
  }

  // 2. Detect Language & Credit Modifiers
  const requestedLangs = new Set();
  if (/(\benglish\b|英語)/.test(qLower)) requestedLangs.add('E');
  if (/(\bjapanese\b|日本語)/.test(qLower)) requestedLangs.add('J');

  const requestedCredits = new Set();
  if (/(?:1\/3\s*(?:credits?|cr|単位)?|0\.33\s*(?:credits?|cr|単位)?)/i.test(qLower)) {
    requestedCredits.add(0.33);
  }
  if (/(?<![\/\d])\b3\s*(?:credits?|cr)\b|(?<![\/\d])3単位/i.test(qLower)) {
    requestedCredits.add(3);
  }
  if (/(?<![\/\d])\b2\s*(?:credits?|cr)\b|(?<![\/\d])2単位/i.test(qLower)) {
    requestedCredits.add(2);
  }
  if (/(?<![\/\d])\b1\s*(?:credits?|cr)\b(?!\s*\/)|(?<![\/\d])1単位/i.test(qLower)) {
    requestedCredits.add(1);
  }

  const matchesCredits = (courseCredits) => {
    if (requestedCredits.size === 0) return true;
    for (const rc of requestedCredits) {
      if (Math.abs(courseCredits - rc) < 0.02) return true;
    }
    return false;
  };

  const matchesLang = (courseLang) => {
    if (requestedLangs.size === 0) return true;
    const l = (courseLang || '').toUpperCase();
    for (const rl of requestedLangs) {
      if (l.includes(rl)) return true;
    }
    return false;
  };

  const matchesScheduleConstraint = (course) => {
    if (directSlotTokens.length > 0) {
      const cSlots = course.slots || [];
      const hasDirect = directSlotTokens.some(dt => cSlots.some(s => s.period === dt.period && s.day === dt.day));
      if (!hasDirect) return false;
    }
    if (requestedDays.size > 0) {
      const cSlots = course.slots || [];
      const hasDay = Array.from(requestedDays).some(d => cSlots.some(s => s.day === d));
      if (!hasDay) return false;
    }
    if (requestedPeriods.size > 0) {
      const cSlots = course.slots || [];
      const hasPeriod = Array.from(requestedPeriods).some(p => cSlots.some(s => s.period === p));
      if (!hasPeriod) return false;
    }
    return true;
  };

  // 3. Detect major keywords
  const majorKeywords = {
    'AMS': ['american', 'america', 'アメリカ'],
    'ANT': ['anthropology', '人類学', '文化人類学'],
    'ARC': ['art', 'archaeology', '美術', '文化財'],
    'AST': ['asian', 'asia', 'アジア'],
    'BIO': ['biology', 'biological', '生物', '生命'],
    'BUS': ['business', 'management', 'finance', 'マーケティング', '経営'],
    'CED': ['comparative education', '比較教育'],
    'CHM': ['chemistry', 'chemical', '化学'],
    'DPS': ['development', '開発研究'],
    'ECO': ['economics', 'economic', '経済', '金融', 'マクロ', 'ミクロ'],
    'EDU': ['education', 'educational', 'pedagogy', '教育'],
    'EMS': ['education, media', 'media and society', 'メディア・社会'],
    'ENV': ['environmental', 'environment', 'ecology', '環境'],
    'GLS': ['global', 'グローバル'],
    'GSS': ['gender', 'sexuality', 'ジェンダー', 'セクシュアリティ'],
    'HST': ['history', 'historical', '歴史'],
    'IRL': ['international relations', 'international studies', '国際関係', '外交'],
    'ISC': ['information science', 'computer', 'programming', '情報科学', '情報', 'コンピュータ'],
    'JPS': ['japan studies', 'japanese studies', '日本研究'],
    'LAW': ['law', 'legal', 'jurisprudence', '法学', '法律', '憲法'],
    'LED': ['language education', '言語教育'],
    'LIT': ['literature', 'literary', '文学'],
    'LNG': ['linguistics', 'linguistic', '言語学'],
    'MCC': ['communication', 'media', 'コミュニケーション'],
    'MTH': ['mathematics', 'math', 'calculus', 'algebra', '数学', '線形代数', '微積分'],
    'MUS': ['music', 'musical', '音楽'],
    'PCS': ['peace', 'peace studies', '平和'],
    'PHR': ['philosophy', 'religion', 'ethics', '哲学', '宗教', '倫理'],
    'PHY': ['physics', 'physical science', '物理'],
    'POL': ['politics', 'political', '政治'],
    'PPL': ['public policy', 'policy', '公共政策'],
    'PSY': ['psychology', 'psychological', '心理学', '心理'],
    'SOC': ['sociology', 'sociological', '社会学', '社会'],
    'HPE': ['physical education', 'pe', 'sports', 'fitness', 'exercise', '体育', 'スポーツ', 'フィットネス', '健康'],
  };

  const matchedPrefixes = new Set();
  for (const [prefix, words] of Object.entries(majorKeywords)) {
    if (words.some(w => qLower.includes(w))) {
      matchedPrefixes.add(prefix);
    }
  }

  // 4. Semantic Search Scoring via Embeddings
  let semanticMap = new Map();
  try {
    const cleanSemanticQuery = qLower
      .replace(/(?:\d\/3|\d)\s*(?:credits?|cr|単位)/gi, '')
      .replace(/(?:\bmonday\b|\btuesday\b|\bwednesday\b|\bthursday\b|\bfriday\b|\bsaturday\b|月曜|火曜|水曜|木曜|金曜|土曜)/gi, '')
      .replace(/(?:[1-7](?:限|st period|nd period|rd period|th period)|\bp[1-7]\b)/gi, '')
      .trim();

    if (cleanSemanticQuery.length >= 2) {
      const { scoresById } = await semanticSearch.scoreCoursesSemantically(cleanSemanticQuery, poolCourses);
      semanticMap = scoresById || new Map();
    }
  } catch {}

  const scored = [];
  for (const course of poolCourses) {
    if (!matchesLang(course.language)) continue;
    if (!matchesCredits(course.credits)) continue;
    if (!matchesScheduleConstraint(course)) continue;

    let score = 0;
    const prefixMatch = course.code.match(/^([A-Z]+)/);
    const prefix = prefixMatch ? prefixMatch[1] : '';

    if (matchedPrefixes.has(prefix)) {
      score += 30;
    }

    const tLowerJa = (course.titleJa || course.title || '').toLowerCase();
    const tLowerEn = (course.titleEn || course.title || '').toLowerCase();
    const instructorLower = (course.instructor || '').toLowerCase();

    const termsToMatch = qLower.split(/[\s,・、]+/).filter(t => t.length > 1);
    for (const tm of termsToMatch) {
      if (tLowerJa.includes(tm) || tLowerEn.includes(tm)) score += 15;
      if (instructorLower.includes(tm)) score += 20;
    }

    if (semanticMap.has(course.id)) {
      const sem = semanticMap.get(course.id);
      score += sem.normalized * 50;
    }

    if (score > 0 || matchedPrefixes.size === 0) {
      scored.push({ course, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 20).map(s => s.course);
}

/**
 * Built-in Smart Offline Advisor response when LLM server is disconnected
 */
export async function generateOfflineResponse({ userText, assistantMsg, allCourses, enrolledByTerm, currentTerm, uiLang }) {
  const isEnglishOffline = uiLang === 'en' || !/[ぁ-んァ-ヶ一-龠]/.test(userText);
  const qLower = (userText || '').toLowerCase();
  const terms = ['春', '秋', '冬'];
  const termNames = { '春': isEnglishOffline ? 'Spring' : '春', '秋': isEnglishOffline ? 'Autumn' : '秋', '冬': isEnglishOffline ? 'Winter' : '冬' };

  // 1. Conflict Check Query
  if (qLower.includes('conflict') || qLower.includes('check schedule') || qLower.includes('check timetable') || qLower.includes('時間割') || qLower.includes('重複')) {
    const reportSections = [];
    let totalConflicts = 0;

    for (const t of terms) {
      const enrolled = enrolledByTerm[t] || [];
      const totals = calculateCreditTotals(enrolled);
      const collisions = checkTermCollisions(enrolled);
      totalConflicts += collisions.length;

      let conflictText = '';
      if (collisions.length > 0) {
        conflictText = collisions.map(c => `  - **${c.courseA.code}** collides with **${c.courseB.code}** on ${c.conflicts[0].description}`).join('\n');
      }

      reportSections.push(`**${termNames[t]} Term**:
- Academic: **${totals.academicCredits}** / 17.0 cr ${totals.isAcademicExceeded ? '(Exceeded)' : 'OK'} | PE: **${totals.peCredits}** / 0.33 cr | Total: **${totals.totalCredits}** / 17.33 cr
${collisions.length > 0 ? `Conflicts:\n${conflictText}` : (enrolled.length > 0 ? 'No conflicts in this term.' : 'No courses registered.')}`);
    }

    assistantMsg.content = `### Timetable Review Across All Terms:
${reportSections.join('\n\n')}

${totalConflicts > 0 ? `**Total ${totalConflicts} collision(s) detected.**` : 'All registered courses across all terms are **collision-free**!'}`;
    return;
  }

  // 2. Interest Query
  const nonConflicting = await searchCatalogByInterest(userText, {
    allCourses,
    enrolledByTerm,
    currentTerm,
    onlyNonConflicting: true,
  });
  const matches = nonConflicting.length > 0 ? nonConflicting : await searchCatalogByInterest(userText, {
    allCourses,
    enrolledByTerm,
    currentTerm,
    onlyNonConflicting: false,
  });

  if (matches.length === 0) {
    assistantMsg.content = isEnglishOffline
      ? `No courses found matching "${userText}". Try searching for majors like "Cultural Anthropology", "Economics", "Information Science", or "100-level: Foundation".`
      : `「${userText}」に合致する科目が見つかりませんでした。「文化人類学」「情報科学」「経済学」などの専攻名や「100番台:基礎」などで検索してみてください。`;
    return;
  }

  const top3 = matches.slice(0, 3);
  assistantMsg.courses = top3;
  assistantMsg.content = isEnglishOffline
    ? `### Recommended Courses for "${userText}":
Found ${matches.length} matching courses within your credit limits:`
    : `### 「${userText}」のおすすめ科目:
履修上限（17.33単位）および時間割の空きコマに合わせたおすすめ科目です：`;
}

/**
 * Stream chat completions from Gemini, llama.cpp, Ollama, or OpenAI-compatible endpoints
 */
export async function queryLlmStream({ config, userText, assistantMsg, candidateCourses, syllabusMap, activeTerm, enrolledByTerm, isEnglishQuery, onDelta }) {
  const isNoThink = config.NO_THINK !== false;
  const isGem = isGeminiConfig(config);
  const rawEndpoint = (config.ENDPOINT || 'http://127.0.0.1:11434/api/chat').trim();
  const base = rawEndpoint.replace(/\/(v1\/chat\/completions|api\/chat|v1\/embeddings|api\/embed|api\/embeddings)\/?$/, '').replace(/\/$/, '');
  const isOllamaExpected = !isGem && (rawEndpoint.includes('11434') || rawEndpoint.toLowerCase().includes('ollama'));

  const activeTermEn = activeTerm === '春' ? 'Spring' : (activeTerm === '秋' ? 'Autumn' : 'Winter');
  const studentStatusLines = buildStudentStatusLines(enrolledByTerm, isEnglishQuery);
  const catalogSummary = buildCatalogSummary(candidateCourses, syllabusMap, isEnglishQuery);
  const systemPrompt = buildSystemPrompt({ isEnglishQuery, activeTerm, activeTermEn, studentStatusLines, catalogSummary });

  let candidateUrls;
  if (isGem) {
    const geminiChatUrl = rawEndpoint.endsWith('/chat/completions') ? rawEndpoint : `${base}/chat/completions`;
    candidateUrls = [{ url: geminiChatUrl, isOllama: false }];
  } else if (isOllamaExpected) {
    candidateUrls = [
      { url: `${base}/api/chat`, isOllama: true },
      { url: `${base}/v1/chat/completions`, isOllama: false },
    ];
  } else {
    candidateUrls = [
      { url: `${base}/v1/chat/completions`, isOllama: false },
      { url: `${base}/api/chat`, isOllama: true },
    ];
  }

  const targetModel = await resolveChatModel(config.MODEL, base);
  const userPromptText = isEnglishQuery ? `${userText}\n\n(Please reply entirely in English.)` : userText;
  const userContent = (isNoThink && !isGem) ? `/no_think\n${userPromptText}` : userPromptText;

  const headers = { 'Content-Type': 'application/json' };
  if (config.API_KEY) {
    headers['Authorization'] = `Bearer ${config.API_KEY}`;
  }

  let res = null;
  let lastError = null;

  for (const cand of candidateUrls) {
    let payload;
    if (cand.isOllama) {
      payload = {
        model: targetModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        stream: true,
        options: { temperature: config.TEMPERATURE || 0.7 },
      };
      if (isNoThink) payload.think = false;
    } else {
      payload = {
        model: targetModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: config.TEMPERATURE || 0.7,
        stream: true,
      };
      if (isNoThink && !isGem) {
        payload.chat_template_kwargs = { enable_thinking: false };
      }
    }

    try {
      const attemptRes = await fetch(cand.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (attemptRes.status === 404) {
        lastError = new Error(`Endpoint ${cand.url} returned 404 Not Found`);
        continue;
      }
      if (!attemptRes.ok) {
        const errText = await attemptRes.text().catch(() => '');
        throw new Error(`Chat request to ${cand.url} failed with status ${attemptRes.status}: ${errText}`);
      }

      res = attemptRes;
      break;
    } catch (err) {
      lastError = err;
      if (err.message && err.message.includes('404')) continue;
      throw err;
    }
  }

  if (!res || !res.ok) {
    throw lastError || new Error('All chat endpoints failed');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  assistantMsg.rawContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      let data = null;
      if (trimmed.startsWith('data: ')) {
        try { data = JSON.parse(trimmed.slice(6)); } catch {}
      } else if (trimmed.startsWith('{')) {
        try { data = JSON.parse(trimmed); } catch {}
      }
      if (!data) continue;

      let delta = '';
      if (isNoThink) {
        delta = data.message?.content || data.choices?.[0]?.delta?.content || '';
      } else {
        delta = data.message?.content || data.choices?.[0]?.delta?.content || data.message?.thinking || data.choices?.[0]?.delta?.reasoning_content || '';
      }

      if (delta) {
        assistantMsg.rawContent += delta;
        assistantMsg.content = isNoThink ? cleanThinkTags(assistantMsg.rawContent) : assistantMsg.rawContent;
        if (onDelta) onDelta(assistantMsg.content);
      }
    }
  }

  if (isNoThink) {
    assistantMsg.content = cleanThinkTags(assistantMsg.rawContent || assistantMsg.content).trim();
  }

  // Extract clickable course cards from bracketed codes [ABC101]
  const codeRegex = /\[([A-Z]{2,4}\d{3}[A-Z]?)\]/g;
  const foundCodes = new Set();
  let m;
  while ((m = codeRegex.exec(assistantMsg.content)) !== null) {
    foundCodes.add(m[1]);
  }
  if (foundCodes.size === 0) {
    const fallbackRegex = /\b([A-Z]{3}\d{3}[A-Z]?)\b/g;
    while ((m = fallbackRegex.exec(assistantMsg.content)) !== null) {
      foundCodes.add(m[1]);
    }
  }

  if (foundCodes.size > 0) {
    const matchedFromCandidates = candidateCourses.filter(c => foundCodes.has(c.code));
    if (matchedFromCandidates.length > 0) {
      assistantMsg.courses = matchedFromCandidates;
    }
  } else if (candidateCourses.length > 0) {
    assistantMsg.courses = candidateCourses.slice(0, 3);
  }

  return true;
}
