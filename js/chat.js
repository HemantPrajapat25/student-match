/**
 * chat.js — Chat drawer, messaging, auto-reply
 */
import { getThread, addMessage, markThreadRead, threadId, getUser, getCurrentUser } from './store.js';
import { uuid, formatTime, timeAgo, escapeHtml } from './utils.js';
import { showToast } from './ui.js';
import { initials, stringToColor } from './utils.js';

// Simulated mentor auto-replies (rotated)
const AUTO_REPLIES = [
  "Thanks for reaching out! Happy to help — what's your biggest challenge right now?",
  "Great question! Let's set up some time to discuss this in depth.",
  "I've been in your shoes before. Here's what I'd suggest as a first step…",
  "Love the ambition! Let me share some resources that helped me early on.",
  "Absolutely, this is a great area to focus on. Can you tell me more about your background?",
];
let replyIndex = 0;

let currentMentorEmail = null;
let currentStudentEmail = null;

// ── Open/close drawer ────────────────────────────────────────────

/**
 * Open the chat drawer for a specific mentor.
 * @param {string} mentorEmail
 */
export function openChat(mentorEmail) {
  const user = getCurrentUser();
  if (!user) { showToast('Login required', 'Please log in to send messages.', 'warning'); return; }

  currentStudentEmail = user.email;
  currentMentorEmail  = mentorEmail;

  const mentor = getUser(mentorEmail);
  if (!mentor) { showToast('Error', 'Mentor not found.', 'error'); return; }

  const mp = mentor.profile ?? mentor;

  // Update header
  const nameEl    = document.getElementById('chat-mentor-name');
  const roleEl    = document.getElementById('chat-mentor-role');
  const avatarEl  = document.getElementById('chat-mentor-avatar');
  const statusDot = document.getElementById('chat-status-dot');

  if (nameEl)   nameEl.textContent  = mp.name ?? 'Mentor';
  if (roleEl)   roleEl.textContent  = `${mp.role ?? ''} @ ${mp.company ?? ''}`;
  if (avatarEl) {
    avatarEl.style.background = mp.avatarColor ?? stringToColor(mp.name ?? '');
    avatarEl.textContent = initials(mp.name ?? '');
  }
  if (statusDot) {
    const cls = { online:'status-online', away:'status-away', offline:'status-offline' }[mp.onlineStatus ?? 'offline'];
    statusDot.className = `status-dot ${cls}`;
    statusDot.title = mp.onlineStatus ?? 'offline';
  }

  // Open overlay + drawer
  const overlay = document.getElementById('chat-overlay');
  const drawer  = document.getElementById('chat-drawer');
  if (overlay) overlay.classList.add('open');
  if (drawer)  drawer.classList.add('open');

  // Mark existing messages read
  const tid = threadId(currentStudentEmail, mentorEmail);
  markThreadRead(tid, currentStudentEmail);

  // Render messages
  renderMessages();

  // Focus input
  const input = document.getElementById('chat-input');
  if (input) setTimeout(() => input.focus(), 350);
}

/**
 * Close the chat drawer.
 */
export function closeChat() {
  const overlay = document.getElementById('chat-overlay');
  const drawer  = document.getElementById('chat-drawer');
  if (overlay) overlay.classList.remove('open');
  if (drawer)  drawer.classList.remove('open');
  currentMentorEmail  = null;
  currentStudentEmail = null;
}

// ── Render messages ──────────────────────────────────────────────

/**
 * Render all messages in the current thread.
 */
