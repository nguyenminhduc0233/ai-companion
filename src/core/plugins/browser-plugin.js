import { el } from '../../ui/dom.js';

// Browser plugin (stub + extension point). In-app fetching of arbitrary pages
// is limited by CORS in a WebView; a production build would route through the
// Electron main process or a backend. For now it opens the page externally.
export const browserPlugin = {
  id: 'browser',
  name: 'Trình duyệt',
  icon: '🌐',
  category: 'plugin',
  description: 'Mở trang web (bản mẫu — mở bằng trình duyệt hệ thống).',

  render(ctx) {
    const url = el('input', { class: 'field', type: 'url', placeholder: 'https://…' });
    function open() {
      let u = url.value.trim();
      if (!u) return;
      if (!/^https?:\/\//.test(u)) u = 'https://' + u;
      window.open(u, '_blank', 'noopener');
      ctx.toast('Đã mở liên kết.', 'ok');
    }
    return el('div', { class: 'plugin-panel' }, [
      el('div', { class: 'form-row' }, [url, el('button', { class: 'btn primary', onClick: open }, 'Mở')]),
      el('div', { class: 'muted small', style: { marginTop: '8px' } }, 'Điểm mở rộng: proxy fetch qua Electron main / backend để tóm tắt nội dung trang.')
    ]);
  }
};
