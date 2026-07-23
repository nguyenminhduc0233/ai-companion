import { el, clear, fmtDateTimeLocalValue } from '../../ui/dom.js';
import { calendar } from '../local/local-functions.js';

export const calendarPlugin = {
  id: 'calendar',
  name: 'Lịch',
  icon: '📅',
  category: 'local',
  description: 'Quản lý sự kiện. Avatar sẽ nhắc trước 1 phút.',

  render() {
    const root = el('div', { class: 'plugin-panel' });
    const list = el('div', { class: 'cal-list' });

    const titleInput = el('input', { class: 'field', type: 'text', placeholder: 'Tên sự kiện' });
    const timeInput = el('input', { class: 'field', type: 'datetime-local', value: fmtDateTimeLocalValue(new Date(Date.now() + 3600000)) });
    const addBtn = el('button', { class: 'btn primary', onClick: () => {
      const title = titleInput.value.trim();
      if (!title || !timeInput.value) return;
      calendar.add({ title, start: new Date(timeInput.value).getTime() });
      titleInput.value = '';
      renderList();
    } }, 'Thêm sự kiện');

    function renderList() {
      clear(list);
      const items = calendar.all();
      if (!items.length) { list.appendChild(el('div', { class: 'muted' }, 'Chưa có sự kiện.')); return; }
      for (const ev of items) {
        list.appendChild(el('div', { class: 'row-card' }, [
          el('div', {}, [
            el('div', { class: 'row-title' }, ev.title),
            el('div', { class: 'muted small' }, new Date(ev.start).toLocaleString('vi-VN'))
          ]),
          el('button', { class: 'btn ghost', onClick: () => { calendar.remove(ev.id); renderList(); } }, '✕')
        ]));
      }
    }

    root.appendChild(el('div', { class: 'form-row' }, [titleInput]));
    root.appendChild(el('div', { class: 'form-row' }, [timeInput, addBtn]));
    root.appendChild(list);
    renderList();
    return root;
  }
};
