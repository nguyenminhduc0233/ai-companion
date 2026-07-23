// ---------------------------------------------------------------------------
// Text To Speech via the Web Speech API. In voice mode we strip markdown,
// code, tables and URLs before speaking (per the output rules in TÀI LIỆU 1).
// ---------------------------------------------------------------------------

export function speakableText(text) {
  if (!text) return '';
  let t = text;
  t = t.replace(/```[\s\S]*?```/g, ' (đoạn mã) ');      // code blocks
  t = t.replace(/`[^`]*`/g, ' ');                        // inline code
  t = t.replace(/\|.*\|/g, ' ');                         // table rows
  t = t.replace(/https?:\/\/\S+/g, ' đường liên kết ');  // URLs
  t = t.replace(/[#>*_~\-]{1,}/g, ' ');                  // md symbols
  t = t.replace(/\[\[.*?\]\]/g, ' ');                    // internal tags
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

class TTS {
  constructor() {
    this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    this.voices = [];
    if (this.supported) {
      const load = () => { this.voices = window.speechSynthesis.getVoices(); };
      load();
      window.speechSynthesis.onvoiceschanged = load;
    }
  }

  listVoices() { return this.voices; }

  pickVoice(lang = 'vi-VN', name = '') {
    if (name) {
      const byName = this.voices.find((v) => v.name === name);
      if (byName) return byName;
    }
    const byLang = this.voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
    return byLang || this.voices[0] || null;
  }

  speak(text, { lang = 'vi-VN', voiceName = '', rate = 1, pitch = 1, onStart, onEnd } = {}) {
    if (!this.supported) { onEnd && onEnd(); return; }
    const clean = speakableText(text);
    if (!clean) { onEnd && onEnd(); return; }
    this.stop();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = lang;
    const v = this.pickVoice(lang, voiceName);
    if (v) u.voice = v;
    u.rate = rate;
    u.pitch = pitch;
    u.onstart = () => onStart && onStart();
    u.onend = () => onEnd && onEnd();
    u.onerror = () => onEnd && onEnd();
    window.speechSynthesis.speak(u);
  }

  stop() {
    if (this.supported) { try { window.speechSynthesis.cancel(); } catch (_) {} }
  }
}

export const tts = new TTS();
