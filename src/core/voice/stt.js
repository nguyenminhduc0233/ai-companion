// ---------------------------------------------------------------------------
// Speech To Text via the Web Speech API (SpeechRecognition). Feature-detected;
// on platforms without it the UI hides the mic button.
// ---------------------------------------------------------------------------

const SR = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

class STT {
  constructor() {
    this.supported = !!SR;
    this.rec = null;
    this.listening = false;
  }

  start({ lang = 'vi-VN', interim = true, onResult, onFinal, onEnd, onError } = {}) {
    if (!this.supported) { onError && onError(new Error('Thiết bị không hỗ trợ nhận diện giọng nói.')); return; }
    this.stop();
    const rec = new SR();
    this.rec = rec;
    rec.lang = lang;
    rec.interimResults = interim;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (interimText && onResult) onResult(interimText);
      if (finalText && onFinal) onFinal(finalText);
    };
    rec.onerror = (e) => { onError && onError(e.error || e); };
    rec.onend = () => { this.listening = false; onEnd && onEnd(); };

    try { rec.start(); this.listening = true; } catch (err) { onError && onError(err); }
  }

  stop() {
    if (this.rec) { try { this.rec.stop(); } catch (_) {} this.rec = null; }
    this.listening = false;
  }
}

export const stt = new STT();
