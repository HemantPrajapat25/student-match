/**
 * matcher.js — Matching Engine
 * Scoring, ranking, filtering, and sorting for mentor-student compatibility.
 */

// ── Timezone offset helper ────────────────────────────────────────

/**
 * Score timezone proximity between two IANA timezone strings.
 * @param {string} tzA
 * @param {string} tzB
 * @returns {number} 0–10 pts
 */
export function calcTimezoneScore(tzA, tzB) {
  if (!tzA || !tzB) return 5; // neutral fallback
  try {
    const now  = new Date();
    const offA = new Date(now.toLocaleString('en-US', { timeZone: tzA })) - now;
    const offB = new Date(now.toLocaleString('en-US', { timeZone: tzB })) - now;
    const diffHrs = Math.abs(offA - offB) / 3_600_000;
    if (diffHrs === 0) return 10;
    if (diffHrs <= 3)  return 7;
    if (diffHrs <= 6)  return 4;
    return 0;
  } catch {
    return 5; // malformed timezone → neutral
  }
}

// ── Core scoring function ─────────────────────────────────────────

/**
 * Calculate a compatibility score between a student and a mentor.
 * @param {Object} student - Student profile object
 * @param {Object} mentor  - Mentor user object (with .profile)
 * @returns {{ score: number, breakdown: Object }}
 */
export function matchScore(student, mentor) {
  let score = 0;
  const breakdown = {};
  const sp = student.profile ?? student; // support raw profile or full user
  const mp = mentor.profile  ?? mentor;

  // ─── 1. Field match (20 pts) ─────────────────────────────────
  const studentField = (sp.field ?? '').toLowerCase();
  const expertise    = mp.expertise ?? [];
  const fieldScore   = expertise[0]?.toLowerCase() === studentField ? 20
    : expertise.some(e => e.toLowerCase().includes(studentField) || studentField.includes(e.toLowerCase())) ? 10
    : 0;
  score += fieldScore;
  breakdown.field = fieldScore;

  // ─── 2. Goal alignment (25 pts) ──────────────────────────────
  const goals = sp.goals ?? [];
  const goalOverlap = goals.filter(g =>
    expertise.some(e => e.toLowerCase().includes(g.toLowerCase()) || g.toLowerCase().includes(e.toLowerCase()))
  ).length;
  const goalScore = Math.round((goalOverlap / Math.max(goals.length, 1)) * 25);
  score += goalScore;
  breakdown.goals = goalScore;

  // Fallback: if no goal overlap but field matched → partial bonus
  if (goalScore === 0 && fieldScore >= 10) {
    score += 5;
    breakdown.goalBonus = 5;
  }

  // ─── 3. Skill coverage (25 pts) ──────────────────────────────
  const wanted  = sp.skillsWanted ?? [];
  const covered = wanted.filter(s =>
    expertise.some(e => e.toLowerCase() === s.toLowerCase())
  ).length;
  const skillScore = Math.round((covered / Math.max(wanted.length, 1)) * 25);
  score += skillScore;
  breakdown.skills = skillScore;

  // ─── 4. Style match (10 pts) ─────────────────────────────────
  const prefStyle    = sp.preferredStyle ?? '';
  const mentorStyles = mp.mentoringStyle ?? [];
  const styleScore   = mentorStyles.includes(prefStyle) ? 10
    : mentorStyles.includes('flexible') ? 5 : 0;
  score += styleScore;
  breakdown.style = styleScore;

  // ─── 5. Timezone proximity (10 pts) ──────────────────────────
  const tzScore = calcTimezoneScore(sp.timezone, mp.timezone);
  score += tzScore;
  breakdown.timezone = tzScore;

  // ─── 6. Availability match (10 pts) ──────────────────────────
  const studentHrs = sp.availabilityHrs ?? 0;
  const mentorHrs  = mp.availabilityHrs ?? 0;
  const availScore = studentHrs <= mentorHrs ? 10
    : studentHrs <= mentorHrs + 2 ? 5 : 0;
  score += availScore;
  breakdown.availability = availScore;

  // ─── BIAS NOTE: name/gender/photo/nationality never factored ──
  // ─── ML HINT: Phase 2 — replace view boost with collaborative filtering ─

  // View-count popularity micro-boost (≤ 5%)
  // Phase 2: Replace this boost with a collaborative filtering model
  // trained on accepted match pairs.
  const views   = Number(sessionStorage.getItem(`views_${mentor.id}`) ?? 0);
  const mlBoost = Math.min(views * 0.5, 5);
  score = Math.min(score + mlBoost, 100);
  breakdown.mlBoost = parseFloat(mlBoost.toFixed(1));

  // Track this scoring run (increment view)
  sessionStorage.setItem(`views_${mentor.id}`, views + 1);

  return { score: Math.round(score), breakdown };
}

// ── Ranking ───────────────────────────────────────────────────────

/**
 * Score and rank all mentors for a student. Ties are shuffled randomly.
 * Logs a console warning if < 3 mentors score above 40%.
 * @param {Object} student - Student user object
 * @param {Array}  mentors - Array of mentor user objects
 * @returns {Array} Mentors with .match = {score, breakdown}, sorted descending
 */
