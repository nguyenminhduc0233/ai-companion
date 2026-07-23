// ---------------------------------------------------------------------------
// Settings — persisted app + AI Gateway configuration. Reactive via subscribe.
// The API key is stored locally only (never transmitted anywhere except to the
// provider the user chose).
// ---------------------------------------------------------------------------

import { store } from '../local/store.js';

const DEFAULTS = {
  // AI Gateway
  providerId: 'openai',
  apiKey: '',
  baseUrl: '',
  model: '',
  temperature: 0.7,
  maxTokens: 1024,

  // Persona
  assistantName: 'Linh',
  gender: 'Nữ',

  // I/O
  mode: 'text', // 'text' | 'voice' | 'both'
  ttsEnabled: true,
  sttLang: 'vi-VN',
  voiceName: '',

  // Memory
  memoryAllowed: false,

  // Avatar
  avatarMode: '3d', // '3d' (procedural placeholder) | 'vrm' (your uploaded/URL model) | '2d' (image)
  vrmUrl: '',
  avatarModelName: '', // filename of an uploaded 3D model (stored in IndexedDB)

  // Misc
  theme: 'aurora'
};

class Settings {
  constructor() {
    this.data = { ...DEFAULTS, ...(store.get('settings', {}) || {}) };
    this.subscribers = new Set();
  }

  get(key) { return this.data[key]; }
  all() { return { ...this.data }; }

  set(key, value) {
    this.data[key] = value;
    store.set('settings', this.data);
    this._emit();
  }

  update(patch) {
    this.data = { ...this.data, ...patch };
    store.set('settings', this.data);
    this._emit();
  }

  /** Shape used by the AI Gateway. */
  gatewaySettings() {
    return {
      providerId: this.data.providerId,
      apiKey: this.data.apiKey,
      baseUrl: this.data.baseUrl,
      model: this.data.model,
      temperature: this.data.temperature,
      maxTokens: this.data.maxTokens
    };
  }

  subscribe(cb) {
    this.subscribers.add(cb);
    cb(this.all());
    return () => this.subscribers.delete(cb);
  }

  _emit() {
    const snap = this.all();
    for (const cb of this.subscribers) {
      try { cb(snap); } catch (_) {}
    }
  }
}

export const settings = new Settings();
