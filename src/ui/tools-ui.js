// Right column — token HUD, local-function tools, and plugin panels.
import { el, clear, fmtTime, fmtDateTimeLocalValue } from './dom.js';
import { toast } from './confirm.js';
import { notes, reminders, alarms, Timer, Stopwatch } from '../core/local/local-functions.js';

export class ToolsUI {
  constructor(ctx, { pluginManager, tokenTracker }) {
    this.ctx = ctx;
    this.pm = pluginManager;
    this.tracker = tokenTracker;
    this.timer = new Timer((r, t) => this._updTimer(r, t), () => { toast('⏰ Hết giờ!', 'ok'); this.ctx.notifier.notify('⏲️ Hẹn giờ', 'Đã hết thời gian.'); });
    this.stopwatch = new Stopwatch((ms) => this._updSw(ms));
    this.active = 'chat';
    this._build();
  }

  _build() {
    this.root = el('div', { class: 'tools' });

    // Token HUD
    this.hud = el('div', { class: 'token-hud' });
    this.root.appendChild(this.hud);
    this.tracker.subscribe((st) => this._renderHud(st));

    // Tabs
    this.tabBar = el('div', { class: 'tool-tabs' });
    this.root.appendChild(this.tabBar);
    this.panel = el('div', { class: 'tool-panel' });
    this.root.appendChild(this.panel);

    this._renderTabs();
    this._select('chat');
  }

  _renderHud(st) {
    clear(this.hud);
    const last = st.lastCall;
    const remaining = st.remaining != null
      ? `${st.remaining.toLocaleString('vi-VN')} token`
      : (st.providerBalance ? st.providerBalance.text : '—');
    const cell = (label, value, cls = '') => el('div', { class: `hud-cell ${cls}` }, [
      el('div', { class: 'hud-val' }, value),
      el('div', { class: 'hud-label' }, label)
    ]);
    this.hud.appendChild(el('div', { class: 'hud-title' }, '📊 Token'));
    this.hud.appendChild(el('div', { class: 'hud-grid' }, [
      cell('Lần gọi gần nhất', last ? `${last.total}${last.estimated ? '~' : ''}` : '—'),
      cell('Phiên này', `${st.session.total.toLocaleString('vi-VN')}`),
      cell(st.budget != null ? 'Còn lại (ngân sách)' : 'Số dư / Còn lại', remaining, 'wide'),
      cell('Tổng tích lũy', `${st.lifetime.total.toLocaleString('vi-VN')}`)
    ]));
    if (last) {
      this.hud.appendChild(el('div', { class: 'muted small' },
        `↳ prompt ${last.prompt} · trả lời ${last.completion}${last.estimated ? ' (ước tính)' : ''} · ${st.session.calls} lần gọi`));
    }
  }

  _renderTabs() {
    clear(this.tabBar);
    const tabs = [
      ...this.pm.enabled().map((p) => ({ id: p.id, icon: p.icon, name: p.name, kind: 'plugin', plugin: p })),
      { id: 'notes', icon: '📝', name: 'Ghi chú', kind: 'local' },
      { id: 'reminders', icon: '⏰', name: 'Nhắc việc', kind: 'local' },
      { id: 'alarms', icon: '⏰', name: 'Báo thức', kind: 'local' },
      { id: 'timer', icon: '⏲️', name: 'Hẹn giờ', kind: 'local' },
      { id: 'stopwatch', icon: '⏱️', name: 'Bấm giờ', kind: 'local' }
    ];
    this._tabs = tabs;
    for (const t of tabs) {
      const b = el('button', { class: `tool-tab${t.id === this.active ? ' active' : ''}`, title: t.name, onClick: () => this._select(t.id) }, [
        el('span', { class: 'tt-icon' }, t.icon), el('span', { class: 'tt-name' }, t.name)
      ]);
      t._btn = b;
      this.tabBar.appendChild(b);
    }
  }

  _select(id) {
    this.active = id;
    (this._tabs || []).forEach((t) => t._btn && t._btn.classList.toggle('active', t.id === id));
    // best-effort cleanup of previous panel (e.g. camera stream)
    if (this.panel.firstChild && this.panel.firstChild._cleanup) { try { this.panel.firstChild._cleanup(); } catch (_) {} }
    clear(this.panel);
    const tab = (this._tabs || []).find((t) => t.id === id);
    if (!tab) return;
    if (tab.kind === 'plugin') {
      this.panel.appendChild(tab.plugin.render(this.ctx));
    } else {
      this.panel.appendChild(this[`_panel_${id}`]());
    }
  }

  // ---- Local tool panels ----
  _panel_notes() {
    const root = el('div', { class: 'plugin-panel' });
    const input = el('textarea', { class: 'field', rows: '3', placeholder: 'Ghi chú nhanh…' });
    const list = el('div', {});
    const render = () => {
      clear(list);
      const items = notes.all();
      if (!items.length) list.appendChild(el('div', { class: 'muted small' }, 'Chưa có ghi chú.'));
      items.forEach((n) => list.appendChild(el('div', { class: 'row-card small' }, [
        el('div', {}, n.text),
        el('button', { class: 'btn ghost', onClick: () => { notes.remove(n.id); render(); } }, '✕')
      ])));
    };
    root.appendChild(input);
    root.appendChild(el('button', { class: 'btn primary', onClick: () => { if (input.value.trim()) { notes.add(input.value.trim()); input.value = ''; render(); } } }, 'Lưu ghi chú'));
    root.appendChild(list);
    render();
    return root;
  }

