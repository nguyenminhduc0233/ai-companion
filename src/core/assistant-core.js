// ---------------------------------------------------------------------------
// Assistant Core — the orchestrator. Takes user input, assembles the system
// prompt (persona + memory + document context), calls the AI Gateway, extracts
// the mood tag, and broadcasts state so the avatar/animation engine and UI can
// react (idle → listening → thinking → talking → idle).
// ---------------------------------------------------------------------------

import { buildSystemPrompt, extractMood } from './system-prompt.js';
import { settings } from './memory/settings.js';
import { memory } from './memory/memory.js';

const MAX_TURNS = 16; // keep the last N messages to control token cost

export class AssistantCore {
  constructor(gateway) {
    this.gateway = gateway;
    this.history = [];           // { role, content }
    this.document = null;        // { name, text }
    this.state = 'idle';         // idle | listening | thinking | talking
    this.listeners = { state: new Set(), mood: new Set(), message: new Set() };
  }

  on(event, cb) {
    this.listeners[event]?.add(cb);
    return () => this.listeners[event]?.delete(cb);
  }

  _emit(event, payload) {
    for (const cb of this.listeners[event] || []) {
      try { cb(payload); } catch (_) {}
    }
  }

  setState(state) {
    this.state = state;
    this._emit('state', state);
  }

  setDocument(doc) { this.document = doc; }
  clearDocument() { this.document = null; }

  reset() {
    this.history = [];
    this.document = null;
    this.setState('idle');
  }

  _systemPrompt() {
    const s = settings.all();
    return buildSystemPrompt({
      assistantName: s.assistantName,
      gender: s.gender,
      mode: s.mode,
      memoryFacts: memory.factStrings(),
      documentContext: this.document ? this.document.text : '',
      locale: 'vi'
    });
  }

  /**
   * Ask the assistant. Returns { text, mood, usage }.
   */
  async ask(userText) {
    if (!userText || !userText.trim()) return { text: '', mood: null };
    const userMsg = { role: 'user', content: userText.trim() };
    this.history.push(userMsg);
    this._emit('message', userMsg);

    this.setState('thinking');
    const windowed = this.history.slice(-MAX_TURNS);

    try {
      const { content, usage } = await this.gateway.sendChat({
        messages: windowed,
        systemPrompt: this._systemPrompt()
      });
      const { mood, text } = extractMood(content);
      const assistantMsg = { role: 'assistant', content: text };
      this.history.push(assistantMsg);

      this.setState('talking');
      if (mood) this._emit('mood', mood);
      this._emit('message', assistantMsg);
      return { text, mood, usage };
    } catch (err) {
      this.setState('idle');
      const errMsg = { role: 'assistant', content: `⚠️ ${err.message || err}`, error: true };
      this._emit('message', errMsg);
      throw err;
    }
  }

  /** Called by the UI when speech/typing finishes so the avatar returns to idle. */
  finishedSpeaking() {
    if (this.state === 'talking') this.setState('idle');
  }
}
