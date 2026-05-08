// ═══════════════════════════════════════════════════════
//  Claude Account Tracker — CONFIG
//  Edit this file to add / remove accounts and tweak
//  app-wide settings. No other files need to change.
// ═══════════════════════════════════════════════════════

const CONFIG = {

  // ── App info ──────────────────────────────────────────
  appName:    'Claude Tracker',
  appTagline: 'free plan',

  // ── Default reset window (hours per cycle) ────────────
  defaultResetHours: 5,

  // ── Hold-to-confirm duration (ms) ─────────────────────
  holdMs: 750,

  // ── LocalStorage keys ─────────────────────────────────
  storageKey:      'clt_v7',
  resetStorageKey: 'clt_reset_v3',

  // ── Accounts ──────────────────────────────────────────
  //    Add / remove objects here.
  //    Each entry: { name: 'Display Name', email: 'user@example.com' }
  accounts: [
    { name: 'tharindu', email: 'tprabath81@gmail.com'    },
    { name: 'lakshan',  email: 'prabath99t@gmail.com'    },
    { name: 'malli',    email: 'tprabath84@gmail.com'    },
    { name: 'Diana',    email: 'crypto.th99@gmail.com'   },
    { name: 'Rema',     email: 'rema99.praba@gmail.com'  },
    { name: 'airtel',  email: 'oracal.tharindu99@gmail.com'    },
    { name: 't•',  email: 'ocean.vps.1995@gmail.com'      },
    { name: 'prabath',  email: 'deploy.heroku99@gmail.com'   },
  ],

};
