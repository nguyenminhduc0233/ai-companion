// ---------------------------------------------------------------------------
// Plugin Manager — the extension point from TÀI LIỆU 3. Plugins are
// self-contained modules that register a definition:
//
//   { id, name, icon, description, category, render(ctx) -> HTMLElement }
//
// The Tools UI lists registered plugins and mounts the active one's panel.
// New plugins only need to call pluginManager.register(def) — no core changes.
// ---------------------------------------------------------------------------

export class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.order = [];
  }

  register(def) {
    if (!def || !def.id) throw new Error('Plugin cần có id.');
    if (this.plugins.has(def.id)) return;
    this.plugins.set(def.id, { enabled: true, category: 'general', ...def });
    this.order.push(def.id);
  }

  get(id) { return this.plugins.get(id) || null; }

  list() { return this.order.map((id) => this.plugins.get(id)).filter(Boolean); }

  enabled() { return this.list().filter((p) => p.enabled); }

  setEnabled(id, enabled) {
    const p = this.plugins.get(id);
    if (p) p.enabled = enabled;
  }
}

export const pluginManager = new PluginManager();
