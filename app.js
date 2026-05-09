/* ═══════════════════════════════════════════════════════
   Claude Account Tracker — APP
   All account data (emails, state) lives in JSONBin only.
   config.js must be loaded first.
   ═══════════════════════════════════════════════════════ */

'use strict';

const {
  appName, appVersion, holdMs,
  storageKey,
  jbinKeyStore, jbinIdStore, jbinBase,
} = CONFIG;

// ── Runtime state ────────────────────────────────────────
let accounts     = [];          // loaded from cloud
let activeFilter = 'all';
let syncTimer    = null;
let syncStatus   = 'idle';
let isBooting    = true;

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
function tsToLocalTime(ts) {
  const d = new Date(ts || Date.now());
  const p = n => String(n).padStart(2,'0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
function esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ── Toast ────────────────────────────────────────────────
let toastTimer;
function showToast(msg, color = 'green') {
  const el = $('toast');
  const palette = {
    green:  { bg:'rgba(16,217,126,0.12)',  border:'rgba(16,217,126,0.3)',  text:'#10d97e' },
    red:    { bg:'rgba(255,83,112,0.12)',   border:'rgba(255,83,112,0.3)',  text:'#ff5370' },
    purple: { bg:'rgba(139,92,246,0.12)',   border:'rgba(139,92,246,0.3)', text:'#a78bfa' },
    amber:  { bg:'rgba(255,180,84,0.12)',   border:'rgba(255,180,84,0.3)', text:'#ffb454' },
  };
  const p = palette[color] || palette.green;
  el.textContent = msg;
  el.style.background  = p.bg;
  el.style.borderColor = p.border;
  el.style.color       = p.text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ── Live clock ───────────────────────────────────────────
function updateClock() {
  const el = $('live-clock');
  if (el) el.textContent = new Date().toLocaleTimeString('en-US',
    { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true });
}

// ── JSONBin ──────────────────────────────────────────────
function jbinKey() { return localStorage.getItem(jbinKeyStore) || ''; }
function jbinId()  { return localStorage.getItem(jbinIdStore)  || ''; }

function setSyncStatus(s) {
  syncStatus = s;
  const el = $('sync-status');
  if (!el) return;
  const map = {
    idle:    { text: '○', cls: 'ss-idle'    },
    syncing: { text: '◌', cls: 'ss-syncing' },
    ok:      { text: '●', cls: 'ss-ok'      },
    error:   { text: '!', cls: 'ss-error'   },
  };
  const m = map[s] || map.idle;
  el.textContent = m.text;
  el.className   = `sync-badge ${m.cls}`;
  // Update button title for accessibility
  const btn = $('btn-cloud-setup');
  const titles = { idle: 'Cloud Sync — not configured', syncing: 'Cloud Sync — syncing…', ok: 'Cloud Sync — synced', error: 'Cloud Sync — error' };
  if (btn) btn.title = titles[s] || titles.idle;
}

async function pushToJBin() {
  const key = jbinKey(), id = jbinId();
  if (!key || !id) return;
  setSyncStatus('syncing');
  try {
    const res = await fetch(`${jbinBase}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': key },
      body: JSON.stringify({ accounts, v: 8 }),
    });
    if (!res.ok) throw new Error(res.status);
    setSyncStatus('ok');
  } catch (e) {
    console.warn('JSONBin push failed:', e);
    setSyncStatus('error');
  }
}

async function pullFromJBin() {
  const key = jbinKey(), id = jbinId();
  if (!key || !id) return null;
  setSyncStatus('syncing');
  try {
    const res = await fetch(`${jbinBase}/${id}/latest`, {
      headers: { 'X-Master-Key': key, 'X-Bin-Meta': 'false' },
    });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    setSyncStatus('ok');
    return data;
  } catch (e) {
    console.warn('JSONBin pull failed:', e);
    setSyncStatus('error');
    return null;
  }
}

async function createBin(key) {
  const res = await fetch(jbinBase, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': key,
      'X-Bin-Name':   'claude-tracker',
      'X-Bin-Private':'true',
    },
    body: JSON.stringify({ accounts, v: 8 }),
  });
  if (!res.ok) throw new Error(res.status);
  const data = await res.json();
  return data.metadata.id;
}

function schedulePush() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushToJBin, 1200);
}

function save() { schedulePush(); }

// ── Hold-to-confirm ──────────────────────────────────────
function makeHoldButton(btn, callback) {
  let holdTimer = null;
  function startHold(e) {
    if (btn.disabled) return;
    e.preventDefault();
    btn.classList.add('holding');
    holdTimer = setTimeout(() => { btn.classList.remove('holding'); callback(); }, holdMs);
  }
  function cancelHold() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    btn.classList.remove('holding');
  }
  btn.addEventListener('pointerdown',   startHold);
  btn.addEventListener('pointerup',     cancelHold);
  btn.addEventListener('pointerleave',  cancelHold);
  btn.addEventListener('pointercancel', cancelHold);
  btn.addEventListener('click', e => e.preventDefault());
}

// ── SVG icons ────────────────────────────────────────────
const ICONS = {
  check:    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  lock:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  lockOpen: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,
  bolt:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  email:    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  copy:     `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  trash:    `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  plus:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  key:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
};

// ── Card HTML ─────────────────────────────────────────────
function cardHTML(acc, i) {
  return `
    <div class="card-top-bar" id="glow-${i}"></div>
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
      <button class="icon-btn copy-btn" id="copy-${i}" title="Copy email">${ICONS.copy}</button>
      <button class="icon-btn del-btn" id="del-${i}" title="Delete account">${ICONS.trash}</button>
    </div>
    <div class="progress-wrap"><div class="progress-bar" id="prog-${i}"></div></div>
    <div class="unlock-row">
      <span class="unlock-label">Unlocks at</span>
      <span class="unlock-val uv-dim" id="unlockat-${i}">—</span>
    </div>
    <div class="countdown-box" id="cdbox-${i}">
      <div class="cd-idle" id="cd-${i}">--:--:--</div>
      <div class="cd-sublabel" id="cd-lbl-${i}">not locked</div>
    </div>
    <div class="sep"></div>
    <textarea class="notes-input" id="notes-${i}" placeholder="Notes…">${esc(acc.notes || '')}</textarea>
    <div class="btn-row btn-row-2">
      <button class="btn btn-set-lock" id="btn-lock-${i}">
        ${ICONS.lock} Set Lock
      </button>
      <button class="btn btn-free" id="btn-unlock-${i}" disabled>
        ${ICONS.lockOpen} Free
      </button>
    </div>
  `;
}

// ── Build cards ───────────────────────────────────────────
function buildCards() {
  const grid = $('grid');
  grid.innerHTML = '';
  $('total-count').textContent = accounts.length;

  accounts.forEach((acc, i) => {
    const card = document.createElement('div');
    card.id = `card-${i}`; card.className = 'card';
    card.innerHTML = cardHTML(acc, i);
    grid.appendChild(card);

    $(`copy-${i}`).addEventListener('click', () => {
      navigator.clipboard.writeText(acc.email)
        .then(() => showToast(`Copied ${acc.email}`, 'purple'));
    });

    makeHoldButton($(`del-${i}`), () => {
      accounts.splice(i, 1);
      save(); buildCards(); updateStats();
      showToast('Account removed', 'amber');
    });

    $(`notes-${i}`).addEventListener('input', e => {
      accounts[i].notes = e.target.value; save();
    });

    $(`btn-lock-${i}`).addEventListener('click', () => openLockModal(i));
    $(`btn-unlock-${i}`).addEventListener('click', () => openFreeModal(i));
  });

  // Empty state
  if (accounts.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${ICONS.plus}</div>
        <p>No accounts yet.</p>
        <p class="empty-sub">Add your first Claude account using the button above.</p>
      </div>
    `;
  }
}

// ── Update card ───────────────────────────────────────────
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

  // Sort order: locked (soonest first) → ready → active
  if (isLocked) {
    cardEl.style.order = rem; // smaller rem = closer to top
  } else if (isReady) {
    cardEl.style.order = 9000000000000;
  } else {
    cardEl.style.order = 9999999999999;
  }

  const badge = $(`badge-${i}`);
  if (badge) badge.className = `badge badge-${state}`;
  const dot = $(`dot-${i}`);
  if (dot) dot.className = `badge-dot dot-${isLocked ? 'red' : isReady ? 'amber' : 'green'}`;
  const btxt = $(`badge-txt-${i}`);
  if (btxt) btxt.textContent = state.toUpperCase();

  const uEl = $(`unlockat-${i}`);
  if (uEl) {
    if (acc.unlockTime) {
      uEl.innerHTML = `${fmtTime(acc.unlockTime)} &nbsp;·&nbsp; ${fmtDate(acc.unlockTime)}`;
      uEl.className = `unlock-val ${isLocked ? 'uv-amber' : 'uv-green'}`;
    } else {
      uEl.textContent = '—'; uEl.className = 'unlock-val uv-dim';
    }
  }

  const prog = $(`prog-${i}`);
  if (prog) {
    if (isLocked && acc.lockTime && acc.unlockTime) {
      const pct = Math.min(100, ((now - acc.lockTime) / (acc.unlockTime - acc.lockTime)) * 100);
      prog.style.width = pct + '%';
      prog.style.background = pct > 80 ? 'var(--amber)' : 'var(--red)';
    } else if (isReady) {
      prog.style.width = '100%'; prog.style.background = 'var(--green)';
    } else {
      prog.style.width = '0%';
    }
  }

  const cdEl = $(`cd-${i}`), cdLbl = $(`cd-lbl-${i}`), cdBox = $(`cdbox-${i}`);
  if (cdEl && cdLbl && cdBox) {
    if (isLocked) {
      cdEl.className = 'cd-timer'; cdEl.textContent = fmtCountdown(rem);
      cdLbl.textContent = 'time until unlock'; cdBox.className = 'countdown-box locked-box';
    } else if (isReady) {
      cdEl.className = 'cd-ready';
      cdEl.innerHTML = `${ICONS.check.replace(/12/g,'16')} Limit reset — use now`;
      cdLbl.textContent = ''; cdBox.className = 'countdown-box ready-box';
    } else {
      cdEl.className = 'cd-idle'; cdEl.textContent = '--:--:--';
      cdLbl.textContent = 'not locked'; cdBox.className = 'countdown-box';
    }
  }

  const ubtn = $(`btn-unlock-${i}`);
  if (ubtn) ubtn.disabled = !acc.locked;
  cardEl.style.display = (activeFilter === 'all' || activeFilter === state) ? '' : 'none';
}

// ── Stats ─────────────────────────────────────────────────
function updateStats() {
  const now = Date.now();
  let nActive = 0, nLocked = 0, nReady = 0, nextMs = Infinity;
  accounts.forEach(acc => {
    const rem = acc.unlockTime ? acc.unlockTime - now : 0;
    if      (acc.locked && rem > 0)               { nLocked++; if (rem < nextMs) nextMs = rem; }
    else if (acc.locked && rem <= 0 && acc.lockTime) nReady++;
    else                                             nActive++;
  });
  $('stat-active').textContent = nActive;
  $('stat-locked').textContent = nLocked;
  $('stat-ready').textContent  = nReady;
  $('stat-next').textContent   = nextMs < Infinity ? fmtCountdown(nextMs) : '—';
  $('fc-all').textContent    = accounts.length;
  $('fc-active').textContent = nActive;
  $('fc-locked').textContent = nLocked;
  $('fc-ready').textContent  = nReady;
  $('total-count').textContent = accounts.length;
  accounts.forEach((_, i) => updateCard(i));
}

// ── Add Account Modal ─────────────────────────────────────
function openAddModal() {
  const modal = $('add-modal');
  modal.classList.add('open');
  $('add-name').value  = '';
  $('add-email').value = '';
  $('add-name').focus();
}
function closeAddModal() {
  $('add-modal').classList.remove('open');
}

function handleAddAccount() {
  const name  = $('add-name').value.trim();
  const email = $('add-email').value.trim();
  if (!name)  { shakeInput('add-name');  showToast('Enter a name', 'red'); return; }
  if (!email || !email.includes('@')) { shakeInput('add-email'); showToast('Enter a valid email', 'red'); return; }
  accounts.push({ id: uid(), name, email, locked: false, lockTime: null, unlockTime: null, notes: '' });
  save(); buildCards(); updateStats();
  closeAddModal();
  showToast(`${name} added`, 'green');
}

function shakeInput(id) {
  const el = $(id);
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}

// ── Lock Modal ────────────────────────────────────────────
let lockTargetIndex = -1;

function openLockModal(i) {
  lockTargetIndex = i;
  const acc = accounts[i];
  $('lock-modal-name').textContent  = acc.name;
  $('lock-modal-email').textContent = acc.email;
  const d = new Date();
  $('lock-hour').value = String(d.getHours()).padStart(2, '0');
  $('lock-min').value  = String(d.getMinutes()).padStart(2, '0');
  updateLockHint();
  $('lock-modal').classList.add('open');
  $('lock-hour').focus();
}
function closeLockModal() {
  $('lock-modal').classList.remove('open');
  lockTargetIndex = -1;
}
function updateLockHint() {
  const h = parseInt($('lock-hour').value, 10);
  const m = parseInt($('lock-min').value,  10);
  const hint = $('lock-modal-hint');
  if (isNaN(h) || isNaN(m)) { hint.textContent = ''; return; }
  const target = new Date(); target.setSeconds(0,0); target.setHours(h, m);
  if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
  const isNextDay = target.toDateString() !== new Date().toDateString();
  hint.textContent = isNextDay
    ? `⟶ Tomorrow · ${fmtTime(target.getTime())}`
    : `⟶ Today · ${fmtTime(target.getTime())}`;
  hint.className = `lock-date-hint ${isNextDay ? 'hint-tomorrow' : 'hint-today'}`;
}
function handleLockConfirm() {
  const i = lockTargetIndex;
  if (i < 0) return;
  const h = parseInt($('lock-hour').value, 10);
  const m = parseInt($('lock-min').value,  10);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    showToast('Enter a valid time (0–23 h, 0–59 m)', 'red'); return;
  }
  const target = new Date(); target.setSeconds(0,0); target.setHours(h, m);
  if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
  const unlockTs = target.getTime();
  const isNextDay = target.toDateString() !== new Date().toDateString();
  accounts[i] = { ...accounts[i], locked: true, lockTime: Date.now(), unlockTime: unlockTs };
  save(); updateStats(); closeLockModal();
  showToast(`${accounts[i].name} locked until ${fmtTime(unlockTs)}${isNextDay ? ' (tomorrow)' : ''}`, 'red');
}

// ── Free Modal ────────────────────────────────────────────
let freeTargetIndex = -1;

function openFreeModal(i) {
  freeTargetIndex = i;
  const acc = accounts[i];
  $('free-modal-name').textContent  = acc.name;
  $('free-modal-email').textContent = acc.email;
  $('free-modal').classList.add('open');
}
function closeFreeModal() {
  $('free-modal').classList.remove('open');
  freeTargetIndex = -1;
}
function handleFreeConfirm() {
  const i = freeTargetIndex;
  if (i < 0) return;
  accounts[i] = { ...accounts[i], locked: false, lockTime: null, unlockTime: null };
  save(); updateStats(); closeFreeModal();
  showToast(`${accounts[i].name} is now free`, 'green');
}

// ── Setup Modal ───────────────────────────────────────────
function openSetupModal() {
  const modal = $('setup-modal');
  modal.classList.add('open');
  const k = jbinKey(), id = jbinId();
  if (k)  $('setup-key-input').value = k;
  if (id) $('setup-id-input').value  = id;
}
function closeSetupModal() {
  $('setup-modal').classList.remove('open');
}

async function handleSetupSave() {
  const keyEl = $('setup-key-input');
  const idEl  = $('setup-id-input');
  const btn   = $('setup-save-btn');
  const key   = keyEl.value.trim();
  const manId = idEl.value.trim();

  if (!key) { shakeInput('setup-key-input'); showToast('Paste your Master Key first', 'red'); return; }

  btn.textContent = 'Connecting…'; btn.disabled = true;

  try {
    let id = manId;
    if (!id) {
      id = await createBin(key);
      idEl.value = id;
      showToast('Cloud bin created!', 'green');
    }
    localStorage.setItem(jbinKeyStore, key);
    localStorage.setItem(jbinIdStore,  id);
    setSyncStatus('ok');
    showToast('Cloud sync enabled ✓', 'green');
    closeSetupModal();
  } catch (e) {
    showToast('Failed — check your API key', 'red');
    setSyncStatus('error');
  } finally {
    btn.textContent = 'Save & Connect'; btn.disabled = false;
  }
}

async function handleSetupPull() {
  const data = await pullFromJBin();
  if (!data) { showToast('Pull failed', 'red'); return; }
  if (data.accounts && Array.isArray(data.accounts)) {
    accounts = data.accounts;
    buildCards(); updateStats();
    showToast('Pulled from cloud ✓', 'green');
    closeSetupModal();
  } else {
    showToast('No data found in bin', 'amber');
  }
}

function handleSetupClear() {
  localStorage.removeItem(jbinKeyStore);
  localStorage.removeItem(jbinIdStore);
  $('setup-key-input').value = '';
  $('setup-id-input').value  = '';
  setSyncStatus('idle');
  showToast('Cloud sync disabled', 'purple');
  closeSetupModal();
}

// ── PWA ───────────────────────────────────────────────────
function setupPWA() {
  function generateIcon(size) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#07070f'; ctx.fillRect(0, 0, size, size);
    const cx = size/2, cy = size/2, r = size*0.38;
    ctx.fillStyle = 'rgba(139,92,246,0.15)'; ctx.strokeStyle = 'rgba(139,92,246,0.8)';
    ctx.lineWidth = size*0.04;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI/2 + (2*Math.PI/6)*i;
      i === 0 ? ctx.moveTo(cx+r*Math.cos(a), cy+r*Math.sin(a))
              : ctx.lineTo(cx+r*Math.cos(a), cy+r*Math.sin(a));
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#a78bfa';
    ctx.beginPath(); ctx.arc(cx, cy, size*0.08, 0, Math.PI*2); ctx.fill();
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
  const link = document.createElement('link'); link.rel = 'manifest';
  link.href = URL.createObjectURL(blob); document.head.appendChild(link);
  if ('serviceWorker' in navigator) {
    const sw = `const C='claude-tracker-v4';self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['${location.href}'])))});self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))})`;
    navigator.serviceWorker.register(
      URL.createObjectURL(new Blob([sw], { type: 'application/javascript' })), { scope: '/' }
    ).catch(() => {});
  }
}

// ── Boot ──────────────────────────────────────────────────
setupPWA();

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    updateStats();
  });
});

