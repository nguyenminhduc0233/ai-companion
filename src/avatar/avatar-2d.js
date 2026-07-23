// ---------------------------------------------------------------------------
// 2D "living portrait" avatar. Uses the ACTUAL character artwork (the image
// the user provided) plus AI-generated expression variants of the SAME
// character, so the avatar looks exactly like the reference. Adds smooth life:
// breathing, gentle floating sway, blinking, soft expression cross-fades, a
// violet particle aura, and a speaking glow/bob. Same interface as Avatar3D
// (init / setMood / setActivity / resize / dispose) so main.js is unchanged.
// ---------------------------------------------------------------------------

const EXPR_FRAMES = ['happy', 'thinking', 'surprise', 'sympathy', 'celebrate'];
const MOOD_TO_FRAME = {
  happy: 'happy', celebrate: 'celebrate', thinking: 'thinking',
  surprise: 'surprise', sympathy: 'sympathy', normal: null, idle: null
};

function lerp(a, b, t) { return a + (b - a) * t; }

function injectStyles() {
  if (document.getElementById('av2d-styles')) return;
  const s = document.createElement('style');
  s.id = 'av2d-styles';
  s.textContent = `
  .av2d-root{position:absolute;inset:0;overflow:hidden}
  .av2d-portrait{position:absolute;inset:0;will-change:transform;transform-origin:50% 60%}
  .av2d-layer{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 12%;opacity:0;transition:none;backface-visibility:hidden}
  .av2d-canvas{position:absolute;inset:0;pointer-events:none}
  .av2d-glow{position:absolute;left:50%;bottom:-10%;transform:translateX(-50%);width:80%;height:40%;
    background:radial-gradient(ellipse at center,rgba(154,134,255,.55),transparent 70%);opacity:0;pointer-events:none;filter:blur(6px)}
  .av2d-vignette{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .5s ease;
    background:radial-gradient(120% 90% at 50% 20%,transparent 55%,rgba(20,12,40,.35))}
  `;
  document.head.appendChild(s);
}

export class Avatar2D {
  constructor(container) {
    this.container = container;
    this._raf = null;
    this._t = 0;
    this._last = 0;
    this.activity = 'idle';
    this.mood = 'normal';
    this.layers = {};
    this.op = {};        // current opacity per expression frame
    this.opTarget = {};  // target opacity
    this.blink = 0;      // 0..1..0
    this.nextBlink = 2;
    this.glow = 0;
    this.auraBurst = 0;
  }

  async init({ frames, baseName = 'normal' } = {}) {
    injectStyles();
    this.frames = frames || {};
    this.baseName = baseName;

    this.root = document.createElement('div');
    this.root.className = 'av2d-root';
    this.portrait = document.createElement('div');
    this.portrait.className = 'av2d-portrait';
    this.root.appendChild(this.portrait);

    // Base layer (always visible).
    this.base = this._layer(this.frames[baseName], 1);
    this.portrait.appendChild(this.base);

    // Expression layers.
    for (const name of EXPR_FRAMES) {
      if (!this.frames[name]) continue;
      const el = this._layer(this.frames[name], 0);
      this.layers[name] = el;
      this.op[name] = 0;
      this.opTarget[name] = 0;
      this.portrait.appendChild(el);
    }
    // Blink layer (top).
    if (this.frames.blink) {
      this.blinkEl = this._layer(this.frames.blink, 0);
      this.portrait.appendChild(this.blinkEl);
    }

    // Glow + vignette + aura.
    this.glowEl = document.createElement('div'); this.glowEl.className = 'av2d-glow';
    this.vignette = document.createElement('div'); this.vignette.className = 'av2d-vignette';
    this.canvas = document.createElement('canvas'); this.canvas.className = 'av2d-canvas';
    this.root.appendChild(this.glowEl);
    this.root.appendChild(this.vignette);
    this.root.appendChild(this.canvas);
    this.container.appendChild(this.root);

    this._initAura();
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(this.container);
    this.resize();

    this._last = performance.now();
    this._loop();
    return '2d';
  }

  _layer(src, opacity) {
    const img = document.createElement('img');
    img.className = 'av2d-layer';
    img.decoding = 'async';
    img.loading = 'eager';
    img.style.opacity = String(opacity);
    if (src) img.src = src;
    img.onerror = () => { img.dataset.failed = '1'; };
    return img;
  }

  _initAura() {
    const N = 90;
    this.parts = [];
    for (let i = 0; i < N; i++) this.parts.push(this._newPart(true));
  }
  _newPart(seed) {
    const w = this.canvas.width || 300, h = this.canvas.height || 400;
    return {
      x: Math.random() * w,
      y: seed ? Math.random() * h : h + 10,
      r: 0.6 + Math.random() * 2.2,
      v: 8 + Math.random() * 22,
      a: 0.2 + Math.random() * 0.5,
      drift: (Math.random() - 0.5) * 12
    };
  }