export function rankMentors(student, mentors) {
  const scored = mentors.map(m => ({
    ...m,
    match: matchScore(student, m),
  }));

  // Warn if sparse data
  const above40 = scored.filter(m => m.match.score >= 40).length;
  if (above40 < 3) {
    console.warn(
      `[matcher] Only ${above40} mentor(s) scored ≥ 40% for student ${student.email}. ` +
      'Consider expanding profile data or adding more mentors.'
    );
  }

  // Sort: descending score; shuffle ties
  return scored.sort((a, b) => {
    if (b.match.score !== a.match.score) return b.match.score - a.match.score;
    return Math.random() - 0.5; // anti-alphabetical bias
  });
}

// ── Filtering ─────────────────────────────────────────────────────

/**
 * Apply sidebar filters to a list of ranked mentor objects.
 * @param {Array}  mentors - Already ranked mentors (with .match)
 * @param {Object} filters - Filter values from the sidebar
 * @param {string[]} filters.fields       - Selected field checkboxes
 * @param {string[]} filters.goals        - Selected goal checkboxes
 * @param {string}   filters.availability - 'any'|'1-2'|'3-5'|'5+'
 * @param {string}   filters.style        - 'any'|'1:1'|'async'|'project'|'group'
 * @param {string}   filters.timezone     - IANA string or ''
 * @param {number}   filters.minScore     - Minimum compatibility %
 * @returns {Array} Filtered mentor list
 */
export function filterMentors(mentors, filters = {}) {
  const {
    fields       = [],
    goals        = [],
    availability = 'any',
    style        = 'any',
    timezone     = '',
    minScore     = 0,
  } = filters;

  return mentors.filter(mentor => {
    const mp    = mentor.profile ?? mentor;
    const score = mentor.match?.score ?? 0;

    // Min compatibility %
    if (score < minScore) return false;

    // Field filter
    if (fields.length > 0) {
      const expertiseLower = (mp.expertise ?? []).map(e => e.toLowerCase());
      const matches = fields.some(f =>
        expertiseLower.some(e => e.includes(f.toLowerCase()) || f.toLowerCase().includes(e))
      );
      if (!matches) return false;
    }

    // Goal filter
    if (goals.length > 0) {
      const expertiseLower = (mp.expertise ?? []).map(e => e.toLowerCase());
      const matches = goals.some(g =>
        expertiseLower.some(e => e.includes(g.toLowerCase()) || g.toLowerCase().includes(e))
      );
      if (!matches) return false;
    }

    // Availability filter
    if (availability !== 'any') {
      const hrs = mp.availabilityHrs ?? 0;
      if (availability === '1-2' && hrs > 2)  return false;
      if (availability === '3-5' && (hrs < 3 || hrs > 5)) return false;
      if (availability === '5+'  && hrs < 5)  return false;
    }

    // Style filter
    if (style !== 'any') {
      const styles = mp.mentoringStyle ?? [];
      if (!styles.includes(style) && !styles.includes('flexible')) return false;
    }

    // Timezone filter
    if (timezone) {
      if (mp.timezone !== timezone) return false;
    }

    return true;
  });
}

// ── Sorting ───────────────────────────────────────────────────────

/**
 * Re-sort a mentor list by a given key.
 * @param {Array}  mentors
 * @param {'score'|'availability'|'recent'} sortKey
 * @returns {Array} New sorted array
 */
export function sortMentors(mentors, sortKey = 'score') {
  return [...mentors].sort((a, b) => {
    const ap = a.profile ?? a;
    const bp = b.profile ?? b;
    if (sortKey === 'availability') {
      return (bp.availabilityHrs ?? 0) - (ap.availabilityHrs ?? 0);
    }
    if (sortKey === 'recent') {
      return new Date(b.updatedAt ?? 0) - new Date(a.updatedAt ?? 0);
    }
    // Default: best match score
    return (b.match?.score ?? 0) - (a.match?.score ?? 0);
  });
}

// ── Warning helper ────────────────────────────────────────────────

/**
 * Return a warning message if top match score is below 50%, else null.
 * @param {number} topScore
 * @returns {string|null}
 */
export function getLimitedMatchesWarning(topScore) {
  if (topScore < 50) {
    return 'Limited matches — your top mentor compatibility is below 50%. ' +
           'Try expanding your goals or skills in your profile for better results.';
  }
  return null;
}

/**
 * Get the top 3 overlapping skills between student and mentor.
 * @param {Object} student - Student profile
 * @param {Object} mentor  - Mentor user
 * @returns {string[]} Up to 3 matching skill strings
 */
export function getOverlappingSkills(student, mentor) {
  const sp = student.profile ?? student;
  const mp = mentor.profile  ?? mentor;
  const wanted     = sp.skillsWanted ?? [];
  const expertise  = mp.expertise   ?? [];
  const overlaps   = wanted.filter(s =>
    expertise.some(e => e.toLowerCase() === s.toLowerCase())
  );
  // If no exact matches, try goal overlap
  if (overlaps.length === 0) {
    const goals = sp.goals ?? [];
    return goals.filter(g =>
      expertise.some(e => e.toLowerCase().includes(g.toLowerCase()))
    ).slice(0, 3);
  }
  return overlaps.slice(0, 3);
}
