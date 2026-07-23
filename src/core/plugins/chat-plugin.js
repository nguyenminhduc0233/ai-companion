import { el } from '../../ui/dom.js';

// Chat is the primary surface (rendered in the center column). This plugin
// entry documents it in the Tools list and offers quick conversation actions.
export const chatPlugin = {
  id: 'chat',
  name: 'Trò chuyện',
  icon: '💬',
  category: 'core',
  description: 'Hội thoại chính với trợ lý.',

  render(ctx) {
    return el('div', { class: 'plugin-panel' }, [
      el('div', { class: 'muted' }, 'Khung trò chuyện nằm ở cột giữa.'),
      el('button', { class: 'btn ghost', style: { marginTop: '10px' }, onClick: () => { ctx.assistant.reset(); ctx.toast('Đã bắt đầu hội thoại mới.', 'ok'); ctx.refreshChat && ctx.refreshChat(); } }, '🧹 Hội thoại mới')
    ]);
  }
};
