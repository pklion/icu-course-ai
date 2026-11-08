/**
 * Frontend parser for data.json and schedule string tokenization.
 * Supports ICU's standard and super periods (*4, *5, *7), multi-slot periods,
 * parenthesized sessions, and detects PE activity courses (0.33 credits).
 */

import { PERIODS, DAYS } from './config.js';

/**
 * Convert period number + isSuper flag to exact start and end minute stamps
 */
export function getSlotTimeRange(periodNum, isSuper) {
  const pConfig = PERIODS.find(p => p.period === periodNum);
  if (!pConfig) {
    return { startMin: 0, endMin: 0, display: '' };
  }
  if (isSuper && pConfig.super) {
    return {
      startMin: pConfig.super.startMin,
      endMin: pConfig.super.endMin,
      display: `${pConfig.super.start}-${pConfig.super.end}`,
    };
  }
  return {
    startMin: pConfig.normal.startMin,
    endMin: pConfig.normal.endMin,
    display: `${pConfig.normal.start}-${pConfig.normal.end}`,
  };
}

/**
 * Tokenize a schedule string into normalized slot objects.
 * Handles formats:
 * - "3/TU,2/TH,3/TH"
 * - "*4/W,*4/F"
 * - "(4/TH,5/TH,6/TH,7/TH)"
 * - "4/M,(5/M,6/M,7/M)"
 * - "1/TH,2/TH<6/M,7/M or 6/W,7/W>"
 */
export function parseScheduleString(scheduleRaw) {
  if (!scheduleRaw || typeof scheduleRaw !== 'string' || scheduleRaw.trim() === '') {
    return { slots: [], isArranged: true, raw: '' };
  }

  const cleanRaw = scheduleRaw.trim();
  const validDays = new Set(DAYS.map(d => d.code));

  // Extract slot tokens: match optional *, digit 1-7, slash, and day letters
  // E.g., "*4/W", "3/TU", "1/TH"
  const slotRegex = /([*]?)([1-7])\/([A-Za-z]+)/g;
  const slots = [];
  let match;

  while ((match = slotRegex.exec(cleanRaw)) !== null) {
    const isSuper = match[1] === '*';
    const period = parseInt(match[2], 10);
    const day = match[3].toUpperCase();

    if (validDays.has(day)) {
      const timeRange = getSlotTimeRange(period, isSuper);
      slots.push({
        day,
        period,
        isSuper,
        startMin: timeRange.startMin,
        endMin: timeRange.endMin,
        timeDisplay: timeRange.display,
        slotKey: `${day}-${period}${isSuper ? '-super' : ''}`,
        label: `${isSuper ? '*' : ''}${period}/${day}`,
      });
    }
  }

  return {
    slots,
    isArranged: slots.length === 0,
    raw: cleanRaw,
  };
}

export const TERM_JA_TO_EN = { '春': 'Spring', '秋': 'Autumn', '冬': 'Winter' };
export const TERM_EN_TO_JA = { 'Spring': '春', 'Autumn': '秋', 'Winter': '冬' };

/**
 * Classify course level from course code (e.g., ANT101 -> 100-level Foundation/基礎,
 * ISC201 -> 200-level Intermediate, LNG302 -> 300-level Advanced/応用).
 */
export function getCourseLevelInfo(code) {
  const numMatch = String(code || '').match(/(\d{3})/);
  if (!numMatch) {
    return { number: 0, level: 0, levelName: 'General', levelLabel: 'その他', levelLabelEn: 'Other' };
  }
  const num = parseInt(numMatch[1], 10);
  if (num >= 100 && num < 200) {
    return { number: num, level: 100, levelName: 'Foundation', levelLabel: '100番台:基礎/Foundation', levelLabelEn: '100-level: Foundation' };
  }
  if (num >= 200 && num < 300) {
    return { number: num, level: 200, levelName: 'Intermediate', levelLabel: '200番台:Intermediate', levelLabelEn: '200-level: Intermediate' };
  }
  if (num >= 300 && num < 400) {
    return { number: num, level: 300, levelName: 'Advanced', levelLabel: '300番台:応用/Advanced', levelLabelEn: '300-level: Advanced' };
  }
  if (num >= 400) {
    return { number: num, level: 400, levelName: 'Senior/Graduate', levelLabel: '400番台:専門・演習', levelLabelEn: '400-level: Senior/Grad' };
  }
  return { number: num, level: 0, levelName: 'General/Activity', levelLabel: '000番台:共通・実技', levelLabelEn: '000-level: General/Activity' };
}

/**
 * Parse the raw 2D array from data.json & data_en.json into normalized bilingual Course records.
 */
export function parseDataJson(rawData, rawEnData = null) {
  if (!Array.isArray(rawData) || rawData.length < 2) {
    throw new Error('Invalid data.json format: expected 2D array with header');
  }

  const rows = rawData.slice(1);
  const enRows = Array.isArray(rawEnData) && rawEnData.length >= 2 ? rawEnData.slice(1) : [];

  return rows.map((row, index) => {
    const enRow = enRows[index] || [];
    const year = Number(row[0]) || 2026;
    const termJa = String(row[1] || '').trim(); // "春", "秋", "冬"
    const termEnRaw = String(enRow[1] || '').trim();
    const termEn = termEnRaw || (TERM_JA_TO_EN[termJa] || 'Autumn');
    const term = termJa;

    const code = String(row[2] || '').trim();
    const titleJa = String(row[3] || '').trim();
    const titleEn = String(enRow[3] || '').trim() || titleJa;
    const title = titleJa;

    const scheduleRaw = String(row[4] || '').trim();
    const instructor = String(row[5] || '').trim();
    const credits = parseFloat(row[6]) || 0;
    const language = String(row[7] || '').trim();
    const url = String(row[8] || '').trim();

    const { slots, isArranged } = parseScheduleString(scheduleRaw);
    const levelInfo = getCourseLevelInfo(code);

    // Physical Education activity courses are 0.33 credits (1/3 credit)
    // E.g. HPE005-HPE025 (PE Exercise, Team Sports, Martial Arts, Dance)
    const isPE = credits === 0.33 || (credits < 1.0 && code.startsWith('HPE'));

    // Unique ID combining term, code, and index
    const id = `${termJa}-${code}-${index}`;

    return {
      id,
      index,
      year,
      term,
      termJa,
      termEn,
      code,
      title,
      titleJa,
      titleEn,
      scheduleRaw,
      instructor,
      credits,
      language,
      url,
      slots,
      isArranged,
      isPE,
      courseNumber: levelInfo.number,
      level: levelInfo.level,
      levelName: levelInfo.levelName,
      levelLabel: levelInfo.levelLabel,
      levelLabelEn: levelInfo.levelLabelEn,
      category: isPE ? 'PE' : 'Academic',
    };
  });
}
