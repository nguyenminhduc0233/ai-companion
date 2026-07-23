// ---------------------------------------------------------------------------
// AI Memory — long-term facts (projects, preferences, workflows). Per the
// spec, only saved WHEN THE USER ALLOWS IT, and sensitive data (passwords,
// OTP, card numbers) is never stored.
// ---------------------------------------------------------------------------

import { store } from '../local/store.js';
import { settings } from './settings.js';

const SENSITIVE = [
  /\bmật khẩu\b/i, /\bpassword\b/i, /\bpass\b/i,
  /\botp\b/i, /\bmã otp\b/i, /\bpin\b/i,
  /\bcvv\b/i, /\bsố thẻ\b/i, /card number/i,
  /\bsecret\b/i, /\bapi[_ -]?key\b/i, /token/i
];

function looksSensitive(text) {
  return SENSITIVE.some((re) => re.test(text || ''));
}

export const memory = {
  col: store.collection('memory'),

  isAllowed() { return !!settings.get('memoryAllowed'); },

  /**
   * Try to remember a fact. Returns { ok, reason }.
   * @param {string} text
   * @param {string} category  'project' | 'preference' | 'workflow' | 'fact'
   */
  remember(text, category = 'fact') {
    if (!this.isAllowed()) return { ok: false, reason: 'not_allowed' };
    if (!text || !text.trim()) return { ok: false, reason: 'empty' };
    if (looksSensitive(text)) return { ok: false, reason: 'sensitive' };
    const row = this.col.add({ text: text.trim(), category });
    return { ok: true, row };
  },

  all() { return this.col.all().sort((a, b) => b.createdAt - a.createdAt); },
  remove(id) { this.col.remove(id); },
  clear() { this.col.clear(); },

  /** Fact strings for injection into the system prompt. */
  factStrings() {
    if (!this.isAllowed()) return [];
    return this.all().map((r) => `(${r.category}) ${r.text}`);
  }
};