  _panel_reminders() {
    const root = el('div', { class: 'plugin-panel' });
    const text = el('input', { class: 'field', type: 'text', placeholder: 'Nội dung nhắc' });
    const when = el('input', { class: 'field', type: 'datetime-local', value: fmtDateTimeLocalValue(new Date(Date.now() + 600000)) });
    const list = el('div', {});
    const render = () => {
      clear(list);
      reminders.all().forEach((r) => list.appendChild(el('div', { class: 'row-card small' }, [
        el('div', {}, [el('div', {}, r.text), el('div', { class: 'muted small' }, new Date(r.at).toLocaleString('vi-VN') + (r.fired ? ' ✓' : ''))]),
        el('button', { class: 'btn ghost', onClick: () => { reminders.remove(r.id); render(); } }, '✕')
      ])));
    };
    root.appendChild(el('div', { class: 'form-row' }, [text]));
    root.appendChild(el('div', { class: 'form-row' }, [when, el('button', { class: 'btn primary', onClick: () => { if (text.value.trim()) { reminders.add({ text: text.value.trim(), at: new Date(when.value).getTime() }); text.value = ''; render(); toast('Đã đặt nhắc việc.', 'ok'); } } }, 'Đặt')]));
    root.appendChild(list);
    render();
    return root;
  }

  _panel_alarms() {
    const root = el('div', { class: 'plugin-panel' });
    const label = el('input', { class: 'field', type: 'text', placeholder: 'Nhãn báo thức' });
    const time = el('input', { class: 'field', type: 'time', value: '07:00' });
    const list = el('div', {});
    const render = () => {
      clear(list);
      alarms.all().forEach((a) => list.appendChild(el('div', { class: 'row-card small' }, [
        el('div', {}, [el('div', {}, `${String(a.hour).padStart(2, '0')}:${String(a.minute).padStart(2, '0')}`), el('div', { class: 'muted small' }, a.label || '')]),
        el('div', { class: 'form-row' }, [
          el('button', { class: 'btn ghost', onClick: () => { alarms.toggle(a.id, !a.enabled); render(); } }, a.enabled ? '🔔' : '🔕'),
          el('button', { class: 'btn ghost', onClick: () => { alarms.remove(a.id); render(); } }, '✕')
        ])
      ])));
    };
    root.appendChild(el('div', { class: 'form-row' }, [label]));
    root.appendChild(el('div', { class: 'form-row' }, [time, el('button', { class: 'btn primary', onClick: () => { const [h, m] = time.value.split(':').map(Number); alarms.add({ label: label.value.trim(), hour: h, minute: m }); label.value = ''; render(); toast('Đã thêm báo thức.', 'ok'); } }, 'Thêm')]));
    root.appendChild(list);
    render();
    return root;
  }

  _panel_timer() {
    const root = el('div', { class: 'plugin-panel timer-panel' });
    this._timerDisplay = el('div', { class: 'big-time' }, fmtTime(this.timer.remaining * 1000));
    const mins = el('input', { class: 'field', type: 'number', min: '0', value: '5', style: { width: '70px' } });
    const secs = el('input', { class: 'field', type: 'number', min: '0', max: '59', value: '0', style: { width: '70px' } });
    root.appendChild(this._timerDisplay);
    root.appendChild(el('div', { class: 'form-row' }, [mins, el('span', { class: 'muted' }, 'phút'), secs, el('span', { class: 'muted' }, 'giây')]));
    root.appendChild(el('div', { class: 'form-row' }, [
      el('button', { class: 'btn primary', onClick: () => this.timer.start((Number(mins.value) || 0) * 60 + (Number(secs.value) || 0)) }, '▶️ Bắt đầu'),
      el('button', { class: 'btn ghost', onClick: () => { this.timer.stop(); this._updTimer(0, 0); } }, '⏹ Dừng')
    ]));
    return root;
  }

  _panel_stopwatch() {
    const root = el('div', { class: 'plugin-panel timer-panel' });
    this._swDisplay = el('div', { class: 'big-time' }, fmtTime(this.stopwatch.elapsed));
    this._swLaps = el('div', { class: 'laps' });
    root.appendChild(this._swDisplay);
    root.appendChild(el('div', { class: 'form-row' }, [
      el('button', { class: 'btn primary', onClick: () => this.stopwatch.start() }, '▶️'),
      el('button', { class: 'btn ghost', onClick: () => this.stopwatch.pause() }, '⏸'),
      el('button', { class: 'btn ghost', onClick: () => { this._renderLaps(this.stopwatch.lap()); } }, '🚩 Lap'),
      el('button', { class: 'btn ghost', onClick: () => { this.stopwatch.reset(); this._renderLaps([]); } }, '↺')
    ]));
    root.appendChild(this._swLaps);
    this._renderLaps(this.stopwatch.laps);
    return root;
  }

  _renderLaps(laps) {
    if (!this._swLaps) return;
    clear(this._swLaps);
    laps.forEach((l, i) => this._swLaps.appendChild(el('div', { class: 'muted small' }, `Lap ${i + 1}: ${fmtTime(l)}`)));
  }

  _updTimer(r) { if (this._timerDisplay) this._timerDisplay.textContent = fmtTime(r * 1000); }
  _updSw(ms) { if (this._swDisplay) this._swDisplay.textContent = fmtTime(ms); }

  refreshPlugins() { this._renderTabs(); }
}
