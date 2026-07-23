// Toasts + confirmation dialog. Dangerous actions (send email, delete, pay,
// post) route through confirmAction() per TÀI LIỆU 1.
import { el, clear } from './dom.js';

let toastHost;

export function toast(message, type = 'ok', timeout = 3200) {
  if (!toastHost) {
    toastHost = el('div', { class: 'toast-host' });
    document.body.appendChild(toastHost);
  }
  const t = el('div', { class: `toast ${type}` }, message);
  toastHost.appendChild(t);
  setTimeout(() => { t.classList.add('show'); }, 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, timeout);
}

export function confirmAction(title, message) {
  return new Promise((resolve) => {
    const overlay = el('div', { class: 'modal-overlay' });
    const close = (val) => { overlay.remove(); resolve(val); };
    const box = el('div', { class: 'modal confirm' }, [
      el('div', { class: 'modal-title' }, `⚠️ ${title}`),
      el('div', { class: 'modal-body' }, message),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn ghost', onClick: () => close(false) }, 'Huỷ'),
        el('button', { class: 'btn primary', onClick: () => close(true) }, 'Xác nhận')
      ])
    ]);
    overlay.appendChild(box);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    document.body.appendChild(overlay);
  });
}
