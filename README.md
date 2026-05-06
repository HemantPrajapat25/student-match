# 🚀 MentorMatch Orbit — AI-Driven Mentorship Matching System

> **ANTIGRAVITY** space-themed, fully offline mentorship platform. Zero dependencies. Open `index.html` to launch.

## ▶️ Quick Start

1. Clone or download this folder
2. Open `index.html` in any modern browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
3. No server, no npm, no build step required

## 🌟 Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Dual Registration** | Students & Mentors create rich profiles with multi-step wizard |
| 2 | **Smart Filters** | Collapsible sidebar with reactive, no-refresh filtering |
| 3 | **AI Matching Engine** | Weighted 100-pt scoring across 6 compatibility dimensions |
| 4 | **Real-time Chat** | Slide-in drawer with auto-reply simulation & unread badges |
| 5 | **Admin Dashboard** | Hardcoded admin login, user table, match log, JSON export |
| 6 | **Live Status** | Online/Away/Offline cycling every 90s, notification bell |
| 7 | **Discovery Page** | Floating cards, SVG score rings, infinite load-more |
| 8 | **Profile Dashboards** | Edit-in-place, bookmarks, completion bar, top-match spotlight |

## 📁 File Structure

```
mentorship-app/
├── index.html           Landing page with particle starfield
├── register.html        3-step registration wizard
├── dashboard.html       Student / Mentor personal dashboard
├── discover.html        Discovery + matching page
├── admin.html           Admin control center
├── styles/
│   ├── global.css       CSS variables, reset, typography
│   ├── components.css   Cards, buttons, forms, badges
│   ├── animations.css   Antigravity keyframes
│   ├── dashboard.css    Sidebar layout
│   └── chat.css         Chat drawer & bubbles
└── js/
    ├── main.js          App init & page bootstrap
    ├── auth.js          Login, register, session
    ├── store.js         localStorage abstraction
    ├── matcher.js       Scoring & ranking engine
    ├── chat.js          Chat drawer & messaging
    ├── admin.js         Admin table & export
    ├── ui.js            Toast, modal, card builder
    ├── validation.js    Form validators
    ├── particles.js     Canvas star field
    └── utils.js         Utilities (uuid, debounce…)
```

## 🔐 Demo Credentials

**Admin Login:**
- Email: `admin@mentor.ai`
- Password: `admin123`

## 🎨 Design System

- **Font:** Orbitron (headings) + Exo 2 (body) — Google Fonts
- **Background:** `#050a14` (void-black)
- **Primary:** `#1a6cf6` (nebula-blue)
- **Accent:** `#00f5a0` (aurora-green)
- **Purple:** `#7c3aed` (deep-purple)
- **Text:** `#e8f4ff` (stellar-white)

## ⚖️ Matching Algorithm Weights

```
Field match       20 pts   Exact / partial / none
Goal alignment    25 pts   Overlapping career goals
Skill coverage    25 pts   % of desired skills mentor offers
Style match       10 pts   Mentoring style compatibility
Timezone          10 pts   Same / ±3h / ±6h / else
Availability      10 pts   Student hrs ≤ mentor capacity
                ─────────
Total            100 pts
```

## 🔒 Privacy & Bias

- Name, gender, photo, nationality **never factored** into scoring
- Equal-score mentors are **randomly shuffled** (no alphabetical bias)
- Console warns if < 3 mentors score above 40%

## 📦 Data Storage

All data persists in `localStorage`. Clear with:
```js
localStorage.clear(); // in browser console
```
