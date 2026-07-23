// ---------------------------------------------------------------------------
// Local Functions — work WITHOUT any AI (per TÀI LIỆU 3):
//   Alarm, Calendar, Reminder, Notification, Notes, Timer, Stopwatch.
// A single scheduler ticks every second and fires due alarms/reminders, which
// surface as notifications and trigger the avatar's "notification" state.
// ---------------------------------------------------------------------------

import { store } from './store.js';

export class Notifier {
  constructor() {
    this.listeners = new Set();
  }

  on(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); }

  async ensurePermission() {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      try { return (await Notification.requestPermission()) === 'granted'; } catch (_) {}
    }
    return false;
  }

  async notify(title, body, meta = {}) {
    const payload = { title, body, at: Date.now(), ...meta };
    // OS notification when allowed.
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    } catch (_) {}
    // In-app listeners (toast + avatar reaction).
    for (const cb of this.listeners) {
      try { cb(payload); } catch (_) {}
    }
  }
}

export const notifier = new Notifier();

// --- Notes ---
export const notes = {
  col: store.collection('notes'),
  all() { return this.col.all().sort((a, b) => b.createdAt - a.createdAt); },
  add(text, title = '') { return this.col.add({ title, text }); },
  update(id, patch) { return this.col.update(id, patch); },
  remove(id) { this.col.remove(id); },
  search(q) {
    const s = (q || '').toLowerCase();
    return this.all().filter((n) => (n.title + ' ' + n.text).toLowerCase().includes(s));
  }
};

// --- Calendar events ---
export const calendar = {
  col: store.collection('events'),
  all() { return this.col.all().sort((a, b) => a.start - b.start); },
  add({ title, start, end, notes: n = '' }) { return this.col.add({ title, start, end: end || start, notes: n }); },
  remove(id) { this.col.remove(id); },
  upcoming(limit = 10) {
    const now = Date.now();
    return this.all().filter((e) => e.start >= now).slice(0, limit);
  }
};

// --- Reminders (one-shot, time based) ---
export const reminders = {
  col: store.collection('reminders'),
  all() { return this.col.all().sort((a, b) => a.at - b.at); },
  add({ text, at }) { return this.col.add({ text, at, fired: false }); },
  remove(id) { this.col.remove(id); }
};

// --- Alarms (daily, hh:mm) ---
export const alarms = {
  col: store.collection('alarms'),
  all() { return this.col.all(); },
  add({ label, hour, minute, enabled = true }) { return this.col.add({ label, hour, minute, enabled, lastFired: 0 }); },
  toggle(id, enabled) { return this.col.update(id, { enabled }); },
  remove(id) { this.col.remove(id); }
};

// --- Timer (countdown) ---
export class Timer {
  constructor(onTick, onDone) {
    this.onTick = onTick;
    this.onDone = onDone;
    this.remaining = 0;
    this.total = 0;
    this._int = null;
  }
  start(seconds) {
    this.stop();
    this.total = seconds;
    this.remaining = seconds;
    this.onTick && this.onTick(this.remaining, this.total);
    this._int = setInterval(() => {
      this.remaining -= 1;
      if (this.remaining <= 0) {
        this.stop();
        this.remaining = 0;
        this.onTick && this.onTick(0, this.total);
        this.onDone && this.onDone();
      } else {
        this.onTick && this.onTick(this.remaining, this.total);
      }
    }, 1000);
  }
  stop() { if (this._int) { clearInterval(this._int); this._int = null; } }
  get running() { return !!this._int; }
}

// --- Stopwatch ---
export class Stopwatch {
  constructor(onTick) {
    this.onTick = onTick;
    this.elapsed = 0;
    this._start = 0;
    this._int = null;
    this.laps = [];
  }
  start() {
    if (this._int) return;
    this._start = Date.now() - this.elapsed;
    this._int = setInterval(() => {
      this.elapsed = Date.now() - this._start;
      this.onTick && this.onTick(this.elapsed);
    }, 50);
  }
  pause() { if (this._int) { clearInterval(this._int); this._int = null; } }
  lap() { this.laps.push(this.elapsed); return this.laps.slice(); }
  reset() { this.pause(); this.elapsed = 0; this.laps = []; this.onTick && this.onTick(0); }
  get running() { return !!this._int; }
}

// --- Scheduler: checks reminders + alarms once per second ---
export class Scheduler {
  constructor() { this._int = null; }
  start() {
    if (this._int) return;
    this._int = setInterval(() => this._tick(), 1000);
  }
  stop() { if (this._int) { clearInterval(this._int); this._int = null; } }
  _tick() {
    const now = Date.now();
    // Reminders
    for (const r of reminders.all()) {
      if (!r.fired && r.at <= now) {
        reminders.col.update(r.id, { fired: true });
        notifier.notify('⏰ Nhắc việc', r.text, { kind: 'reminder' });
      }
    }
    // Alarms (daily)
    const d = new Date();
    const hh = d.getHours();
    const mm = d.getMinutes();
    const dayStamp = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    for (const a of alarms.all()) {
      if (a.enabled && a.hour === hh && a.minute === mm && a.lastFired !== dayStamp) {
        alarms.col.update(a.id, { lastFired: dayStamp });
        notifier.notify('⏰ Báo thức', a.label || `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, { kind: 'alarm' });
      }
    }
    // Upcoming calendar events (fire 1 min before start)
    for (const e of calendar.all()) {
      if (!e._notified && e.start - now <= 60000 && e.start - now > 0) {
        calendar.col.update(e.id, { _notified: true });
        notifier.notify('📅 Sự kiện sắp tới', e.title, { kind: 'event' });
      }
    }
  }
}

export const scheduler = new Scheduler();
