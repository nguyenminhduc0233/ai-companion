// Center column — the conversation surface.
import { el, clear } from './dom.js';
import { renderMarkdown, highlightWithin } from './markdown.js';

export class ChatUI {
  constructor({ onSend, onMicToggle, micSupported }) {
    this.onSend = onSend;
    this.onMicToggle = onMicToggle;
    this.micSupported = micSupported;
    this._typingEl = null;
    this._build();
  }

  _build() {
    this.root = el('div', { class: 'chat' });
    this.list = el('div', { class: 'chat-list' });

    this.input = el('textarea', { class: 'chat-input', rows: '1', placeholder: 'Nhắn cho trợ lý… (Enter để gửi)' });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._send(); }
    });
    this.input.addEventListener('input', () => {
      this.input.style.height = 'auto';
      this.input.style.height = Math.min(140, this.input.scrollHeight) + 'px';
    });

    this.micBtn = el('button', { class: 'icon-btn mic', title: 'Nói', onClick: () => this.onMicToggle && this.onMicToggle() }, '🎙️');
    if (!this.micSupported) this.micBtn.style.display = 'none';

    const sendBtn = el('button', { class: 'icon-btn send', title: 'Gửi', onClick: () => this._send() }, '➤');

    this.root.appendChild(this.list);
    this.root.appendChild(el('div', { class: 'chat-input-row' }, [this.micBtn, this.input, sendBtn]));

    this._welcome();
  }

  _welcome() {
    this.addMessage('assistant', 'Xin chào 👋 Mình là trợ lý của bạn. Hãy mở **Cài đặt** để nhập API key cho model AI bất kỳ, rồi bắt đầu trò chuyện nhé.', { isMarkdown: true });
  }

  _send() {
    const text = this.input.value.trim();
    if (!text) return;
    this.input.value = '';
    this.input.style.height = 'auto';
    this.onSend && this.onSend(text);
  }

  setMicActive(active) {
    this.micBtn.classList.toggle('active', !!active);
  }

  setInputValue(v) { this.input.value = v; }

  addMessage(role, text, { error = false, isMarkdown = role === 'assistant' } = {}) {
    const bubble = el('div', { class: `msg ${role}${error ? ' error' : ''}` });
    if (isMarkdown && !error) {
      bubble.innerHTML = renderMarkdown(text);
      highlightWithin(bubble);
    } else {
      bubble.textContent = text;
    }
    const wrap = el('div', { class: `msg-row ${role}` }, [bubble]);
    this.list.appendChild(wrap);
    this._scroll();
    return bubble;
  }

  showTyping() {
    this.hideTyping();
    this._typingEl = el('div', { class: 'msg-row assistant' }, [
      el('div', { class: 'msg assistant typing' }, [
        el('span', { class: 'dot' }), el('span', { class: 'dot' }), el('span', { class: 'dot' })
      ])
    ]);
    this.list.appendChild(this._typingEl);
    this._scroll();
  }

  hideTyping() {
    if (this._typingEl) { this._typingEl.remove(); this._typingEl = null; }
  }

  clearMessages() {
    clear(this.list);
    this._welcome();
  }

  _scroll() {
    requestAnimationFrame(() => { this.list.scrollTop = this.list.scrollHeight; });
  }
}
