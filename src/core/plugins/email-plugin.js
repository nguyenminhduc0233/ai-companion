import { el } from '../../ui/dom.js';

// Email is a DANGEROUS action per TÀI LIỆU 1 → always confirm before "sending".
// This is a stub with a clear extension point: wire a real transport (SMTP
// bridge, Gmail API, a backend endpoint) inside `send()`. As a working
// fallback it opens the user's mail client via mailto:.
export const emailPlugin = {
  id: 'email',
  name: 'Email',
  icon: '✉️',
  category: 'plugin',
  description: 'Soạn email (bản mẫu — cần xác nhận trước khi gửi).',

  render(ctx) {
    const to = el('input', { class: 'field', type: 'email', placeholder: 'Người nhận' });
    const subject = el('input', { class: 'field', type: 'text', placeholder: 'Tiêu đề' });
    const body = el('textarea', { class: 'field', rows: '6', placeholder: 'Nội dung…' });

    async function send() {
      if (!to.value.trim()) { ctx.toast('Nhập người nhận.', 'warn'); return; }
      const ok = await ctx.confirmAction('Gửi email?', `Gửi tới ${to.value}. Đây là thao tác gửi đi — xác nhận?`);
      if (!ok) return;
      // Extension point: replace with a real transport.
      const href = `mailto:${encodeURIComponent(to.value)}?subject=${encodeURIComponent(subject.value)}&body=${encodeURIComponent(body.value)}`;
      window.open(href, '_blank');
      ctx.toast('Đã mở trình email với bản nháp. (Gửi trực tiếp cần cấu hình transport.)', 'ok');
    }

    return el('div', { class: 'plugin-panel' }, [
      el('div', { class: 'form-row' }, [to]),
      el('div', { class: 'form-row' }, [subject]),
      el('div', { class: 'form-row' }, [body]),
      el('button', { class: 'btn primary', onClick: send }, 'Gửi (cần xác nhận)'),
      el('div', { class: 'muted small', style: { marginTop: '8px' } }, 'Điểm mở rộng: cắm SMTP/Gmail API vào hàm send().')
    ]);
  }
};