export function renderMessages() {
  const container = document.getElementById('chat-messages');
  if (!container || !currentMentorEmail) return;

  const tid      = threadId(currentStudentEmail, currentMentorEmail);
  const messages = getThread(tid);
  const mentor   = getUser(currentMentorEmail);
  const mp       = mentor?.profile ?? mentor ?? {};

  container.innerHTML = '';

  if (messages.length === 0) {
    container.innerHTML = `
      <div class="chat-empty">
        <div class="chat-empty-icon">💬</div>
        <p class="chat-empty-text">Start the conversation — introduce yourself and what you're hoping to learn!</p>
      </div>
    `;
    return;
  }

  let lastDate = '';
  for (const msg of messages) {
    const msgDate = new Date(msg.sentAt).toLocaleDateString();
    if (msgDate !== lastDate) {
      const sep = document.createElement('div');
      sep.className = 'chat-date-sep';
      sep.textContent = msgDate === new Date().toLocaleDateString() ? 'Today' : msgDate;
      container.appendChild(sep);
      lastDate = msgDate;
    }
    container.appendChild(createBubble(msg, mp));
  }

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

/**
 * Create a single message bubble element.
 * @param {Object} msg
 * @param {Object} mp - Mentor profile
 * @returns {HTMLElement}
 */
function createBubble(msg, mp) {
  const isSent  = msg.senderEmail === currentStudentEmail;
  const row     = document.createElement('div');
  row.className = `msg-row ${isSent ? 'sent' : 'received'}`;

  const avatarEl = document.createElement('div');
  avatarEl.className = 'msg-avatar';
  avatarEl.style.background = isSent ? '#1a6cf6' : (mp.avatarColor ?? '#7c3aed');
  avatarEl.textContent = isSent ? initials(getCurrentUser()?.profile?.name ?? 'Me')
                                : initials(mp.name ?? 'M');

  const content  = document.createElement('div');
  content.className = 'msg-content';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.textContent = msg.text;

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  meta.innerHTML = `
    <span>${formatTime(msg.sentAt)}</span>
    ${isSent ? `<div class="msg-read"><span></span><span style="opacity:${msg.read?1:0.4}"></span></div>` : ''}
  `;

  content.appendChild(bubble);
  content.appendChild(meta);

  row.appendChild(isSent ? content : avatarEl);
  row.appendChild(isSent ? avatarEl : content);

  return row;
}

// ── Send message ─────────────────────────────────────────────────

/**
 * Send a message in the current thread.
 * @param {string} text
 */
export function sendMessage(text) {
  if (!text.trim() || !currentMentorEmail || !currentStudentEmail) return;

  const tid = threadId(currentStudentEmail, currentMentorEmail);
  const msg = {
    id:          uuid(),
    threadId:    tid,
    senderEmail: currentStudentEmail,
    text:        text.trim(),
    sentAt:      new Date().toISOString(),
    read:        false,
  };

  addMessage(tid, msg);
  renderMessages();

  // Show typing indicator then auto-reply
  showTypingIndicator();
  setTimeout(() => {
    removeTypingIndicator();
    simulateReply(tid);
  }, 1500 + Math.random() * 1000);
}

function showTypingIndicator() {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const typing = document.createElement('div');
  typing.id = 'typing-indicator';
  typing.className = 'msg-row received typing-indicator';
  const mentor = getUser(currentMentorEmail);
  const mp = mentor?.profile ?? mentor ?? {};
  typing.innerHTML = `
    <div class="msg-avatar" style="background:${mp.avatarColor ?? '#7c3aed'}">${initials(mp.name ?? 'M')}</div>
    <div class="msg-content">
      <div class="msg-bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  container.appendChild(typing);
  container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator() {
  document.getElementById('typing-indicator')?.remove();
}

/**
 * Append a simulated auto-reply from the mentor.
 * @param {string} tid
 */
function simulateReply(tid) {
  const reply = AUTO_REPLIES[replyIndex % AUTO_REPLIES.length];
  replyIndex++;

  const msg = {
    id:          uuid(),
    threadId:    tid,
    senderEmail: currentMentorEmail,
    text:        reply,
    sentAt:      new Date().toISOString(),
    read:        true,
  };
  addMessage(tid, msg);
  renderMessages();
}

// ── Clear thread ─────────────────────────────────────────────────

/**
 * Clear the current chat thread after confirmation.
 */
export async function clearChat() {
  const { confirm: confirmFn } = await import('./ui.js');
  const ok = await confirmFn('Clear Chat', 'Delete all messages with this mentor?');
  if (!ok) return;

  const { clearThread } = await import('./store.js');
  const tid = threadId(currentStudentEmail, currentMentorEmail);
  clearThread(tid);
  renderMessages();
  showToast('Chat Cleared', 'All messages deleted.', 'info');
}

// ── Initialise chat drawer ────────────────────────────────────────

/**
 * Attach all event listeners for the chat drawer.
 * Should be called once per page that includes the chat drawer HTML.
 */
export function initChat() {
  const overlay  = document.getElementById('chat-overlay');
  const sendBtn  = document.getElementById('chat-send-btn');
  const input    = document.getElementById('chat-input');
  const clearBtn = document.getElementById('chat-clear-btn');
  const closeBtn = document.getElementById('chat-close-btn');

  overlay?.addEventListener('click', closeChat);
  closeBtn?.addEventListener('click', closeChat);
  clearBtn?.addEventListener('click', clearChat);

  sendBtn?.addEventListener('click', () => {
    if (input?.value.trim()) {
      sendMessage(input.value);
      input.value = '';
      input.style.height = 'auto';
    }
  });

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.value.trim()) {
        sendMessage(input.value);
        input.value = '';
        input.style.height = 'auto';
      }
    }
    // Auto-resize
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('chat-drawer')?.classList.contains('open')) {
      closeChat();
    }
  });

  // Listen for open requests from card buttons
  document.addEventListener('openChat', (e) => {
    openChat(e.detail.mentorEmail);
  });
}
