/**
 * Time Collision and Credit Limit Engine
 * Handles exact interval intersections across normal periods and super periods.
 * Checks credit caps (17 academic + 1/3 PE credits).
 */

import { CREDIT_LIMITS } from './config.js';

/**
 * Checks if two schedule slots collide in time.
 * Two slots collide iff they share the same day and their time intervals overlap:
 * startA < endB && startB < endA
 */
export function checkSlotCollision(slotA, slotB) {
  if (!slotA || !slotB) return false;
  if (slotA.day !== slotB.day) return false;
  return slotA.startMin < slotB.endMin && slotB.startMin < slotA.endMin;
}

/**
 * Checks if two courses have any overlapping slots.
 */
export function checkCourseCollision(courseA, courseB) {
  if (!courseA || !courseB) return { hasConflict: false, conflicts: [] };
  if (courseA.id === courseB.id) return { hasConflict: false, conflicts: [] };
  if (courseA.isArranged || courseB.isArranged) return { hasConflict: false, conflicts: [] };

  const conflicts = [];

  for (const sA of courseA.slots) {
    for (const sB of courseB.slots) {
      if (checkSlotCollision(sA, sB)) {
        conflicts.push({
          slotA: sA,
          slotB: sB,
          description: `${sA.label} (${sA.timeDisplay}) overlaps with ${sB.label} (${sB.timeDisplay})`,
        });
      }
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

/**
 * Finds all enrolled courses that conflict with a given candidate course.
 */
export function findCourseConflictsWithEnrolled(candidateCourse, enrolledCourses) {
  if (!candidateCourse || candidateCourse.isArranged) return [];

  const conflictingList = [];

  for (const enrolled of enrolledCourses) {
    if (enrolled.id === candidateCourse.id) continue;
    const result = checkCourseCollision(candidateCourse, enrolled);
    if (result.hasConflict) {
      conflictingList.push({
        course: enrolled,
        conflicts: result.conflicts,
      });
    }
  }

  return conflictingList;
}

/**
 * Calculate credit totals and validate against ICU credit limits:
 * Standard Academic: max 17.0
 * PE Activity: max 0.33 (1/3 credit)
 * Total: max 17.33
 */
export function calculateCreditTotals(enrolledCourses) {
  let academicCredits = 0;
  let peCredits = 0;

  for (const course of enrolledCourses) {
    if (course.isPE) {
      peCredits += course.credits;
    } else {
      academicCredits += course.credits;
    }
  }

  // Round to 2 decimal places to avoid floating point precision artifacts
  academicCredits = Math.round(academicCredits * 100) / 100;
  peCredits = Math.round(peCredits * 100) / 100;
  const totalCredits = Math.round((academicCredits + peCredits) * 100) / 100;

  const isAcademicExceeded = academicCredits > CREDIT_LIMITS.MAX_ACADEMIC;
  const isPeExceeded = peCredits > CREDIT_LIMITS.MAX_PE;
  const isTotalExceeded = totalCredits > CREDIT_LIMITS.MAX_TOTAL;

  return {
    academicCredits,
    peCredits,
    totalCredits,
    maxAcademic: CREDIT_LIMITS.MAX_ACADEMIC,
    maxPE: 0.33,
    maxTotal: 17.33,
    isAcademicExceeded,
    isPeExceeded,
    isTotalExceeded,
    hasCreditWarning: isAcademicExceeded || isPeExceeded || isTotalExceeded,
  };
}

/**
 * Find all pairwise collisions within a list of enrolled courses in a term.
 */
export function checkTermCollisions(enrolledCourses) {
  if (!Array.isArray(enrolledCourses) || enrolledCourses.length < 2) return [];

  const collisions = [];
  for (let i = 0; i < enrolledCourses.length; i++) {
    for (let j = i + 1; j < enrolledCourses.length; j++) {
      const res = checkCourseCollision(enrolledCourses[i], enrolledCourses[j]);
      if (res.hasConflict) {
        collisions.push({
          courseA: enrolledCourses[i],
          courseB: enrolledCourses[j],
          conflicts: res.conflicts,
        });
      }
    }
  }
  return collisions;
}
