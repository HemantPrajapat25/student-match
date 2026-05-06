/**
 * store.js — localStorage abstraction layer
 * All reads wrapped in try/catch; errors surface as toasts, never crashes.
 */

// ── Key constants ───────────────────────────────────────────────
const KEYS = {
  USERS:    'mm_users',
  MATCHES:  'mm_matches',
  MESSAGES: 'mm_messages',
  SESSION:  'mm_session',
  SETTINGS: 'mm_settings',
};

// ── Low-level helpers ────────────────────────────────────────────

/**
 * Read and JSON-parse a key from localStorage.
 * @param {string} key
 * @param {*} fallback - Returned if key missing or parse fails
 * @returns {*}
 */
function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[store] read error for key "${key}":`, e);
    return fallback;
  }
}

/**
 * JSON-stringify and write a value to localStorage.
 * @param {string} key
 * @param {*} value
 * @returns {boolean} success
 */
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`[store] write error for key "${key}":`, e);
    // Notify UI layer if available
    if (typeof window.__showErrorToast === 'function') {
      window.__showErrorToast('Storage error — data may not be saved.');
    }
    return false;
  }
}

// ── USER STORE ───────────────────────────────────────────────────

/**
 * Get all users object {email: User}.
 * @returns {Object}
 */
export function getUsers() {
  return read(KEYS.USERS, {});
}

/**
 * Get a single user by email.
 * @param {string} email
 * @returns {Object|null}
 */
export function getUser(email) {
  const users = getUsers();
  return users[email.toLowerCase()] ?? null;
}

/**
 * Save (create or update) a user record.
 * @param {Object} user - Must have email field
 * @returns {boolean}
 */
export function saveUser(user) {
  const users = getUsers();
  const key   = user.email.toLowerCase();
  users[key]  = { ...users[key], ...user, updatedAt: new Date().toISOString() };
  return write(KEYS.USERS, users);
}

/**
 * Delete a user by email.
 * @param {string} email
 * @returns {boolean}
 */
export function deleteUser(email) {
  const users = getUsers();
  delete users[email.toLowerCase()];
  return write(KEYS.USERS, users);
}

/**
 * Get all users as an array.
 * @param {'student'|'mentor'|'admin'|null} roleFilter
 * @returns {Array}
 */
export function getUserList(roleFilter = null) {
  const users = getUsers();
  const arr = Object.values(users);
  return roleFilter ? arr.filter(u => u.role === roleFilter) : arr;
}

/**
 * Check if an email is already registered.
 * @param {string} email
 * @returns {boolean}
 */
export function emailExists(email) {
  return !!getUser(email);
}

// ── SESSION ──────────────────────────────────────────────────────

/**
 * Get the currently logged-in user's email from sessionStorage.
 * @returns {string|null}
 */
export function getSession() {
  try {
    return sessionStorage.getItem(KEYS.SESSION);
  } catch { return null; }
}

/**
 * Set session (login).
 * @param {string} email
 */
export function setSession(email) {
  try {
    sessionStorage.setItem(KEYS.SESSION, email.toLowerCase());
  } catch (e) {
    console.error('[store] session write error:', e);
  }
}

/**
 * Clear session (logout).
 */
export function clearSession() {
  try {
    sessionStorage.removeItem(KEYS.SESSION);
    sessionStorage.removeItem('mm_admin');
  } catch (e) {
    console.error('[store] session clear error:', e);
  }
}

/**
 * Get the currently logged-in user object.
 * @returns {Object|null}
 */
export function getCurrentUser() {
  const email = getSession();
  if (!email) return null;
  return getUser(email);
}

// ── MATCHES ──────────────────────────────────────────────────────

/**
 * Get all matches object {matchId: Match}.
 * @returns {Object}
 */
export function getMatches() {
  return read(KEYS.MATCHES, {});
}

/**
 * Save a match.
 * @param {Object} match
 * @returns {boolean}
 */
export function saveMatch(match) {
  const matches = getMatches();
  matches[match.id] = match;
  return write(KEYS.MATCHES, matches);
}

/**
 * Get matches for a specific student email.
 * @param {string} studentEmail
 * @returns {Array}
 */
export function getStudentMatches(studentEmail) {
  const matches = getMatches();
  return Object.values(matches).filter(m => m.studentEmail === studentEmail.toLowerCase());
}

/**
 * Get matches for a specific mentor email.
 * @param {string} mentorEmail
 * @returns {Array}
 */
export function getMentorMatches(mentorEmail) {
  const matches = getMatches();
  return Object.values(matches).filter(m => m.mentorEmail === mentorEmail.toLowerCase());
}

/**
 * Count total matches.
 * @returns {number}
 */
export function countMatches() {
  return Object.keys(getMatches()).length;
}

// ── MESSAGES ─────────────────────────────────────────────────────

/**
 * Build a consistent thread ID from two emails.
 * @param {string} emailA
 * @param {string} emailB
 * @returns {string}
 */
export function threadId(emailA, emailB) {
  return [emailA.toLowerCase(), emailB.toLowerCase()].sort().join('__');
}

/**
 * Get all messages for a thread.
 * @param {string} tid
 * @returns {Array}
 */
export function getThread(tid) {
  const all = read(KEYS.MESSAGES, {});
  return all[tid] ?? [];
}

/**
 * Append a message to a thread.
 * @param {string} tid
 * @param {Object} msg - Message object
 * @returns {boolean}
 */
export function addMessage(tid, msg) {
  const all = read(KEYS.MESSAGES, {});
  if (!all[tid]) all[tid] = [];
  all[tid].push(msg);
  return write(KEYS.MESSAGES, all);
}

/**
 * Mark all messages in a thread as read from the given reader's perspective.
 * @param {string} tid
 * @param {string} readerEmail
 */
export function markThreadRead(tid, readerEmail) {
  const all = read(KEYS.MESSAGES, {});
  if (!all[tid]) return;
  all[tid] = all[tid].map(m => ({
    ...m,
    read: m.senderEmail !== readerEmail ? true : m.read,
  }));
  write(KEYS.MESSAGES, all);
}

/**
 * Count unread messages for a user across all threads.
 * @param {string} email
 * @returns {number}
 */
export function countUnread(email) {
  const all = read(KEYS.MESSAGES, {});
  let count = 0;
  for (const thread of Object.values(all)) {
    count += thread.filter(m => m.senderEmail !== email && !m.read).length;
  }
  return count;
}

/**
 * Count total messages sent system-wide (admin stat).
 * @returns {number}
 */
export function countAllMessages() {
  const all = read(KEYS.MESSAGES, {});
  return Object.values(all).reduce((sum, thread) => sum + thread.length, 0);
}

/**
 * Delete all messages in a thread.
 * @param {string} tid
 */
export function clearThread(tid) {
  const all = read(KEYS.MESSAGES, {});
  delete all[tid];
  write(KEYS.MESSAGES, all);
}

// ── BOOKMARKS ────────────────────────────────────────────────────

/**
 * Toggle bookmark (save/unsave) a mentor for a student.
 * @param {string} studentEmail
 * @param {string} mentorEmail
 * @returns {boolean} true = now saved, false = now removed
 */
export function toggleBookmark(studentEmail, mentorEmail) {
  const user = getUser(studentEmail);
  if (!user) return false;
  const saved = user.profile?.savedMentors ?? [];
  const idx   = saved.indexOf(mentorEmail.toLowerCase());
  if (idx >= 0) {
    saved.splice(idx, 1);
  } else {
    saved.push(mentorEmail.toLowerCase());
  }
  user.profile.savedMentors = saved;
  saveUser(user);
  return idx < 0; // true if just added
}

/**
 * Check if a mentor is bookmarked by a student.
 * @param {string} studentEmail
 * @param {string} mentorEmail
 * @returns {boolean}
 */
export function isBookmarked(studentEmail, mentorEmail) {
  const user = getUser(studentEmail);
  return user?.profile?.savedMentors?.includes(mentorEmail.toLowerCase()) ?? false;
}

// ── ADMIN ────────────────────────────────────────────────────────

/**
 * Export all app data as a single object.
 * @returns {Object}
 */
export function exportAll() {
  return {
    users:    getUsers(),
    matches:  getMatches(),
    messages: read(KEYS.MESSAGES, {}),
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Seed demo data if localStorage is empty.
 * Called on app init.
 */
export async function seedDemoData() {
  // If we have fewer than 100 users, clear and re-seed to include the new batch
  if (Object.keys(getUsers()).length > 100) return; 
  // crypto.randomUUID() is used directly below — no extra import needed

  const now = new Date().toISOString();
  const week = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();

  const mentors = [
    {
      id: crypto.randomUUID(), email: 'sarah.chen@demo.com', role: 'mentor',
      createdAt: week, updatedAt: week, status: 'active',
      profile: {
        name: 'Sarah Chen', role: 'Senior ML Engineer', company: 'DeepMind',
        expertise: ['Machine Learning','Python','TensorFlow','Data Science','Research','Neural Networks'],
        yearsExp: 8, mentoringStyle: ['1:1','project'],
        capacity: 3, timezone: 'America/New_York', availabilityHrs: 5,
        bio: 'Passionate about making AI accessible. I love helping students break into ML research and industry roles.',
        avatarColor: 'hsl(220,65%,45%)', onlineStatus: 'online',
      }
    },
    {
      id: crypto.randomUUID(), email: 'raj.patel@demo.com', role: 'mentor',
      createdAt: week, updatedAt: week, status: 'active',
      profile: {
        name: 'Raj Patel', role: 'Product Manager', company: 'Google',
        expertise: ['Product Management','UX Design','Agile','Startup Founder','Go-to-market'],
        yearsExp: 6, mentoringStyle: ['async','group'],
        capacity: 5, timezone: 'America/Los_Angeles', availabilityHrs: 3,
        bio: 'Former founder turned PM. I help students navigate the PM path and build products people love.',
        avatarColor: 'hsl(30,65%,45%)', onlineStatus: 'away',
      }
    },
    {
      id: crypto.randomUUID(), email: 'amira.ali@demo.com', role: 'mentor',
      createdAt: now, updatedAt: now, status: 'active',
      profile: {
        name: 'Amira Ali', role: 'UX Lead', company: 'Figma',
        expertise: ['UX Design','User Research','Figma','Design Systems','Web Dev'],
        yearsExp: 5, mentoringStyle: ['1:1','async'],
        capacity: 4, timezone: 'Europe/London', availabilityHrs: 5,
        bio: 'Design systems advocate. I mentor students who want to master UX and break into big tech design teams.',
        avatarColor: 'hsl(280,65%,45%)', onlineStatus: 'online',
      }
    },
    {
      id: crypto.randomUUID(), email: 'liam.o@demo.com', role: 'mentor',
      createdAt: week, updatedAt: week, status: 'active',
      profile: {
        name: 'Liam O\'Brien', role: 'Full-Stack Engineer', company: 'Stripe',
        expertise: ['Web Dev','JavaScript','React','Node.js','API Design','System Design'],
        yearsExp: 7, mentoringStyle: ['project','1:1'],
        capacity: 3, timezone: 'Europe/Dublin', availabilityHrs: 5,
        bio: 'I build payment infrastructure by day, mentor aspiring engineers by night. Let\'s ship something cool together.',
        avatarColor: 'hsl(160,65%,35%)', onlineStatus: 'offline',
      }
    },
    {
      id: crypto.randomUUID(), email: 'yuki.tanaka@demo.com', role: 'mentor',
      createdAt: week, updatedAt: week, status: 'active',
      profile: {
        name: 'Yuki Tanaka', role: 'Data Scientist', company: 'Spotify',
        expertise: ['Data Science','Python','SQL','Statistics','Machine Learning','Visualization'],
        yearsExp: 4, mentoringStyle: ['async','group'],
        capacity: 6, timezone: 'Asia/Tokyo', availabilityHrs: 3,
        bio: 'Data science generalist — I help you understand the full pipeline from raw data to business insights.',
        avatarColor: 'hsl(0,65%,45%)', onlineStatus: 'online',
      }
    },
    {
      id: crypto.randomUUID(), email: 'nina.b@demo.com', role: 'mentor',
      createdAt: now, updatedAt: now, status: 'active',
      profile: {
        name: 'Nina Bergström', role: 'Startup Founder', company: 'ClimateAI (YC W22)',
        expertise: ['Startup Founder','Fundraising','Product Management','ML Engineer','Business Strategy'],
        yearsExp: 5, mentoringStyle: ['flexible','1:1'],
        capacity: 2, timezone: 'Europe/Stockholm', availabilityHrs: 2,
        bio: 'Built a climate AI startup from zero to seed. I mentor founders and aspiring entrepreneurs on the real startup journey.',
        avatarColor: 'hsl(120,55%,35%)', onlineStatus: 'away',
      }
    },
    {
      id: crypto.randomUUID(), email: 'marcus.j@demo.com', role: 'mentor',
      createdAt: week, updatedAt: week, status: 'active',
      profile: {
        name: 'Marcus Johnson', role: 'Research Scientist', company: 'OpenAI',
        expertise: ['Research Scientist','Machine Learning','Python','NLP','TensorFlow','PyTorch'],
        yearsExp: 9, mentoringStyle: ['1:1','project'],
        capacity: 2, timezone: 'America/Chicago', availabilityHrs: 2,
        bio: 'AI researcher focused on alignment. I help PhD students and research-track students navigate academic publishing.',
        avatarColor: 'hsl(200,60%,40%)', onlineStatus: 'offline',
      }
    },
    {
      id: crypto.randomUUID(), email: 'priya.n@demo.com', role: 'mentor',
      createdAt: now, updatedAt: now, status: 'active',
      profile: {
        name: 'Priya Nair', role: 'Cloud Architect', company: 'AWS',
        expertise: ['Cloud Computing','System Design','DevOps','Kubernetes','Web Dev','API Design'],
        yearsExp: 10, mentoringStyle: ['group','async'],
        capacity: 8, timezone: 'Asia/Kolkata', availabilityHrs: 5,
        bio: 'Cloud and infra nerd. I help students master system design interviews and cloud-native architecture.',
        avatarColor: 'hsl(60,60%,35%)', onlineStatus: 'online',
      }
    },
    {
      id: crypto.randomUUID(), email: 'carlos.m@demo.com', role: 'mentor',
      createdAt: week, updatedAt: week, status: 'active',
      profile: {
        name: 'Carlos Mendoza', role: 'Cybersecurity Expert', company: 'CrowdStrike',
        expertise: ['Cybersecurity Expert','System Design','Network Security','Cloud Computing','Python'],
        yearsExp: 12, mentoringStyle: ['1:1','project'],
        capacity: 2, timezone: 'America/New_York', availabilityHrs: 3,
        bio: 'Dedicated to teaching defensive security. I guide students through building secure systems and preparing for security certifications.',
        avatarColor: 'hsl(10,65%,45%)', onlineStatus: 'offline',
      }
    },
    {
      id: crypto.randomUUID(), email: 'elena.r@demo.com', role: 'mentor',
      createdAt: now, updatedAt: now, status: 'active',
      profile: {
        name: 'Elena Rostova', role: 'Data Analyst', company: 'Airbnb',
        expertise: ['Data Analyst','SQL','Python','Data Science','Statistics'],
        yearsExp: 3, mentoringStyle: ['async','group'],
        capacity: 10, timezone: 'Europe/Berlin', availabilityHrs: 6,
        bio: 'I specialize in turning messy data into actionable insights. Happy to review your portfolios and SQL queries.',
        avatarColor: 'hsl(320,60%,40%)', onlineStatus: 'online',
      }
    },
    {
      id: crypto.randomUUID(), email: 'j.smith@demo.com', role: 'mentor',
      createdAt: week, updatedAt: week, status: 'active',
      profile: {
        name: 'James Smith', role: 'Software Engineer', company: 'Meta',
        expertise: ['Software Engineer','React','JavaScript','System Design','Web Dev'],
        yearsExp: 5, mentoringStyle: ['1:1','flexible'],
        capacity: 4, timezone: 'America/Los_Angeles', availabilityHrs: 4,
        bio: 'Frontend enthusiast. Let\'s polish your React skills and get you ready for those tough technical interviews.',
        avatarColor: 'hsl(200,80%,40%)', onlineStatus: 'away',
      }
    },
  ];

  // Generate 100 more random mentors
  const firstNames = ['Alex','Jordan','Taylor','Morgan','Casey','Jamie','Riley','Avery','Quinn','Drew','Sam','Chris','Pat','Dakota','Skyler','Jesse','Micah','Cameron','Reese','Rowan'];
  const lastNames = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin'];
  const companies = ['Google','Meta','Amazon','Netflix','Apple','Microsoft','Spotify','Airbnb','Stripe','Uber','Lyft','Twitter/X','LinkedIn','Snap','TikTok'];
  const roles = ['Software Engineer','Data Scientist','Product Manager','UX Designer','ML Engineer','Cloud Architect','Cybersecurity Expert','Research Scientist','Data Analyst','Startup Founder'];
  const allExpertise = ['Machine Learning','Python','React','Data Science','UX Design','System Design','Cloud Computing','JavaScript','Product Management','Agile','Statistics','Startup Founder','Fundraising','Web Dev','Node.js','Cybersecurity Expert','Network Security'];
  const timezones = ['America/New_York','America/Los_Angeles','America/Chicago','Europe/London','Europe/Berlin','Asia/Tokyo','Asia/Kolkata','Australia/Sydney'];
  const styles = ['1:1','async','project','group','flexible'];

  for (let i = 0; i < 100; i++) {
    const fn = firstNames[Math.floor(Math.random() * firstNames.length)];
    const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
    const role = roles[Math.floor(Math.random() * roles.length)];
    const exp = [];
    while(exp.length < 3) {
      const e = allExpertise[Math.floor(Math.random() * allExpertise.length)];
      if(!exp.includes(e)) exp.push(e);
    }
    const ms = [styles[Math.floor(Math.random() * styles.length)]];
    if(Math.random() > 0.5) ms.push(styles[Math.floor(Math.random() * styles.length)]);
    
    mentors.push({
      id: crypto.randomUUID(),
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@demo.com`,
      role: 'mentor',
      createdAt: week,
      updatedAt: now,
      status: 'active',
      profile: {
        name: `${fn} ${ln}`,
        role: role,
        company: companies[Math.floor(Math.random() * companies.length)],
        expertise: exp,
        yearsExp: 2 + Math.floor(Math.random() * 15),
        mentoringStyle: [...new Set(ms)],
        capacity: 1 + Math.floor(Math.random() * 5),
        timezone: timezones[Math.floor(Math.random() * timezones.length)],
        availabilityHrs: 2 + Math.floor(Math.random() * 8),
        bio: `Hi, I'm ${fn}! I specialize in ${exp[0]} and ${exp[1]}. I'd love to help you navigate your career and share what I've learned working as a ${role}.`,
        avatarColor: `hsl(${Math.floor(Math.random() * 360)}, 65%, 45%)`,
        onlineStatus: Math.random() > 0.7 ? 'online' : (Math.random() > 0.5 ? 'away' : 'offline'),
      }
    });
  }

  const users = {};
  for (const m of mentors) {
    users[m.email] = m;
  }

  // Admin user
  users['admin@mentor.ai'] = {
    id: crypto.randomUUID(), email: 'admin@mentor.ai', role: 'admin',
    createdAt: now, updatedAt: now, status: 'active',
    profile: { name: 'Admin', avatarColor: 'hsl(270,65%,45%)' }
  };

  write(KEYS.USERS, users);
  console.log('[store] Demo data seeded:', Object.keys(users).length, 'users');
}
