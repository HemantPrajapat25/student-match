/**
 * ui.js — Toast, Mentor Card builder, modals, helpers
 */
import { initials, stringToColor, escapeHtml, formatDate, timeAgo, triggerAnimation } from './utils.js';
import { getOverlappingSkills } from './matcher.js';
import { toggleBookmark, isBookmarked, getSession } from './store.js';

// ── Toast Notifications ──────────────────────────────────────────

/**
 * Show a toast notification.
 * @param {string} title
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {number} duration - ms before auto-dismiss
 */
export function showToast(title, message = '', type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: '🚀', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type} toast-enter`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] ?? 'ℹ️'}</span>
    <div class="toast-body">
      <div class="toast-title">${escapeHtml(title)}</div>
      ${message ? `<div class="toast-msg">${escapeHtml(message)}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Dismiss notification">×</button>
  `;

  const dismiss = () => {
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  toast.querySelector('.toast-close').addEventListener('click', dismiss);
  container.appendChild(toast);
  setTimeout(dismiss, duration);
}

// Expose globally for store.js error fallback
window.__showErrorToast = (msg) => showToast('Storage Error', msg, 'error');

// ── Score Ring SVG ───────────────────────────────────────────────

/**
 * Create an animated SVG compatibility score ring.
 * @param {number} score - 0 to 100
 * @returns {HTMLElement}
 */
export function createScoreRing(score) {
  const radius      = 28;
  const circumference = 2 * Math.PI * radius; // ≈ 175.9 for r=28
  const clampedScore  = Math.min(Math.max(score, 0), 100);
  const dashOffset    = circumference - (clampedScore / 100) * circumference;

  const color = score >= 75 ? '#00f5a0'
    : score >= 50 ? '#1a6cf6'
    : score >= 30 ? '#f59e0b'
    : '#ff4560';

  const wrapper = document.createElement('div');
  wrapper.className = 'score-ring-wrapper';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '72');
  svg.setAttribute('height', '72');
  svg.setAttribute('viewBox', '0 0 72 72');
  svg.setAttribute('class', 'score-ring-svg');
  svg.setAttribute('aria-label', `Compatibility score: ${score}%`);

  svg.innerHTML = `
    <defs>
      <linearGradient id="sg${score}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
        <stop offset="100%" style="stop-color:#1a6cf6;stop-opacity:1" />
      </linearGradient>
    </defs>
    <circle class="score-ring-bg"
      cx="36" cy="36" r="${radius}"
      stroke-width="5" fill="none" stroke="rgba(255,255,255,0.07)"
    />
    <circle class="score-ring-fill"
      cx="36" cy="36" r="${radius}"
      stroke-width="5" fill="none"
      stroke="url(#sg${score})"
      stroke-linecap="round"
      stroke-dasharray="${circumference}"
      stroke-dashoffset="${circumference}"
      transform="rotate(-90 36 36)"
    />
    <text x="36" y="40" text-anchor="middle"
      font-family="'Orbitron',monospace" font-size="11" font-weight="700"
      fill="${color}">${clampedScore}%</text>
  `;

  wrapper.appendChild(svg);

  // Animate on mount after a tick
  setTimeout(() => {
    const ring = svg.querySelector('.score-ring-fill');
    if (ring) {
      ring.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)';
      ring.style.strokeDashoffset = dashOffset;
    }
  }, 100);

  return wrapper;
}

// ── Avatar ───────────────────────────────────────────────────────

/**
 * Create an avatar element with optional orbital ring.
 * @param {string} name
 * @param {string} color
 * @param {string} size - 'sm'|'md'|'lg'
 * @param {boolean} orbital - Add orbital ring animation
 * @returns {HTMLElement}
 */
export function createAvatar(name, color, size = 'md', orbital = false) {
  const wrapper = document.createElement('div');
  wrapper.className = 'avatar-wrapper';

  const av = document.createElement('div');
  const sizeClass = size === 'lg' ? 'avatar-lg' : size === 'xl' ? 'avatar-xl' : '';
  av.className = `avatar ${sizeClass}`;
  av.style.background = color || stringToColor(name);
  av.textContent = initials(name);
  wrapper.appendChild(av);

  if (orbital) {
    const ring1 = document.createElement('div');
    ring1.className = 'orbit-ring';
    wrapper.appendChild(ring1);
    const ring2 = document.createElement('div');
    ring2.className = 'orbit-ring-2';
    wrapper.appendChild(ring2);
  }

  return wrapper;
}

// ── Mentor Card ──────────────────────────────────────────────────

/**
 * Build a full mentor card DOM element.
 * @param {Object} mentor   - Full mentor user object (with .profile)
 * @param {Object} matchData - { score, breakdown } from matchScore()
 * @param {Object} student  - Current student user (for bookmark state)
 * @returns {HTMLElement}
 */
export function createMentorCard(mentor, matchData, student = null) {
  const mp     = mentor.profile ?? mentor;
  const score  = matchData?.score ?? 0;
  const status = mp.onlineStatus ?? 'offline';

  const statusMap = {
    online:  { cls: 'status-online',  label: 'Online',  icon: '🟢' },
    away:    { cls: 'status-away',    label: 'Away',    icon: '🟡' },
    offline: { cls: 'status-offline', label: 'Offline', icon: '⚪' },
  };
  const statusInfo = statusMap[status] ?? statusMap.offline;

  const card = document.createElement('article');
  card.className = 'mentor-card repel-card';
  card.setAttribute('role', 'article');
  card.setAttribute('aria-label', `${mp.name}, ${score}% compatibility`);
  card.dataset.email = mentor.email;

  // ── Bookmark button ──
  const studentEmail = student?.email ?? getSession();
  const saved = studentEmail ? isBookmarked(studentEmail, mentor.email) : false;

  const bmBtn = document.createElement('button');
  bmBtn.className = `btn-bookmark${saved ? ' saved' : ''}`;
  bmBtn.setAttribute('aria-label', saved ? 'Remove bookmark' : 'Bookmark mentor');
  bmBtn.setAttribute('title', saved ? 'Remove bookmark' : 'Save mentor');
  bmBtn.innerHTML = saved ? '★' : '☆';
  bmBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!studentEmail) { showToast('Login required', 'Please log in to save mentors.', 'warning'); return; }
    const nowSaved = toggleBookmark(studentEmail, mentor.email);
    bmBtn.innerHTML = nowSaved ? '★' : '☆';
    bmBtn.classList.toggle('saved', nowSaved);
    bmBtn.setAttribute('aria-label', nowSaved ? 'Remove bookmark' : 'Bookmark mentor');
    triggerAnimation(bmBtn, 'gravity-bounce');
    showToast(nowSaved ? 'Mentor Saved' : 'Bookmark Removed', mp.name, nowSaved ? 'success' : 'info');
  });
  card.appendChild(bmBtn);

  // ── Card header ──
  const header = document.createElement('div');
  header.className = 'card-header';

  // Avatar
  const avatarEl = createAvatar(mp.name, mp.avatarColor, 'md', true);
  header.appendChild(avatarEl);

  // Info
  const info = document.createElement('div');
  info.className = 'card-info';
  info.innerHTML = `
    <div class="card-name">${escapeHtml(mp.name)}</div>
    <div class="card-role">${escapeHtml(mp.role ?? '')}</div>
    <div class="card-company">${escapeHtml(mp.company ?? '')}</div>
  `;
  header.appendChild(info);

  // Score ring
  header.appendChild(createScoreRing(score));
  card.appendChild(header);

  // ── Skills chips ──
  const skillsRow = document.createElement('div');
  skillsRow.className = 'card-skills';

  // Overlapping skills highlighted
  const overlapping = student ? getOverlappingSkills(student, mentor) : [];
  const allSkills = mp.expertise?.slice(0, 5) ?? [];
  allSkills.forEach(skill => {
    const chip = document.createElement('span');
    chip.className = `chip${overlapping.some(o => o.toLowerCase() === skill.toLowerCase()) ? ' highlight' : ''}`;
    chip.textContent = skill;
    skillsRow.appendChild(chip);
  });
  card.appendChild(skillsRow);

  // ── Meta row ──
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  meta.innerHTML = `
    <div class="card-status">
      <span class="status-dot ${statusInfo.cls} ${status === 'online' ? 'pulse-dot' : ''}"
        title="${statusInfo.label}" aria-label="${statusInfo.label}"></span>
      <span>${statusInfo.label}</span>
    </div>
    <span class="badge badge-blue">${mp.availabilityHrs ?? 0}h/wk</span>
  `;
  card.appendChild(meta);

  // Unread dot placeholder (chat.js will set this)
  const unreadDot = document.createElement('div');
  unreadDot.className = 'unread-dot';
  unreadDot.id = `unread-${mentor.email.replace('@','').replace('.','')}-dot`;
  unreadDot.style.display = 'none';
  card.appendChild(unreadDot);

  // ── Action buttons ──
  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const connectBtn = document.createElement('button');
  connectBtn.className = 'btn btn-primary btn-sm';
  connectBtn.innerHTML = '💬 Message';
  connectBtn.setAttribute('aria-label', `Send message to ${mp.name}`);
  connectBtn.addEventListener('click', () => {
    triggerAnimation(connectBtn, 'gravity-bounce');
    // Chat drawer opened by chat.js listener
    document.dispatchEvent(new CustomEvent('openChat', { detail: { mentorEmail: mentor.email } }));
  });

  const profileBtn = document.createElement('button');
  profileBtn.className = 'btn btn-secondary btn-sm';
  profileBtn.innerHTML = '👤 Profile';
  profileBtn.setAttribute('aria-label', `View ${mp.name}'s profile`);
  profileBtn.addEventListener('click', () => {
    showMentorModal(mentor, matchData, student);
  });

  actions.appendChild(connectBtn);
  actions.appendChild(profileBtn);
  card.appendChild(actions);

  // ── Hover physics (repel/attract) ──
  attachCardPhysics(card);

  return card;
}

