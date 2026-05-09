// ═══════════════════════════════════════════════════════
//  Claude Account Tracker — CONFIG
//  Emails are NOT stored here. All account data lives
//  in JSONBin cloud storage only.
// ═══════════════════════════════════════════════════════

const CONFIG = {
  appName:    'Claude Tracker',
  appTagline: 'free plan',
  appVersion: 'v1.0',          // ← change version here

  holdMs: 750,

  // LocalStorage keys (only for non-sensitive UI state)
  storageKey: 'clt_v8',

  // JSONBin storage keys
  jbinKeyStore: 'clt_jbin_key',
  jbinIdStore:  'clt_jbin_id',
  jbinBase:     'https://api.jsonbin.io/v3/b',
};