  resize() {
    const w = this.container.clientWidth || 320;
    const h = this.container.clientHeight || 440;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this._dpr = dpr;
  }

  setMood(mood) {
    this.mood = mood || 'normal';
    const frame = MOOD_TO_FRAME[this.mood] !== undefined ? MOOD_TO_FRAME[this.mood] : null;
    for (const name of EXPR_FRAMES) this.opTarget[name] = 0;
    if (frame && this.layers[frame]) this.opTarget[frame] = 1;
    if (this.mood === 'celebrate') this.auraBurst = 1;
    // Warm/cool vignette hint.
    if (this.vignette) this.vignette.style.opacity = (this.mood === 'sympathy') ? '0.5' : (this.mood === 'celebrate' ? '0.15' : '0');
  }

  setActivity(activity) { this.activity = activity || 'idle'; }

  get _activeExpression() {
    for (const name of EXPR_FRAMES) if (this.opTarget[name] > 0.5) return name;
    return null;
  }

  _loop() {
    const tick = (now) => {
      this._raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - this._last) / 1000);
      this._last = now;
      this._t += dt;
      this._update(dt);
    };
    this._raf = requestAnimationFrame(tick);
  }

  _update(dt) {
    const t = this._t;

    // ---- Expression cross-fade ----
    for (const name of EXPR_FRAMES) {
      if (!this.layers[name]) continue;
      this.op[name] = lerp(this.op[name], this.opTarget[name], Math.min(1, dt * 4));
      this.layers[name].style.opacity = this.op[name].toFixed(3);
    }

    // ---- Blink (only when no strong expression is shown) ----
    if (this.blinkEl) {
      if (!this._activeExpression && this.activity !== 'talking') {
        this.nextBlink -= dt;
        if (this.nextBlink <= 0 && this.blink === 0) this.blink = 0.0001;
      }
      if (this.blink > 0) {
        this.blink += dt / 0.07;
        if (this.blink >= 2) { this.blink = 0; this.nextBlink = 2 + Math.random() * 4; }
      }
      const bv = this.blink === 0 ? 0 : (this.blink <= 1 ? this.blink : 2 - this.blink);
      this.blinkEl.style.opacity = bv.toFixed(3);
    }

    // ---- Motion (breathe / sway / talk bob / think tilt / listen scale) ----
    const breathe = Math.sin(t * 1.5) * 1;          // px
    const sway = Math.sin(t * 0.55);                // -1..1
    let ty = breathe;                               // base breathing
    let tx = sway * 3;
    let rot = sway * 0.6;                            // deg
    let scale = 1.045 + Math.sin(t * 1.5) * 0.004;  // subtle breathe scale (>1 hides edges)

    if (this.activity === 'talking') {
      ty += Math.sin(t * 9) * 1.6 + Math.sin(t * 5.5) * 0.8;
      scale += 0.004 * (Math.sin(t * 9) * 0.5 + 0.5);
      this.glow = lerp(this.glow, 0.35 + 0.35 * (Math.sin(t * 9) * 0.5 + 0.5), Math.min(1, dt * 10));
    } else if (this.activity === 'listening') {
      scale += 0.012;
      ty += Math.sin(t * 2.4) * 1.2;
      this.glow = lerp(this.glow, 0.18, Math.min(1, dt * 6));
    } else if (this.activity === 'thinking') {
      rot += 2.2;
      tx += 4;
      this.glow = lerp(this.glow, 0.05, Math.min(1, dt * 6));
    } else {
      this.glow = lerp(this.glow, this.mood === 'celebrate' ? 0.4 : 0, Math.min(1, dt * 4));
    }

    this.portrait.style.transform =
      `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
    if (this.glowEl) this.glowEl.style.opacity = this.glow.toFixed(3);

    // ---- Aura particles ----
    this._drawAura(dt);
  }

  _drawAura(dt) {
    const ctx = this.canvas.getContext('2d');
    const W = this.canvas.width, H = this.canvas.height, dpr = this._dpr || 1;
    ctx.clearRect(0, 0, W, H);
    const boost = 1 + this.auraBurst * 5;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      p.y -= p.v * dt * dpr * boost;
      p.x += Math.sin(this._t + p.y * 0.01) * p.drift * dt * dpr;
      if (p.y < -10) Object.assign(p, this._newPart(false), { y: H + 10 });
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4 * dpr);
      grd.addColorStop(0, `rgba(200,180,255,${p.a})`);
      grd.addColorStop(1, 'rgba(154,134,255,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 4 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (this.auraBurst > 0) this.auraBurst = Math.max(0, this.auraBurst - dt * 1.2);
  }

  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._ro) this._ro.disconnect();
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
  }
}
