/**
 * utils.js — Core utility functions for MentorMatch Orbit
 * Exported as ES6 module. Zero external dependencies.
 */

/**
 * Generate a UUID v4 using the browser's crypto API.
 * @returns {string} UUID string e.g. "550e8400-e29b-41d4-a716-446655440000"
 */
export function uuid() {
  return crypto.randomUUID();
}

/**
 * Create a debounced version of a function.
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Format a Date or ISO string into a human-readable form.
 * @param {string|Date} dateVal - Date to format
 * @param {object} opts - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDate(dateVal, opts = {}) {
  try {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    const options = {
      year: 'numeric', month: 'short', day: 'numeric',
      ...opts
    };
    return new Intl.DateTimeFormat('en-US', options).format(d);
  } catch {
    return 'Unknown date';
  }
}

/**
 * Format a timestamp as "HH:MM AM/PM".
 * @param {string|Date} dateVal
 * @returns {string}
 */
export function formatTime(dateVal) {
  try {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(d);
  } catch {
    return '';
  }
}

/**
 * Return initials from a full name (up to 2 chars).
 * @param {string} name
 * @returns {string} e.g. "John Doe" → "JD"
 */
export function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Generate a deterministic HSL color from a string (for avatars).
 * @param {string} seed - Any string
 * @returns {string} HSL color string
 */
export function stringToColor(seed = '') {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}

/**
 * Escape HTML to prevent XSS when injecting user content.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Clamp a number between min and max.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Check if a date string is within N days of today.
 * @param {string} isoDate
 * @param {number} days
 * @returns {boolean}
 */
export function isWithinDays(isoDate, days) {
  try {
    const then = new Date(isoDate).getTime();
    const now  = Date.now();
    return (now - then) < (days * 24 * 60 * 60 * 1000);
  } catch { return false; }
}

/**
 * Format bytes to human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes < 1024)         return bytes + ' B';
  if (bytes < 1024 * 1024)  return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Shuffle an array in-place using Fisher–Yates.
 * @param {Array} arr
 * @returns {Array} same array, shuffled
 */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Relative time: "2 min ago", "3 days ago", etc.
 * @param {string|Date} dateVal
 * @returns {string}
 */
export function timeAgo(dateVal) {
  try {
    const diff = Date.now() - new Date(dateVal).getTime();
    const secs  = Math.floor(diff / 1000);
    const mins  = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    const days  = Math.floor(hours / 24);
    if (secs < 60)   return 'just now';
    if (mins < 60)   return `${mins}m ago`;
    if (hours < 24)  return `${hours}h ago`;
    if (days < 7)    return `${days}d ago`;
    return formatDate(dateVal, { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

/**
 * Simulate async delay (replaces fetch for demo data).
 * @param {*} data - Data to resolve with
 * @param {number} ms - Delay in ms
 * @returns {Promise<*>}
 */
export function fakeDelay(data, ms = 400) {
  return new Promise(resolve => setTimeout(() => resolve(data), ms));
}

/**
 * Trigger a CSS class on an element for one animation cycle.
 * @param {HTMLElement} el
 * @param {string} cls - CSS class to add
 */
export function triggerAnimation(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth; // force reflow
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

/**
 * Download a JSON object as a file.
 * @param {object} data
 * @param {string} filename
 */
export function downloadJson(data, filename = 'export.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** List of common IANA timezone strings for the select dropdown. */
export const TIMEZONES = [
  'UTC',
  'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'America/Toronto','America/Vancouver','America/Sao_Paulo','America/Mexico_City',
  'Europe/London','Europe/Paris','Europe/Berlin','Europe/Madrid','Europe/Rome',
  'Europe/Amsterdam','Europe/Stockholm','Europe/Warsaw','Europe/Kiev',
  'Europe/Moscow','Asia/Dubai','Asia/Kolkata','Asia/Dhaka','Asia/Bangkok',
  'Asia/Singapore','Asia/Shanghai','Asia/Tokyo','Asia/Seoul',
  'Australia/Sydney','Australia/Melbourne','Pacific/Auckland','Africa/Cairo',
  'Africa/Lagos','Africa/Nairobi',
];
