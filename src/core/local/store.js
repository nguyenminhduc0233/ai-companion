// ---------------------------------------------------------------------------
// Local persistence. The spec calls for SQLite; for a single cross-platform
// core we use a small localStorage-backed store with a collection API that
// mirrors a table. It can be swapped for @capacitor-community/sqlite on
// Android / better-sqlite3 on Electron without touching callers.
// ---------------------------------------------------------------------------

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export class Store {
  constructor(namespace = 'aic') {
    this.ns = namespace;
  }

  _k(key) {
    return `${this.ns}.${key}`;
  }

  get(key, def = null) {
    try {
      const raw = localStorage.getItem(this._k(key));
      return raw == null ? def : JSON.parse(raw);
    } catch (_) {
      return def;
    }
  }

  set(key, value) {
    try {
      localStorage.setItem(this._k(key), JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  remove(key) {
    try { localStorage.removeItem(this._k(key)); } catch (_) {}
  }

  /** A persisted array "table" with CRUD helpers. */
  collection(name) {
    const key = `col.${name}`;
    const self = this;
    return {
      all() {
        return self.get(key, []);
      },
      find(id) {
        return self.get(key, []).find((r) => r.id === id) || null;
      },
      add(item) {
        const rows = self.get(key, []);
        const row = { id: uid(), createdAt: Date.now(), ...item };
        rows.push(row);
        self.set(key, rows);
        return row;
      },
      update(id, patch) {
        const rows = self.get(key, []);
        const idx = rows.findIndex((r) => r.id === id);
        if (idx === -1) return null;
        rows[idx] = { ...rows[idx], ...patch, updatedAt: Date.now() };
        self.set(key, rows);
        return rows[idx];
      },
      remove(id) {
        const rows = self.get(key, []).filter((r) => r.id !== id);
        self.set(key, rows);
      },
      clear() {
        self.set(key, []);
      }
    };
  }
}

export const store = new Store('aic');
