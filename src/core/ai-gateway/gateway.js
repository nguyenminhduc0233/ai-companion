// ---------------------------------------------------------------------------
// AI Gateway — a single entry point the Assistant Core uses to talk to any
// provider. Handles the platform-specific transport so the same code works in:
//   - Electron (routes through the main process → no CORS)
//   - Capacitor / Android (window.fetch is patched to native HTTP → no CORS)
//   - Plain browser (dev) — direct fetch, subject to each provider's CORS
// ---------------------------------------------------------------------------

import { getProvider } from './providers.js';
import { tokenTracker } from './token-tracker.js';

/**
 * Uniform fetch wrapper returning { ok, status, statusText, text(), json() }.
 */
export async function platformFetch(url, options = {}) {
  // Electron: proxy through main process.
  if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.isElectron) {
    const r = await window.electronAPI.apiFetch(url, options);
    return {
      ok: r.ok,
      status: r.status,
      statusText: r.statusText,
      headers: r.headers,
      text: async () => r.body,
      json: async () => JSON.parse(r.body || 'null')
    };
  }
  // Capacitor patches window.fetch natively when CapacitorHttp is enabled;
  // plain browsers use the standard fetch. Both go here.
  const res = await fetch(url, options);
  const bodyText = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
    text: async () => bodyText,
    json: async () => JSON.parse(bodyText || 'null')
  };
}

export class AIGateway {
  /**
   * @param {() => object} getSettings returns { providerId, apiKey, baseUrl, model, temperature, maxTokens }
   */
  constructor(getSettings) {
    this.getSettings = getSettings;
  }

  isConfigured() {
    const s = this.getSettings();
    return !!(s && s.apiKey && s.providerId);
  }

  /**
   * Send a chat completion request.
   * @param {object} args
   * @param {Array<{role:string, content:string}>} args.messages
   * @param {string} args.systemPrompt
   * @returns {Promise<{content:string, usage:object}>}
   */
  async sendChat({ messages, systemPrompt }) {
    const s = this.getSettings();
    if (!s || !s.apiKey) {
      throw new Error('Chưa cấu hình API key. Mở Cài đặt → AI Gateway để nhập key.');
    }
    const provider = getProvider(s.providerId);

    const { url, options } = provider.buildRequest({
      apiKey: s.apiKey,
      baseUrl: s.baseUrl,
      model: s.model,
      systemPrompt,
      messages,
      temperature: s.temperature ?? 0.7,
      maxTokens: s.maxTokens ?? 1024
    });

    let res;
    try {
      res = await platformFetch(url, options);
    } catch (err) {
      throw new Error(`Lỗi kết nối tới nhà cung cấp: ${err.message || err}`);
    }

    const rawText = await res.text();
    if (!res.ok) {
      let detail = rawText;
      try {
        const j = JSON.parse(rawText);
        detail = j.error?.message || j.message || j.error || rawText;
      } catch (_) {}
      throw new Error(`API lỗi ${res.status}: ${String(detail).slice(0, 400)}`);
    }

    let json;
    try {
      json = JSON.parse(rawText);
    } catch (_) {
      throw new Error('Phản hồi không phải JSON hợp lệ từ nhà cung cấp.');
    }

    const parsed = provider.parseResponse(json);

    // Record token usage (with estimation fallback from text length).
    const promptText = (systemPrompt || '') + '\n' + messages.map((m) => m.content).join('\n');
    tokenTracker.record(parsed.usage, {
      promptText,
      completionText: parsed.content
    });

    return { content: parsed.content, usage: parsed.usage };
  }

  /** Refresh the provider account balance/credits where supported. */
  async refreshBalance() {
    const s = this.getSettings();
    if (!s || !s.apiKey) return null;
    const provider = getProvider(s.providerId);
    if (!provider.balance) {
      tokenTracker.setProviderBalance(null);
      return null;
    }
    try {
      const result = await provider.balance.fetch(s.apiKey, platformFetch);
      if (result) {
        tokenTracker.setProviderBalance({ label: provider.balance.label, text: result.text });
        return result;
      }
    } catch (_) {
      tokenTracker.setProviderBalance(null);
    }
    return null;
  }

  /** Lightweight connectivity/auth test. */
  async testConnection() {
    try {
      const r = await this.sendChat({
        messages: [{ role: 'user', content: 'Trả lời đúng một từ: OK' }],
        systemPrompt: 'Bạn là trợ lý. Chỉ trả lời "OK".'
      });
      return { ok: true, content: r.content, usage: r.usage };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  }
}
