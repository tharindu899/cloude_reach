# Claude Account Tracker

A lightweight, offline-first web app to manage and track multiple Claude free-plan accounts — with countdown timers, lock/unlock controls, and PWA support.

> 🔒 All data stays in your browser (`localStorage`). Nothing is sent to any server.

---

## ✨ Features

- **Per-account lock timers** — lock an account now or schedule a custom unlock time
- **Live countdown** — HH:MM:SS timer updates every second
- **Progress bar** — visual fill showing how much of the lock window has elapsed
- **Status badges** — Active / Locked / Ready at a glance
- **Filter view** — show All, Active, Locked, or Ready accounts
- **Hold-to-confirm** — 750 ms hold prevents accidental lock/unlock actions
- **Copy email** — one-tap clipboard copy per account
- **Notes field** — per-account freeform notes, auto-saved
- **Configurable reset window** — default 5 hrs, adjustable 1–24 hrs
- **PWA ready** — installable on mobile and desktop, works offline

---

## 📁 File Structure

```
your-repo/
├── index.html   # App shell & HTML structure
├── style.css    # All styles & design tokens
├── config.js    # Account list & app settings  ← edit this
└── app.js       # All runtime logic
```

---

## ⚙️ Configuration

Open **`config.js`** to add or remove accounts and tweak settings:

```js
const CONFIG = {
  appName:           'Claude Tracker',
  defaultResetHours: 5,       // hours per lock cycle
  holdMs:            750,     // hold-to-confirm duration (ms)
  storageKey:        'clt_v7',
  resetStorageKey:   'clt_reset_v3',

  accounts: [
    { name: 'Tharindu', email: 'tprabath81@gmail.com' },
    { name: 'Lakshan',  email: 'prabath99t@gmail.com' },
    // add more entries here...
  ],
};
```

> Only `config.js` needs to be edited — no other files require changes.

---

## 🚀 Deploy to GitHub Pages

1. **Create a new repository** on GitHub (e.g. `claude-tracker`)

2. **Push all four files** into the root of the repo:
   ```
   index.html
   style.css
   config.js
   app.js
   ```

3. Go to **Settings → Pages**
   - Source: `Deploy from a branch`
   - Branch: `main` → `/ (root)`
   - Click **Save**

4. Your app will be live at:
   ```
   https://<your-username>.github.io/claude-tracker/
   ```

---

## 📱 Install as PWA

| Platform | Steps |
|----------|-------|
| **Android (Chrome)** | Open site → tap ⋮ menu → *Add to Home screen* |
| **iOS (Safari)** | Open site → tap Share → *Add to Home Screen* |
| **Desktop (Chrome/Edge)** | Click the install icon in the address bar |

---

## 🔄 How Lock Cycles Work

| Action | What happens |
|--------|-------------|
| **Lock Now** | Locks the account for the configured reset window (default 5 hrs) |
| **Set Lock** | Locks until a specific date/time you pick |
| **Free** | Immediately clears the lock |
| **Ready** | Shown when the timer expires — safe to use the account again |

---

## 🛠 Local Development

No build tools required. Just open `index.html` directly in a browser, or serve with any static server:

```bash
# Python
python -m http.server 8080

# Node (npx)
npx serve .
```

Then visit `http://localhost:8080`

---

## 📄 License

MIT — free to use, modify, and distribute.
