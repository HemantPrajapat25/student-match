/**
 * admin.js — Admin dashboard: user table, stats, export, match log
 */
import { getUserList, getMatches, deleteUser, saveUser, exportAll, countAllMessages } from './store.js';
import { formatDate, debounce, downloadJson, escapeHtml, timeAgo } from './utils.js';
import { showToast, animateCounter, confirm } from './ui.js';

let sortCol   = 'createdAt';
let sortDir   = 'desc';
let searchQ   = '';
let allUsers  = [];

// ── Init ──────────────────────────────────────────────────────────

/**
 * Initialise the admin page: render stats, bind events.
 */
export function initAdmin() {
  renderStats();
  loadUsers();
  renderMatchLog();
  bindAdminEvents();
}

// ── Stats ─────────────────────────────────────────────────────────

function renderStats() {
  const users    = getUserList();
  const students = users.filter(u => u.role === 'student');
  const mentors  = users.filter(u => u.role === 'mentor');
  const matches  = Object.keys(getMatches()).length;
  const msgs     = countAllMessages();
  const active   = users.filter(u => u.status === 'active').length;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) animateCounter(el, val);
  };
  set('stat-total-users',    users.length);
  set('stat-total-students', students.length);
  set('stat-total-mentors',  mentors.length);
  set('stat-total-matches',  matches);
  set('stat-total-msgs',     msgs);
  set('stat-active-users',   active);
}

// ── User Table ────────────────────────────────────────────────────

function loadUsers() {
  allUsers = getUserList().filter(u => u.role !== 'admin');
  renderTable();
}

/**
 * Build the user table.
 */
function renderTable() {
  const tbody = document.getElementById('admin-tbody');
  if (!tbody) return;

  // Filter
  let filtered = allUsers.filter(u => {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return (u.profile?.name ?? '').toLowerCase().includes(q)
      || u.email.toLowerCase().includes(q);
  });

  // Sort
  filtered.sort((a, b) => {
    let va, vb;
    if (sortCol === 'name')      { va = a.profile?.name ?? ''; vb = b.profile?.name ?? ''; }
    else if (sortCol === 'email'){ va = a.email; vb = b.email; }
    else if (sortCol === 'role') { va = a.role;  vb = b.role; }
    else                         { va = a[sortCol] ?? ''; vb = b[sortCol] ?? ''; }
    const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--stellar-muted);padding:32px">No users found</td></tr>`;
    return;
  }

  for (const user of filtered) {
    const tr  = document.createElement('tr');
    const isActive = user.status === 'active';
    tr.innerHTML = `
      <td class="col-name">${escapeHtml(user.profile?.name ?? '—')}</td>
      <td><span class="badge badge-${user.role === 'mentor' ? 'blue' : 'green'}">${user.role}</span></td>
      <td style="font-size:.8rem;color:var(--stellar-muted)">${escapeHtml(user.email)}</td>
      <td style="font-size:.8rem">${formatDate(user.createdAt)}</td>
      <td>
        <span class="badge badge-${isActive ? 'green' : 'red'}">${isActive ? 'Active' : 'Inactive'}</span>
      </td>
      <td>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-secondary btn-sm toggle-btn"
            data-email="${escapeHtml(user.email)}"
            data-active="${isActive}"
            aria-label="${isActive ? 'Deactivate' : 'Activate'} ${escapeHtml(user.profile?.name ?? user.email)}"
          >${isActive ? '🔴 Deactivate' : '🟢 Activate'}</button>
          <button class="btn btn-danger btn-sm delete-btn"
            data-email="${escapeHtml(user.email)}"
            aria-label="Delete ${escapeHtml(user.profile?.name ?? user.email)}"
          >🗑</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }

  updateSortArrows();
}

function updateSortArrows() {
  document.querySelectorAll('#admin-table th').forEach(th => {
    const col = th.dataset.col;
    th.classList.toggle('sorted', col === sortCol);
    const arrow = th.querySelector('.sort-arrow');
    if (arrow) arrow.textContent = col === sortCol ? (sortDir === 'asc' ? '↑' : '↓') : '↕';
  });
}

// ── Match Log ─────────────────────────────────────────────────────

function renderMatchLog() {
  const container = document.getElementById('match-log');
  if (!container) return;

  const matches = Object.values(getMatches());
  if (matches.length === 0) {
    container.innerHTML = '<p style="color:var(--stellar-muted);font-size:.9rem">No matches yet.</p>';
    return;
  }

  container.innerHTML = '';
  for (const m of matches.sort((a, b) => new Date(b.initiatedAt) - new Date(a.initiatedAt)).slice(0, 20)) {
    const item = document.createElement('div');
    item.style.cssText = `
      display:flex;align-items:center;justify-content:space-between;
      padding:12px 16px;background:var(--glass-bg);border:1px solid var(--glass-border);
      border-radius:8px;margin-bottom:8px;font-size:.85rem;
    `;
    item.innerHTML = `
      <div>
        <span style="color:var(--stellar-white);font-weight:600">${escapeHtml(m.studentEmail)}</span>
        <span style="color:var(--stellar-muted)"> → </span>
        <span style="color:var(--nebula-blue)">${escapeHtml(m.mentorEmail)}</span>
      </div>
      <div style="display:flex;gap:12px;align-items:center">
        <span class="badge badge-green">${m.score ?? 0}%</span>
        <span class="badge badge-${m.status === 'active' ? 'blue' : 'amber'}">${m.status}</span>
        <span style="color:var(--stellar-muted);font-size:.75rem">${timeAgo(m.initiatedAt)}</span>
      </div>
    `;
    container.appendChild(item);
  }
}

// ── Events ────────────────────────────────────────────────────────

function bindAdminEvents() {
  // Sort columns
  document.querySelectorAll('#admin-table th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = col;
        sortDir = 'asc';
      }
      renderTable();
    });
  });

  // Search
  const searchInput = document.getElementById('admin-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      searchQ = e.target.value.trim();
      renderTable();
    }, 300));
  }

  // Toggle / Delete via event delegation
  const tbody = document.getElementById('admin-tbody');
  tbody?.addEventListener('click', async (e) => {
    const toggleBtn = e.target.closest('.toggle-btn');
    const deleteBtn = e.target.closest('.delete-btn');

    if (toggleBtn) {
      const email    = toggleBtn.dataset.email;
      const wasActive = toggleBtn.dataset.active === 'true';
      const user = getUserList().find(u => u.email === email);
      if (!user) return;
      user.status = wasActive ? 'inactive' : 'active';
      saveUser(user);
      allUsers = getUserList().filter(u => u.role !== 'admin');
      renderTable();
      showToast('Status Updated', `${user.profile?.name ?? email} is now ${user.status}.`, 'success');
    }

    if (deleteBtn) {
      const email = deleteBtn.dataset.email;
      const ok    = await confirm('Delete User', `Permanently delete account for ${email}?`);
      if (ok) {
        deleteUser(email);
        allUsers = getUserList().filter(u => u.role !== 'admin');
        renderTable();
        renderStats();
        showToast('User Deleted', email, 'info');
      }
    }
  });

  // Export button
  document.getElementById('export-btn')?.addEventListener('click', () => {
    const data = exportAll();
    downloadJson(data, `mentormatch-export-${new Date().toISOString().slice(0,10)}.json`);
    showToast('Export Complete', 'Data downloaded as JSON.', 'success');
  });

  // Refresh stats
  document.getElementById('refresh-stats-btn')?.addEventListener('click', () => {
    renderStats();
    loadUsers();
    renderMatchLog();
    showToast('Refreshed', 'Dashboard data updated.', 'info');
  });
}
