/**
 * main.js — App initialisation, routing, status cycling
 */
import { seedDemoData, getCurrentUser, getUserList, getMatches } from './store.js';
import { showToast, updateNotifBell } from './ui.js';
import { countUnread } from './store.js';

// ── Bootstrap ─────────────────────────────────────────────────────

/**
 * Run once per page load. Seeds data, sets active nav, starts status cycle.
 */
export async function init() {
  // 1. Seed demo mentors if empty
  await seedDemoData();

  // 2. Mark active nav link
  setActiveNav();

  // 3. Status cycling every 90 s
  startStatusCycle();

  // 4. Notification bell
  updateBell();
  setInterval(updateBell, 15_000);

  // 5. Global toast container guard
  if (!document.getElementById('toast-container')) {
    const tc = document.createElement('div');
    tc.id = 'toast-container';
    tc.setAttribute('aria-live', 'polite');
    document.body.appendChild(tc);
  }

  // 6. Keyboard shortcut: Escape closes any overlay
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.confirm-overlay.open, #mentor-modal-overlay.open')
        .forEach(el => el.classList.remove('open'));
    }
  });
}

// ── Active nav ────────────────────────────────────────────────────

function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link, .sidebar-nav-item').forEach(link => {
    const href = link.getAttribute('href') ?? '';
    link.classList.toggle('active', href === page || href.includes(page));
  });
}

// ── Status cycling ────────────────────────────────────────────────

const STATUS_WEIGHTS = [
  { s: 'online',  w: 40 },
  { s: 'away',    w: 30 },
  { s: 'offline', w: 30 },
];

function weightedStatus() {
  const r = Math.random() * 100;
  let acc = 0;
  for (const { s, w } of STATUS_WEIGHTS) {
    acc += w;
    if (r < acc) return s;
  }
  return 'offline';
}

/**
 * Cycle mentor online statuses every 90 seconds.
 * Also updates the "X mentors available now" counter if present.
 */
export function startStatusCycle() {
  const cycle = () => {
    const mentors = getUserList('mentor');
    for (const mentor of mentors) {
      mentor.profile.onlineStatus = weightedStatus();
      // Persist without importing saveUser to avoid circular deps at top level
      try {
        const raw   = localStorage.getItem('mm_users') ?? '{}';
        const users = JSON.parse(raw);
        if (users[mentor.email]) {
          users[mentor.email].profile.onlineStatus = mentor.profile.onlineStatus;
        }
        localStorage.setItem('mm_users', JSON.stringify(users));
      } catch { /* silent */ }
    }

    // Update live counter on dashboard
    const onlineCount = mentors.filter(m => m.profile.onlineStatus === 'online').length;
    const counterEl   = document.getElementById('online-mentor-count');
    if (counterEl) counterEl.textContent = onlineCount;

    // Update status dots on any visible cards
    document.querySelectorAll('.mentor-card[data-email]').forEach(card => {
      const email  = card.dataset.email;
      const mentor = mentors.find(m => m.email === email);
      if (!mentor) return;
      const dot = card.querySelector('.status-dot');
      if (!dot) return;
      dot.className = `status-dot status-${mentor.profile.onlineStatus}${mentor.profile.onlineStatus === 'online' ? ' pulse-dot' : ''}`;
      dot.title = mentor.profile.onlineStatus;
    });
  };

  cycle(); // run immediately
  setInterval(cycle, 90_000);
}

// ── Notification bell ─────────────────────────────────────────────

function updateBell() {
  const user = getCurrentUser();
  if (!user) return;
  const unread = countUnread(user.email);
  updateNotifBell(unread);
}

// ── Check URL params (e.g. ?success=registered) ──────────────────

export function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('success') === 'registered') {
    showToast('Welcome to MentorMatch Orbit! 🚀', 'Your profile has been created.', 'success', 5000);
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
  }
  if (params.get('success') === 'login') {
    showToast('Welcome back!', '', 'success', 3000);
    window.history.replaceState({}, '', window.location.pathname);
  }
}

// Auto-init on import (pages call init() explicitly after DOM ready)
