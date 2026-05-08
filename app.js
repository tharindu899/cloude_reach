/* ═══════════════════════════════════════════════════════
   Claude Account Tracker — APP
   Depends on: config.js (must be loaded first)
   ═══════════════════════════════════════════════════════ */

'use strict';

// ── Destructure config ───────────────────────────────────
const {
  appName, appTagline,
  defaultResetHours, holdMs,
  storageKey, resetStorageKey,
  accounts: DEFAULT_ACCOUNTS,
} = CONFIG;

const TOTAL = DEFAULT_ACCOUNTS.length;

// ── Runtime state ────────────────────────────────────────
let activeFilter = 'all';
let resetHours   = parseFloat(localStorage.getItem(resetStorageKey) || defaultResetHours);

// ── Persistence ──────────────────────────────────────────
function loadAccounts() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && Array.isArray(saved) && saved.length === TOTAL) {
      return saved.map((s, i) => ({
        name:       DEFAULT_ACCOUNTS[i].name,
        email:      DEFAULT_ACCOUNTS[i].email,
        locked:     s.locked    || false,
        lockTime:   s.lockTime  || null,
        unlockTime: s.unlockTime|| null,
        notes:      s.notes     || '',
      }));
    }
  } catch (_) {}
  return DEFAULT_ACCOUNTS.map(a => ({
    name: a.name, email: a.email,
    locked: false, lockTime: null, unlockTime: null, notes: '',
  }));
}

function save() { localStorage.setItem(storageKey, JSON.stringify(accounts)); }

let accounts = loadAccounts();