// Add account button
$('btn-add-account').addEventListener('click', () => {
  if (!jbinKey()) {
    showToast('Set up cloud sync first', 'amber');
    openSetupModal();
    return;
  }
  openAddModal();
});

// Cloud setup button
$('btn-cloud-setup').addEventListener('click', openSetupModal);

// Modal events
$('add-modal-close').addEventListener('click', closeAddModal);
$('add-modal-overlay').addEventListener('click', closeAddModal);
$('add-confirm-btn').addEventListener('click', handleAddAccount);
$('add-name').addEventListener('keydown', e => { if (e.key === 'Enter') $('add-email').focus(); });
$('add-email').addEventListener('keydown', e => { if (e.key === 'Enter') handleAddAccount(); });

$('setup-modal-close').addEventListener('click', closeSetupModal);
$('setup-modal-overlay').addEventListener('click', closeSetupModal);
$('setup-save-btn').addEventListener('click', handleSetupSave);
$('setup-pull-btn').addEventListener('click', handleSetupPull);
$('setup-clear-btn').addEventListener('click', handleSetupClear);

// Lock modal
$('lock-modal-close').addEventListener('click', closeLockModal);
$('lock-modal-overlay').addEventListener('click', closeLockModal);
$('lock-modal-cancel').addEventListener('click', closeLockModal);
$('lock-modal-confirm').addEventListener('click', handleLockConfirm);

