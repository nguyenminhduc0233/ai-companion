// ---------------------------------------------------------------------------
// Token tracker — shows how many tokens each API call consumed, the running
// session total, a persistent lifetime total, and remaining tokens against an
// optional user budget. Real provider balance (credits) is filled in
// separately by the gateway for providers that expose it.
// ---------------------------------------------------------------------------

const LS_KEY = 'aic.tokens.lifetime.v1';
const LS_BUDGET = 'aic.tokens.budget.v1';

function estimateTokens(text) {
  if (!text) return 0;
  // Rough heuristic used only when the provider omits a usage object.
  return Math.max(1, Math.ceil(text.length / 4));
}

export class TokenTracker {
  constructor() {
    this.subscribers = new Set();
    this.session = { calls: 0, prompt: 0, completion: 0, total: 0 };
    this.lastCall = null;
    this.providerBalance = null; // { label, text }
    this.lifetime = this._loadLifetime();
    this.budget = this._loadBudget(); // number of tokens, or null
  }

  _loadLifetime() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { prompt: 0, completion: 0, total: 0, calls: 0 };
  }

  _saveLifetime() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(this.lifetime)); } catch (_) {}
  }

  _loadBudget() {
    try {
      const raw = localStorage.getItem(LS_BUDGET);
      if (raw != null && raw !== '') return Number(raw);
    } catch (_) {}
    return null;
  }

  setBudget(tokens) {
    this.budget = tokens && tokens > 0 ? Number(tokens) : null;
    try {
      if (this.budget == null) localStorage.removeItem(LS_BUDGET);
      else localStorage.setItem(LS_BUDGET, String(this.budget));
    } catch (_) {}
    this._emit();
  }

  /**
   * Record usage from one API call.
   * @param {{prompt:?number, completion:?number, total:?number}} usage
   * @param {{promptText?:string, completionText?:string}} fallback text for estimation
   */
  record(usage, fallback = {}) {
    let { prompt, completion, total } = usage || {};
    let estimated = false;

    if (prompt == null && completion == null && total == null) {
      // No usage returned — estimate from text length.
      prompt = estimateTokens(fallback.promptText);
      completion = estimateTokens(fallback.completionText);
      total = prompt + completion;
      estimated = true;
    } else {
      if (prompt == null) prompt = 0;
      if (completion == null) completion = 0;
      if (total == null) total = prompt + completion;
    }

    this.lastCall = { prompt, completion, total, estimated, at: Date.now() };

    this.session.calls += 1;
    this.session.prompt += prompt;
    this.session.completion += completion;
    this.session.total += total;

    this.lifetime.calls += 1;
    this.lifetime.prompt += prompt;
    this.lifetime.completion += completion;
    this.lifetime.total += total;
    this._saveLifetime();

    this._emit();
    return this.lastCall;
  }

  setProviderBalance(balance) {
    this.providerBalance = balance; // { label, text } or null
    this._emit();
  }

  resetSession() {
    this.session = { calls: 0, prompt: 0, completion: 0, total: 0 };
    this.lastCall = null;
    this._emit();
  }

  resetLifetime() {
    this.lifetime = { prompt: 0, completion: 0, total: 0, calls: 0 };
    this._saveLifetime();
    this._emit();
  }

  getState() {
    const remaining = this.budget != null ? Math.max(0, this.budget - this.session.total) : null;
    return {
      session: { ...this.session },
      lifetime: { ...this.lifetime },
      lastCall: this.lastCall ? { ...this.lastCall } : null,
      budget: this.budget,
      remaining,
      providerBalance: this.providerBalance ? { ...this.providerBalance } : null
    };
  }

  subscribe(cb) {
    this.subscribers.add(cb);
    cb(this.getState());
    return () => this.subscribers.delete(cb);
  }

  _emit() {
    const state = this.getState();
    for (const cb of this.subscribers) {
      try { cb(state); } catch (_) {}
    }
  }
}

export const tokenTracker = new TokenTracker();