// ── Card Physics (repel on hover) ────────────────────────────────

/**
 * Attach a subtle mouse-proximity repel effect to a card.
 * @param {HTMLElement} card
 */
function attachCardPhysics(card) {
  card.addEventListener('mousemove', (e) => {
    const rect   = card.getBoundingClientRect();
    const cx     = rect.left + rect.width / 2;
    const cy     = rect.top  + rect.height / 2;
    const dx     = (e.clientX - cx) / (rect.width / 2);
    const dy     = (e.clientY - cy) / (rect.height / 2);
    const tiltX  = dy * -5;
    const tiltY  = dx * 5;
    card.style.transform = `translateY(-8px) scale(1.02) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
  });
}

// ── Mentor Detail Modal ──────────────────────────────────────────

/**
 * Show a full-detail modal for a mentor.
 * @param {Object} mentor
 * @param {Object} matchData
 * @param {Object} student
 */
export function showMentorModal(mentor, matchData, student) {
  const mp    = mentor.profile ?? mentor;
  const score = matchData?.score ?? 0;
  const bd    = matchData?.breakdown ?? {};

  let overlay = document.getElementById('mentor-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'mentor-modal-overlay';
    overlay.className = 'confirm-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', `${mp.name} profile`);
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="confirm-dialog" style="max-width:520px;width:92%">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
        <div style="position:relative;flex-shrink:0">
          <div class="avatar avatar-lg" style="background:${mp.avatarColor}">${initials(mp.name)}</div>
          <div class="orbit-ring"></div>
        </div>
        <div>
          <h3 style="font-size:1.25rem;color:var(--stellar-white)">${escapeHtml(mp.name)}</h3>
          <p style="font-size:.9rem;color:var(--stellar-dim)">${escapeHtml(mp.role ?? '')} @ ${escapeHtml(mp.company ?? '')}</p>
          <div style="display:flex;gap:8px;margin-top:6px">
            <span class="badge badge-blue">${score}% match</span>
            <span class="badge badge-green">${mp.yearsExp ?? 0} yrs exp</span>
          </div>
        </div>
      </div>
      <p style="font-size:.9rem;color:var(--stellar-dim);margin-bottom:16px">${escapeHtml(mp.bio ?? '')}</p>
      <div style="margin-bottom:16px">
        <div class="filter-group-title">Expertise</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${(mp.expertise ?? []).map(e => `<span class="chip">${escapeHtml(e)}</span>`).join('')}
        </div>
      </div>
      <div style="margin-bottom:20px">
        <div class="filter-group-title">Score Breakdown</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.8rem;">
          ${Object.entries(bd).map(([k,v]) => `
            <div style="display:flex;justify-content:space-between;padding:6px 10px;background:var(--glass-bg);border-radius:6px;border:1px solid var(--glass-border)">
              <span style="color:var(--stellar-muted);text-transform:capitalize">${k}</span>
              <span style="color:var(--aurora-green);font-weight:700">${v} pts</span>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="confirm-actions">
        <button class="btn btn-secondary" id="modal-close-btn">Close</button>
        <button class="btn btn-primary" id="modal-msg-btn">💬 Send Message</button>
      </div>
    </div>
  `;

  overlay.classList.add('open');

  const close = () => { overlay.classList.remove('open'); };
  overlay.querySelector('#modal-close-btn').addEventListener('click', close);
  overlay.querySelector('#modal-msg-btn').addEventListener('click', () => {
    close();
    document.dispatchEvent(new CustomEvent('openChat', { detail: { mentorEmail: mentor.email } }));
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }, { once: true });
}

// ── Empty State ──────────────────────────────────────────────────

/**
 * Create an empty-state astronaut element.
 * @param {string} title
 * @param {string} subtitle
 * @returns {HTMLElement}
 */
export function createEmptyState(title = 'Nothing here', subtitle = '') {
  const el = document.createElement('div');
  el.className = 'empty-state';
  el.innerHTML = `
    <svg class="float" width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="55" r="28" fill="none" stroke="var(--stellar-muted)" stroke-width="2"/>
      <circle cx="60" cy="42" r="14" fill="var(--glass-bg)" stroke="var(--nebula-blue)" stroke-width="1.5"/>
      <rect x="40" y="68" width="40" height="26" rx="8" fill="var(--glass-bg)" stroke="var(--stellar-muted)" stroke-width="1.5"/>
      <line x1="40" y1="68" x2="28" y2="90" stroke="var(--stellar-muted)" stroke-width="2" stroke-linecap="round"/>
      <line x1="80" y1="68" x2="92" y2="90" stroke="var(--stellar-muted)" stroke-width="2" stroke-linecap="round"/>
      <line x1="53" y1="94" x2="47" y2="114" stroke="var(--stellar-muted)" stroke-width="2" stroke-linecap="round"/>
      <line x1="67" y1="94" x2="73" y2="114" stroke="var(--stellar-muted)" stroke-width="2" stroke-linecap="round"/>
      <ellipse cx="60" cy="110" rx="20" ry="4" fill="none" stroke="var(--nebula-blue)" stroke-width="1" opacity="0.4"/>
      <circle cx="43" cy="43" r="1.5" fill="var(--aurora-green)" opacity="0.8"/>
      <circle cx="77" cy="43" r="1.5" fill="var(--aurora-green)" opacity="0.8"/>
      <path d="M52 50 Q60 56 68 50" fill="none" stroke="var(--stellar-dim)" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <p class="empty-title">${escapeHtml(title)}</p>
    <p class="empty-subtitle">${escapeHtml(subtitle)}</p>
  `;
  return el;
}

// ── Notification Bell ────────────────────────────────────────────

/**
 * Update the notification bell count badge.
 * @param {number} count
 */
export function updateNotifBell(count) {
  const badge = document.getElementById('notif-count');
  if (!badge) return;
  badge.textContent = count > 99 ? '99+' : count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

// ── Confirmation Dialog ──────────────────────────────────────────

/**
 * Show a confirmation dialog and return a Promise<boolean>.
 * @param {string} title
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export function confirm(title, text) {
  return new Promise(resolve => {
    let overlay = document.getElementById('confirm-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'confirm-overlay';
      overlay.className = 'confirm-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <h4 class="confirm-title">${escapeHtml(title)}</h4>
        <p class="confirm-text">${escapeHtml(text)}</p>
        <div class="confirm-actions">
          <button class="btn btn-secondary" id="confirm-no">Cancel</button>
          <button class="btn btn-danger"    id="confirm-yes">Confirm</button>
        </div>
      </div>
    `;
    overlay.classList.add('open');
    const close = (val) => { overlay.classList.remove('open'); resolve(val); };
    overlay.querySelector('#confirm-yes').addEventListener('click', () => close(true));
    overlay.querySelector('#confirm-no').addEventListener('click',  () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
  });
}

// ── Live counter update ──────────────────────────────────────────

/**
 * Animate a number counting up (for stat cards).
 * @param {HTMLElement} el
 * @param {number} target
 * @param {number} duration - ms
 */
export function animateCounter(el, target, duration = 1200) {
  if (!el) return;
  const start = performance.now();
  const step  = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(eased * target).toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
