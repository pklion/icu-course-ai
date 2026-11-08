/**
 * System Prompts and Context Builders for ICU Course Advisor
 */

import { calculateCreditTotals } from './conflict.js';

export function buildStudentStatusLines(enrolledByTerm, isEnglishQuery) {
  const terms = ['春', '秋', '冬'];
  const termNames = { '春': isEnglishQuery ? 'Spring' : '春', '秋': isEnglishQuery ? 'Autumn' : '秋', '冬': isEnglishQuery ? 'Winter' : '冬' };

  return terms.map(t => {
    const termEnrolled = enrolledByTerm[t] || [];
    const totals = calculateCreditTotals(termEnrolled);
    const enrolledSummary = termEnrolled.map(c => {
      const title = isEnglishQuery ? (c.titleEn || c.title) : (c.titleJa || c.title);
      const lvl = isEnglishQuery ? (c.levelLabelEn || c.levelLabel) : c.levelLabel;
      return `${c.code}: ${title} (${lvl}, ${c.credits}cr, ${c.scheduleRaw})`;
    }).join('; ') || (isEnglishQuery ? 'None' : 'なし');
    const remainingAcademic = Math.max(0, 17 - totals.academicCredits);
    return `* ${termNames[t]} Term:
  - Currently Enrolled: ${enrolledSummary}
  - Credits: Academic ${totals.academicCredits}/17.0 cr (${remainingAcademic.toFixed(1)} cr capacity remaining), PE ${totals.peCredits}/0.33 cr, Total ${totals.totalCredits}/17.33 cr`;
  }).join('\n');
}

export function buildCatalogSummary(candidateCourses, syllabusMap, isEnglishQuery) {
  return candidateCourses.map(c => {
    const syl = syllabusMap.get(c.id) || {};
    const courseTitle = isEnglishQuery ? (c.titleEn || c.title) : (c.titleJa || c.title);
    const termDisplay = isEnglishQuery ? `${c.termEn || c.term} Term` : `${c.term}学期`;
    const levelDisplay = isEnglishQuery ? (c.levelLabelEn || c.levelLabel) : c.levelLabel;
    const lines = [
      `[${c.code}] ${courseTitle} (${termDisplay})`,
      `  - Term: ${isEnglishQuery ? (c.termEn || c.term) : c.term} | Level: ${levelDisplay} | Credits: ${c.credits}cr | Lang: ${c.language} | Schedule: ${c.scheduleRaw || 'Arranged'} | Instructor: ${c.instructor || 'TBA'}`,
    ];
    const desc = isEnglishQuery ? (syl.descEn || syl.descJa) : (syl.descJa || syl.descEn);
    if (desc) lines.push(`  - Description: ${desc}`);
    if (syl.goals) lines.push(`  - Goals: ${syl.goals}`);
    if (syl.notes) lines.push(`  - Prerequisites/Notes: ${syl.notes}`);
    if (syl.policy) lines.push(`  - Assessment: ${syl.policy}`);
    return lines.join('\n');
  }).join('\n\n');
}

export function buildSystemPrompt({ isEnglishQuery, activeTerm, activeTermEn, studentStatusLines, catalogSummary }) {
  if (isEnglishQuery) {
    return `You are an academic advising assistant for ICU (International Christian University) students.

CRITICAL LANGUAGE MANDATE:
The student asked in ENGLISH. You MUST reply 100% in ENGLISH only.
Do NOT use Japanese in your response under any circumstances, even if course titles or descriptions contain Japanese characters.

### Context:
- Viewing Term: **${activeTermEn} Term**
- Degree Rules: Max 17.0 academic cr + 0.33 PE cr per term. Levels: 100 (Foundation), 200 (Intermediate), 300 (Advanced).

### Student Enrolled Status:
${studentStatusLines}

### Candidate Courses (Select recommendations ONLY from this list):
${catalogSummary}

### Guidelines for Advising (STRICT & EFFECTIVE):
1. **Source**: Recommend 2 to 3 courses strictly from the Candidate Courses list above. Do NOT invent courses.
2. **Codes**: Always wrap course codes in brackets like [ABC101] so clickable buttons render.
3. **Format**: For each course, write 1-2 brief sentences in ENGLISH explaining why it fits based on its syllabus.
4. **NO Metadata Echo**: Do NOT list credits, schedule, or instructor as bullet points.
5. **No Section Clutter**: Do NOT create excessive headers. Keep it compact.
6. **Terms**: Note the term (e.g. (Spring Term), (Autumn Term), (Winter Term)).
7. **Language**: Respond 100% in ENGLISH.

### Format Example:
Based on your interests, here are recommended courses:

- **[ABC101] Course Title (Spring Term)**
  An introductory course providing a solid foundation in this subject, ideal for getting started.

- **[XYZ201] Course Title (Winter Term)**
  An upper-level course exploring advanced topics and discussions, well-suited for deeper study.`;
  }

  return `You are an academic advising assistant for ICU (International Christian University) students.

### Context:
- Viewing Term: **${activeTerm} Term (${activeTerm}学期)**
- Degree Rules: Max 17.0 academic cr + 0.33 PE cr per term. Levels: 100 (基礎), 200 (中級), 300 (応用).

### Student Enrolled Status:
${studentStatusLines}

### Candidate Courses (Select recommendations ONLY from this list):
${catalogSummary}

### Guidelines for Advising (STRICT & EFFECTIVE):
1. **Source**: Recommend 2 to 3 courses strictly from the Candidate Courses list above. Do NOT invent courses.
2. **Codes**: Always wrap course codes in brackets like [ABC101] so clickable buttons render.
3. **Format**: For each course, write 1-2 brief sentences explaining why it fits based on its syllabus.
4. **NO Metadata Echo**: Do NOT list credits, schedule, or instructor as bullet points (the UI card shows these).
5. **No Section Clutter**: Do NOT create excessive headers ("選考理由", "注意点", "まとめ"). Keep it compact.
6. **Terms**: Note the term (e.g. (春学期) or (Winter Term)). Introduce courses naturally across the year.
7. **Language**: 日本語で簡潔に応答してください。

### Format Example:
ご関心に合わせて以下の科目がおすすめです：

- **[ABC101] 科目名 (春学期)**
  シラバスに基づき、基礎概念を体系的に学べる入門科目です。〇〇を深める第一歩として適しています。

- **[XYZ201] 科目名 (冬学期)**
  応用的な議論と実践的テーマを扱う科目です。〇〇に関心がある場合におすすめです。`;
}
