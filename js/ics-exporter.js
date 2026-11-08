/**
 * iCalendar (.ics) Generator (RFC 5545)
 * Exports the student's weekly timetable into standard calendar format
 * for Apple Calendar, Google Calendar, and Microsoft Outlook.
 */

// Approximate starting dates for ICU 2026 academic terms (10-11 weeks each)
const TERM_START_DATES = {
  '春': { year: 2026, month: 4, day: 6 },  // April 6, 2026 (Mon)
  '秋': { year: 2026, month: 9, day: 7 },  // September 7, 2026 (Mon)
  '冬': { year: 2026, month: 12, day: 7 }, // December 7, 2026 (Mon)
};

const DAY_OFFSET = {
  'M': 0,
  'TU': 1,
  'W': 2,
  'TH': 3,
  'F': 4,
  'SA': 5,
};

function pad(n) {
  return n < 10 ? '0' + n : String(n);
}

function formatICSDate(date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

export function exportToICS(enrolledCourses, term) {
  const startDateDef = TERM_START_DATES[term] || { year: 2026, month: 9, day: 7 };
  const baseDate = new Date(Date.UTC(startDateDef.year, startDateDef.month - 1, startDateDef.day));

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ICU College Course Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:ICU Timetable 2026 (${term})`,
  ];

  enrolledCourses.forEach(course => {
    if (!course.slots || course.slots.length === 0) return;

    course.slots.forEach(slot => {
      const dayOffset = DAY_OFFSET[slot.day] !== undefined ? DAY_OFFSET[slot.day] : 0;
      const eventDate = new Date(baseDate.getTime() + dayOffset * 86400000);

      // Start time
      const startHour = Math.floor(slot.startMin / 60);
      const startMin = slot.startMin % 60;
      eventDate.setUTCHours(startHour - 9, startMin, 0, 0); // convert JST (UTC+9) to UTC
      const dtStart = formatICSDate(eventDate);

      // End time
      const endHour = Math.floor(slot.endMin / 60);
      const endMin = slot.endMin % 60;
      const endDate = new Date(eventDate.getTime());
      endDate.setUTCHours(endHour - 9, endMin, 0, 0);
      const dtEnd = formatICSDate(endDate);

      const uid = `icu-${term}-${course.id}-${slot.day}-${slot.period}@scheduler`;

      ics.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${formatICSDate(new Date())}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        'RRULE:FREQ=WEEKLY;COUNT=11', // 11 weeks of term
        `SUMMARY:${course.code} ${course.title}`,
        `DESCRIPTION:Instructor: ${course.instructor || 'TBA'} | Credits: ${course.credits} | ${slot.isSuper ? 'Super Period ' : ''}Period: ${slot.label}\\nSyllabus: ${course.url}`,
        'STATUS:CONFIRMED',
        'END:VEVENT'
      );
    });
  });

  ics.push('END:VCALENDAR');

  const blob = new Blob([ics.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `icu_schedule_${term}_2026.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