// HH/MM arrow buttons
function clampSet(id, min, max, delta) {
  const el = $(id);
  const cur = parseInt(el.value, 10) || 0;
  el.value = String(Math.min(max, Math.max(min, cur + delta))).padStart(2, '0');
  updateLockHint();
}
$('hm-hour-up').addEventListener('click', () => clampSet('lock-hour', 0, 23,  1));
$('hm-hour-dn').addEventListener('click', () => clampSet('lock-hour', 0, 23, -1));
$('hm-min-up').addEventListener('click',  () => clampSet('lock-min',  0, 59,  1));
$('hm-min-dn').addEventListener('click',  () => clampSet('lock-min',  0, 59, -1));
$('lock-hour').addEventListener('input', e => {
  let v = e.target.value.replace(/\D/g, '').slice(0, 2);
  if (v.length && parseInt(v, 10) > 23) v = '23';
  e.target.value = v;
  updateLockHint();
});
$('lock-min').addEventListener('input', e => {
  let v = e.target.value.replace(/\D/g, '').slice(0, 2);
  if (v.length && parseInt(v, 10) > 59) v = '59';
  e.target.value = v;
  updateLockHint();
});
$('lock-hour').addEventListener('keydown', e => { if (e.key === 'Enter') $('lock-min').focus(); });
$('lock-min').addEventListener('keydown',  e => { if (e.key === 'Enter') handleLockConfirm(); });

// Free modal
$('free-modal-close').addEventListener('click', closeFreeModal);
$('free-modal-overlay').addEventListener('click', closeFreeModal);
$('free-modal-cancel').addEventListener('click', closeFreeModal);
$('free-modal-confirm').addEventListener('click', handleFreeConfirm);

// Inject version from config
const vEl = document.querySelector('.footer-version');
if (vEl) vEl.textContent = appVersion || 'v1.0';

// Initial render
buildCards();
updateStats();
updateClock();
setSyncStatus(jbinKey() && jbinId() ? 'ok' : 'idle');

// Show setup modal on first visit if no key configured
if (!jbinKey()) {
  setTimeout(() => openSetupModal(), 600);
}

// Auto-pull from cloud on boot
if (jbinKey() && jbinId()) {
  pullFromJBin().then(data => {
    if (!data) return;
    if (data.accounts && Array.isArray(data.accounts)) {
      accounts = data.accounts;
      buildCards(); updateStats();
    }
  });
}

setInterval(() => { updateStats(); updateClock(); }, 1000);
