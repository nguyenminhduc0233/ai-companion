// ---------------------------------------------------------------------------
// RPG / visual-novel dialogue box overlay. Sits over the avatar stage and
// presents the assistant's latest line like an NPC talking to the player:
// name plate + typewriter reveal + blinking ▼. Works over any avatar renderer
// (2D image or 3D). Click to skip the typewriter.
// ---------------------------------------------------------------------------

import { el } from './dom.js';

function injectStyles() {
  if (document.getElementById('dlg-styles')) return;
  const s = document.createElement('style');
  s.id = 'dlg-styles';
  s.textContent = `
  .dlg-box{position:absolute;left:50%;transform:translateX(-50%);bottom:14px;width:calc(100% - 28px);
    background:linear-gradient(180deg,rgba(20,16,40,.85),rgba(12,9,26,.93));border:1.5px solid rgba(154,134,255,.55);
    border-radius:14px;padding:16px 18px 18px;backdrop-filter:blur(6px);
    box-shadow:0 14px 40px rgba(0,0,0,.5),inset 0 0 26px rgba(154,134,255,.08);cursor:pointer;z-index:5;display:none}
  .dlg-box.show{display:block}
  .dlg-name{position:absolute;top:-14px;left:16px;background:linear-gradient(135deg,#9a86ff,#6c5ce7);color:#fff;
    font-weight:700;padding:4px 14px;border-radius:9px;font-size:13px;box-shadow:0 5px 14px rgba(108,92,231,.5);letter-spacing:.4px}
  .dlg-text{font-size:14.5px;line-height:1.6;min-height:44px;margin-top:4px;color:#f3f0ff;text-shadow:0 1px 2px rgba(0,0,0,.5);white-space:pre-wrap}
  .dlg-next{position:absolute;right:14px;bottom:8px;color:#c9baff;font-size:15px;opacity:0;animation:dlgbob 1s infinite}
  @keyframes dlgbob{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(4px);opacity:1}}
  `;
  document.head.appendChild(s);
}

export class DialogueBox {
  constructor(container, name = 'Trợ lý') {
    injectStyles();
    this.nameEl = el('div', { class: 'dlg-name' }, name);
    this.textEl = el('div', { class: 'dlg-text' });
    this.nextEl = el('div', { class: 'dlg-next' }, '▼');
    this.box = el('div', { class: 'dlg-box' }, [this.nameEl, this.textEl, this.nextEl]);
    this.box.addEventListener('click', () => this.skip());
    container.appendChild(this.box);
    this._timer = null;
    this._full = '';
  }

  setName(name) { this.nameEl.textContent = name || 'Trợ lý'; }

  thinking() {
    this.box.classList.add('show');
    this._stop();
    this.nextEl.style.opacity = '0';
    this.textEl.textContent = '…';
  }

  say(text, { speed = 22, onDone } = {}) {
    this.box.classList.add('show');
    this._stop();
    this._full = text || '';
    this.nextEl.style.opacity = '0';
    this.textEl.textContent = '';
    let i = 0;
    this._timer = setInterval(() => {
      i++;
      this.textEl.textContent = this._full.slice(0, i);
      if (i >= this._full.length) { this._stop(); this.nextEl.style.opacity = '1'; onDone && onDone(); }
    }, speed);
  }

  skip() {
    if (this._timer) {
      this._stop();
      this.textEl.textContent = this._full;
      this.nextEl.style.opacity = '1';
    }
  }

  hide() { this.box.classList.remove('show'); }

  _stop() { if (this._timer) { clearInterval(this._timer); this._timer = null; } }
}