// ── Helpers ──────────────────────────────────────────────
const $ = id => document.getElementById(id);

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts), n = new Date();
  if (d.toDateString() === n.toDateString()) return 'Today';
  const tom = new Date(n); tom.setDate(tom.getDate() + 1);
  if (d.toDateString() === tom.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtCountdown(ms) {
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function tsToLocal(ts) {
  const d = new Date(ts || Date.now());
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── Toast ────────────────────────────────────────────────
let toastTimer;
function showToast(msg, color = 'green') {
  const el = $('toast');
  const palette = {
    green:  { bg: 'rgba(16,217,126,0.12)',  border: 'rgba(16,217,126,0.3)',  text: 'var(--green)' },
    red:    { bg: 'rgba(255,83,112,0.12)',   border: 'rgba(255,83,112,0.3)',  text: 'var(--red)'   },
    purple: { bg: 'rgba(139,92,246,0.12)',   border: 'rgba(139,92,246,0.3)', text: 'var(--accent2)'},
  };
  const p = palette[color] || palette.green;
  el.textContent      = msg;
  el.style.background = p.bg;
  el.style.borderColor= p.border;
  el.style.color      = p.text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ── Live clock ───────────────────────────────────────────
function updateClock() {
  const el = $('live-clock');
  if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

// ── Hold-to-confirm ──────────────────────────────────────
function makeHoldButton(btn, callback) {
  let holdTimer = null;

  function startHold(e) {
    if (btn.disabled) return;
    e.preventDefault();
    btn.classList.add('holding');
    holdTimer = setTimeout(() => {
      btn.classList.remove('holding');
      callback();
    }, holdMs);
  }

  function cancelHold() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    btn.classList.remove('holding');
  }

  btn.addEventListener('pointerdown',  startHold);
  btn.addEventListener('pointerup',    cancelHold);
  btn.addEventListener('pointerleave', cancelHold);
  btn.addEventListener('pointercancel',cancelHold);
  btn.addEventListener('click', e => e.preventDefault());
}

// ── SVG icons (inline, no external dependency) ───────────
const ICONS = {
  check:    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  lock:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  lockOpen: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,
  bolt:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  email:    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  copy:     `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
};

// ── Build card HTML ───────────────────────────────────────
function cardHTML(acc, i) {
  return `
    <div class="card-glow" id="glow-${i}"></div>

    <div class="card-header">
      <div class="acct-info">
        <div class="acct-name">${esc(acc.name)}</div>
        <div class="acct-pos">Account #${i + 1}</div>
      </div>
      <span class="badge badge-active" id="badge-${i}">
        <span class="badge-dot dot-green" id="dot-${i}"></span>
        <span id="badge-txt-${i}">ACTIVE</span>
      </span>
    </div>

    <div class="email-chip">
      <span class="email-icon">${ICONS.email}</span>
      <span class="email-text" title="${esc(acc.email)}">${esc(acc.email)}</span>
      <button class="copy-btn" id="copy-${i}" title="Copy email">${ICONS.copy}</button>
    </div>

    <div class="progress-wrap">
      <div class="progress-bar" id="prog-${i}"></div>
    </div>

    <div class="unlock-row">
      <span class="unlock-label">Unlocks at</span>
      <span class="unlock-val uv-dim" id="unlockat-${i}">—</span>
    </div>

    <div class="countdown-box" id="cdbox-${i}">
      <div class="cd-idle" id="cd-${i}">--:--:--</div>
      <div class="cd-sublabel" id="cd-lbl-${i}">not locked</div>
    </div>

    <div class="sep"></div>

    <label class="input-label">Set unlock time</label>
    <input class="time-input" type="datetime-local" id="tp-${i}" value="${tsToLocal(Date.now())}">

    <textarea class="notes-input" id="notes-${i}" placeholder="Notes (optional)…">${esc(acc.notes)}</textarea>

    <div class="hold-hint">hold buttons to confirm</div>

    <div class="btn-row">
      <button class="btn btn-lock-now" id="btn-now-${i}">
        <div class="btn-hold-fill"></div>${ICONS.bolt} Lock Now
      </button>
      <button class="btn btn-set-lock" id="btn-lock-${i}">
        <div class="btn-hold-fill"></div>${ICONS.lock} Set Lock
      </button>
      <button class="btn btn-free" id="btn-unlock-${i}" disabled>
        <div class="btn-hold-fill"></div>${ICONS.lockOpen} Free
      </button>
    </div>
  `;
}

// ── Build all cards ───────────────────────────────────────
function buildCards() {
  const grid = $('grid');
  grid.innerHTML = '';
  $('total-count').textContent = TOTAL;
  $('resetHours').value        = resetHours;

  accounts.forEach((acc, i) => {
    const card = document.createElement('div');
    card.id        = `card-${i}`;
    card.className = 'card';
    card.innerHTML = cardHTML(acc, i);
    grid.appendChild(card);

    // Copy email (normal tap)
    $(`copy-${i}`).addEventListener('click', () => {
      navigator.clipboard.writeText(acc.email)
        .then(() => showToast(`Copied ${acc.email}`, 'purple'));
    });

    // Notes autosave
    $(`notes-${i}`).addEventListener('input', e => {
      accounts[i].notes = e.target.value;
      save();
    });

    // Lock Now — use resetHours window from now
    makeHoldButton($(`btn-now-${i}`), () => {
      const unlockTs = Date.now() + resetHours * 3600000;
      accounts[i] = { ...accounts[i], locked: true, lockTime: Date.now(), unlockTime: unlockTs };
      $(`tp-${i}`).value = tsToLocal(unlockTs);
      save(); updateStats();
      showToast(`${acc.name} locked — unlocks in ${resetHours}h`, 'red');
    });

    // Set Lock — use chosen datetime-local value
    makeHoldButton($(`btn-lock-${i}`), () => {
      const picker   = $(`tp-${i}`);
      const unlockTs = picker?.value ? new Date(picker.value).getTime() : null;
      if (!unlockTs || isNaN(unlockTs))  { showToast('Pick a valid unlock time', 'red'); return; }
      if (unlockTs <= Date.now())         { showToast('Unlock time must be in the future', 'red'); return; }
      accounts[i] = { ...accounts[i], locked: true, lockTime: Date.now(), unlockTime: unlockTs };
      save(); updateStats();
      showToast(`${acc.name} locked until ${fmtTime(unlockTs)}`, 'red');
    });

    // Free — clear lock
    makeHoldButton($(`btn-unlock-${i}`), () => {
      accounts[i] = { ...accounts[i], locked: false, lockTime: null, unlockTime: null };
      save(); updateStats();
      showToast(`${acc.name} is now free`, 'green');
    });
  });
}

// ── Update a single card's dynamic parts ─────────────────
function updateCard(i) {
  const acc = accounts[i];
  const now = Date.now();
  const rem = acc.unlockTime ? acc.unlockTime - now : 0;
  const isLocked = acc.locked && rem > 0;
  const isReady  = acc.locked && rem <= 0 && !!acc.lockTime;
  const state    = isLocked ? 'locked' : isReady ? 'ready' : 'active';

  const cardEl = $(`card-${i}`);
  if (!cardEl) return;

  cardEl.className = `card${isLocked ? ' locked' : isReady ? ' ready' : ''}`;

  // Badge
  const badge = $(`badge-${i}`);
  if (badge) badge.className = `badge badge-${state}`;
  const dot = $(`dot-${i}`);
  if (dot) dot.className = `badge-dot dot-${isLocked ? 'red' : isReady ? 'amber' : 'green'}`;
  const btxt = $(`badge-txt-${i}`);
  if (btxt) btxt.textContent = state.toUpperCase();

  // Unlock-at label
  const uEl = $(`unlockat-${i}`);
  if (uEl) {
    if (acc.unlockTime) {
      uEl.innerHTML  = `${fmtTime(acc.unlockTime)} &nbsp;·&nbsp; ${fmtDate(acc.unlockTime)}`;
      uEl.className  = `unlock-val ${isLocked ? 'uv-amber' : 'uv-green'}`;
    } else {
      uEl.textContent = '—';
      uEl.className   = 'unlock-val uv-dim';
    }
  }

  // Progress bar
  const prog = $(`prog-${i}`);
  if (prog) {
    if (isLocked && acc.lockTime && acc.unlockTime) {
      const pct = Math.min(100, ((now - acc.lockTime) / (acc.unlockTime - acc.lockTime)) * 100);
      prog.style.width      = pct + '%';
      prog.style.background = pct > 80 ? 'var(--amber)' : 'var(--red)';
    } else if (isReady) {
      prog.style.width      = '100%';
      prog.style.background = 'var(--green)';
    } else {
      prog.style.width = '0%';
    }
  }

  // Countdown box
  const cdEl  = $(`cd-${i}`);
  const cdLbl = $(`cd-lbl-${i}`);
  const cdBox = $(`cdbox-${i}`);
  if (cdEl && cdLbl && cdBox) {
    if (isLocked) {
      cdEl.className   = 'cd-timer';
      cdEl.textContent = fmtCountdown(rem);
      cdLbl.textContent= 'time until unlock';
      cdBox.className  = 'countdown-box locked-box';
    } else if (isReady) {
      cdEl.className = 'cd-ready';
      cdEl.innerHTML = `${ICONS.check.replace('12','16').replace('12','16')} Limit reset — use now`;
      cdLbl.textContent = '';
      cdBox.className   = 'countdown-box ready-box';
    } else {
      cdEl.className    = 'cd-idle';
      cdEl.textContent  = '--:--:--';
      cdLbl.textContent = 'not locked';
      cdBox.className   = 'countdown-box';
    }
  }

  // Free button
  const ubtn = $(`btn-unlock-${i}`);
  if (ubtn) ubtn.disabled = !acc.locked;

  // Filter visibility
  cardEl.style.display = (activeFilter === 'all' || activeFilter === state) ? '' : 'none';
}

// ── Update stats bar + all cards ─────────────────────────
function updateStats() {
  const now = Date.now();
  let nActive = 0, nLocked = 0, nReady = 0, nextMs = Infinity;

  accounts.forEach(acc => {
    const rem = acc.unlockTime ? acc.unlockTime - now : 0;
    if      (acc.locked && rem > 0)              { nLocked++; if (rem < nextMs) nextMs = rem; }
    else if (acc.locked && rem <= 0 && acc.lockTime) nReady++;
    else                                           nActive++;
  });

  $('stat-active').textContent = nActive;
  $('stat-locked').textContent = nLocked;
  $('stat-ready').textContent  = nReady;
  $('stat-next').textContent   = nextMs < Infinity ? fmtCountdown(nextMs) : '—';

  $('fc-all').textContent    = TOTAL;
  $('fc-active').textContent = nActive;
  $('fc-locked').textContent = nLocked;
  $('fc-ready').textContent  = nReady;

  accounts.forEach((_, i) => updateCard(i));
}

// ── PWA / manifest / service worker ──────────────────────
function setupPWA() {
  function generateIcon(size) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#07070f'; ctx.fillRect(0, 0, size, size);
    const cx = size / 2, cy = size / 2, r = size * 0.38;
    ctx.fillStyle = 'rgba(139,92,246,0.15)';
    ctx.strokeStyle = 'rgba(139,92,246,0.8)';
    ctx.lineWidth = size * 0.04;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 2 + (2 * Math.PI / 6) * i;
      i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
              : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#a78bfa';
    ctx.beginPath(); ctx.arc(cx, cy, size * 0.08, 0, Math.PI * 2); ctx.fill();
    return canvas.toDataURL('image/png');
  }

  const manifest = {
    name: appName, short_name: 'ClaudeTrack',
    start_url: location.href, display: 'standalone',
    background_color: '#07070f', theme_color: '#8b5cf6',
    icons: [
      { src: generateIcon(192), sizes: '192x192', type: 'image/png' },
      { src: generateIcon(512), sizes: '512x512', type: 'image/png' },
    ],
  };
  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
  const link = document.createElement('link');
  link.rel   = 'manifest';
  link.href  = URL.createObjectURL(blob);
  document.head.appendChild(link);

  if ('serviceWorker' in navigator) {
    const sw = `const C='claude-tracker-v3';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['${location.href}'])))});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))})`;
    const swBlob = new Blob([sw], { type: 'application/javascript' });
    navigator.serviceWorker.register(URL.createObjectURL(swBlob), { scope: '/' }).catch(() => {});
  }
}

// ── Wire up controls ──────────────────────────────────────
$('resetHours').addEventListener('change', e => {
  resetHours = parseFloat(e.target.value) || defaultResetHours;
  localStorage.setItem(resetStorageKey, resetHours);
  updateStats();
});

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    updateStats();
  });
});

// ── Boot ──────────────────────────────────────────────────
setupPWA();
buildCards();
updateStats();
updateClock();
setInterval(() => { updateStats(); updateClock(); }, 1000);
